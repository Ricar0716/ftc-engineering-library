"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireVerifiedUser } from "@/lib/auth/session";
import {
  checkUpload,
  fileCategoryFor,
  mimeTypeFor,
  safeFilename,
  TUTORIAL_VIDEOS_BUCKET,
  UPLOAD_REJECTION_MESSAGES,
} from "@/lib/config/uploads";
import { getSubmissionDetail } from "@/lib/db/submissions";
import { isSupabaseConfigured } from "@/lib/env";
import { resolveResourceStorageBucket } from "@/lib/downloads/path";
import { publicResourceError } from "@/lib/resources/errors";
import { authoritativeExpiresAt } from "@/lib/uploads/expiry";
import type { ResourceFormState } from "@/lib/resources/form-state";
import { uniqueResourceSlug } from "@/lib/resources/slug";
import { firstFieldErrors, resourceDraftSchema } from "@/lib/resources/validation";
import { isResourceObjectPath } from "@/lib/storage/resource-paths";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils/id";
import { logger } from "@/lib/utils/logger";
import type { SubmissionDetail } from "@/types/resources";

const NOT_ALLOWED = "You do not have permission to do that.";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readStringList(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .filter((value) => value.length > 0);
}

function revalidateSubmissionViews(resourceId?: string, slug?: string) {
  revalidatePath("/my/resources");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/resources");
  revalidatePath("/dashboard/drafts");
  revalidatePath("/dashboard/reviews");
  revalidatePath("/dashboard/versions");
  revalidatePath("/admin/review");
  revalidatePath("/admin/resources");
  revalidatePath("/admin");
  if (resourceId) {
    revalidatePath(`/my/resources/${resourceId}/edit`);
    revalidatePath(`/admin/review/${resourceId}`);
    revalidatePath(`/admin/resources/${resourceId}`);
  }
  if (slug) {
    revalidatePath(`/resources/${slug}`);
  }
  revalidatePath("/explore");
  revalidatePath("/");
}

async function requireContributorClient() {
  if (!isSupabaseConfigured()) {
    return { error: "Submissions are unavailable on this server." as const, access: null, supabase: null };
  }
  const access = await requireVerifiedUser();
  if (!access?.userId) {
    return { error: "Verify your email before submitting resources." as const, access: null, supabase: null };
  }
  return { error: null, access, supabase: await createClient() };
}

/**
 * Loads a submission the caller may manage as a contributor.
 *
 * RLS already narrows the read, but it also lets Site Admins see every row.
 * `can_manage_resource()` re-asks the question as the author / team admin, which
 * keeps the contributor routes out of other people's submissions.
 */
async function loadManageableSubmission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  resourceId: string,
): Promise<SubmissionDetail | null> {
  if (!isUuid(resourceId)) {
    return null;
  }

  const { data: manageable, error } = await supabase.rpc("can_manage_resource", {
    p_resource_id: resourceId,
  });
  if (error || !manageable) {
    return null;
  }

  return getSubmissionDetail(resourceId);
}

function parseDraftForm(formData: FormData) {
  return resourceDraftSchema.safeParse({
    resourceType: readString(formData, "resourceType"),
    title: readString(formData, "title"),
    description: readString(formData, "description"),
    categoryId: readString(formData, "categoryId"),
    seasonId: readString(formData, "seasonId"),
    licenseId: readString(formData, "licenseId"),
    teamId: readString(formData, "teamId"),
    tagIds: readStringList(formData, "tagIds"),
  });
}

export async function createResourceDraft(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const gate = await requireContributorClient();
  if (gate.error || !gate.supabase || !gate.access?.userId) {
    return { error: gate.error ?? NOT_ALLOWED };
  }

  const parsed = parseDraftForm(formData);
  if (!parsed.success) {
    return { error: "Fix the highlighted fields.", fieldErrors: firstFieldErrors(parsed.error) };
  }
  const input = parsed.data;
  const supabase = gate.supabase;

  const slug = await uniqueResourceSlug(input.title, async (candidate) => {
    const { data } = await supabase.from("resources").select("id").eq("slug", candidate).maybeSingle();
    return Boolean(data);
  });

  // author_id comes from the session, never from the form.
  const { data: created, error } = await supabase
    .from("resources")
    .insert({
      title: input.title,
      slug,
      resource_type: input.resourceType,
      description: input.description,
      author_id: gate.access.userId,
      team_id: input.teamId,
      category_id: input.categoryId,
      season_id: input.seasonId,
      license_id: input.licenseId,
      status: "DRAFT",
      visibility: "PUBLIC",
    })
    .select("id")
    .single();

  if (error || !created) {
    logger.warn("resources.actions", "Draft creation failed", {
      message: error?.message,
      code: error?.code,
    });
    return { error: publicResourceError(error) };
  }

  const { error: versionError } = await supabase.from("resource_versions").insert({
    resource_id: created.id,
    version_number: 1,
    version_label: "v1",
    created_by: gate.access.userId,
  });

  if (versionError) {
    logger.warn("resources.actions", "Initial version creation failed", {
      message: versionError.message,
    });
    return { error: "The draft was created but its first version could not be started." };
  }

  if (input.tagIds.length > 0) {
    await supabase
      .from("resource_tags")
      .insert(input.tagIds.map((tagId) => ({ resource_id: created.id, tag_id: tagId })));
  }

  revalidateSubmissionViews(created.id);
  redirect(`/my/resources/${created.id}/edit?notice=created`);
}

export async function updateResourceDraft(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const gate = await requireContributorClient();
  if (gate.error || !gate.supabase || !gate.access?.userId) {
    return { error: gate.error ?? NOT_ALLOWED };
  }

  const resourceId = readString(formData, "resourceId");
  const submission = await loadManageableSubmission(gate.supabase, resourceId);
  if (!submission) {
    return { error: "That resource no longer exists." };
  }

  const parsed = parseDraftForm(formData);
  if (!parsed.success) {
    return { error: "Fix the highlighted fields.", fieldErrors: firstFieldErrors(parsed.error) };
  }
  const input = parsed.data;
  const supabase = gate.supabase;

  // Changing the type would orphan the category, so clear it when they differ.
  const typeChanged = input.resourceType !== submission.resourceType;
  const categoryId = typeChanged ? null : input.categoryId;

  // Public URLs must not shift under readers, so the slug is only regenerated
  // while the resource has never been published.
  let slug = submission.slug;
  if (submission.publishedAt === null && input.title !== submission.title) {
    slug = await uniqueResourceSlug(input.title, async (candidate) => {
      if (candidate === submission.slug) {
        return false;
      }
      const { data } = await supabase.from("resources").select("id").eq("slug", candidate).maybeSingle();
      return Boolean(data);
    });
  }

  const { error } = await supabase
    .from("resources")
    .update({
      title: input.title,
      slug,
      resource_type: input.resourceType,
      description: input.description,
      category_id: categoryId,
      season_id: input.seasonId,
      license_id: input.licenseId,
      team_id: input.teamId,
    })
    .eq("id", submission.id);

  if (error) {
    logger.warn("resources.actions", "Draft update failed", {
      message: error.message,
      code: error.code,
    });
    return { error: publicResourceError(error) };
  }

  const nextTags = new Set(input.tagIds);
  const currentTags = new Set(submission.tagIds);
  const removed = [...currentTags].filter((id) => !nextTags.has(id));
  const added = [...nextTags].filter((id) => !currentTags.has(id));

  if (removed.length > 0) {
    await supabase.from("resource_tags").delete().eq("resource_id", submission.id).in("tag_id", removed);
  }
  if (added.length > 0) {
    await supabase
      .from("resource_tags")
      .insert(added.map((tagId) => ({ resource_id: submission.id, tag_id: tagId })));
  }

  revalidateSubmissionViews(submission.id, slug);
  redirect(`/my/resources/${submission.id}/edit?notice=saved`);
}

export async function submitResourceForReview(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const gate = await requireContributorClient();
  if (gate.error || !gate.supabase || !gate.access?.userId) {
    return { error: gate.error ?? NOT_ALLOWED };
  }

  const resourceId = readString(formData, "resourceId");
  if (!isUuid(resourceId)) {
    return { error: "That resource no longer exists." };
  }
  const acknowledged = readString(formData, "rightsAcknowledged") === "on";
  if (!acknowledged) {
    return { error: "Confirm you have the right to share this content under the selected license." };
  }

  const { error } = await gate.supabase.rpc("submit_resource_for_review", {
    p_resource_id: resourceId,
    p_rights_acknowledged: true,
  });

  if (error) {
    logger.warn("resources.actions", "Submission failed", { message: error.message });
    return { error: publicResourceError(error) };
  }

  revalidateSubmissionViews(resourceId);
  redirect(`/my/resources/${resourceId}/edit?notice=submitted`);
}

export async function withdrawResourceSubmission(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const gate = await requireContributorClient();
  if (gate.error || !gate.supabase) {
    return { error: gate.error ?? NOT_ALLOWED };
  }

  const resourceId = readString(formData, "resourceId");
  if (!isUuid(resourceId)) {
    return { error: "That resource no longer exists." };
  }

  const { error } = await gate.supabase.rpc("withdraw_resource_submission", {
    p_resource_id: resourceId,
  });

  if (error) {
    logger.warn("resources.actions", "Withdraw failed", { message: error.message });
    return { error: publicResourceError(error) };
  }

  revalidateSubmissionViews(resourceId);
  redirect(`/my/resources/${resourceId}/edit?notice=withdrawn`);
}

export async function deleteResourceDraft(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const gate = await requireContributorClient();
  if (gate.error || !gate.supabase || !gate.access?.userId) {
    return { error: gate.error ?? NOT_ALLOWED };
  }

  const resourceId = readString(formData, "resourceId");
  const submission = await loadManageableSubmission(gate.supabase, resourceId);
  if (!submission) {
    return { error: "That resource no longer exists." };
  }
  if (submission.status !== "DRAFT" && submission.status !== "CHANGES_REQUESTED") {
    return { error: "Only drafts and resources with requested changes can be deleted." };
  }

  // Storage lives outside the Postgres transaction. Objects are removed first so
  // a failure leaves the resource row (and its recovery path) intact rather than
  // orphaning files no one can reach.
  const byBucket = new Map<string, string[]>();
  for (const file of submission.files) {
    if (!file.storagePath.startsWith(`${submission.id}/`) || file.storagePath.includes("..")) {
      continue;
    }
    const bucket = resolveResourceStorageBucket(file.storageBucket);
    const list = byBucket.get(bucket) ?? [];
    list.push(file.storagePath);
    byBucket.set(bucket, list);
  }

  for (const [bucket, paths] of byBucket) {
    const { error: storageError } = await gate.supabase.storage.from(bucket).remove(paths);
    if (storageError) {
      logger.warn("resources.actions", "Draft storage cleanup failed", {
        message: storageError.message,
        bucket,
      });
      return { error: "The files could not be removed. Try again in a moment." };
    }
  }

  const { error } = await gate.supabase.from("resources").delete().eq("id", submission.id);
  if (error) {
    logger.warn("resources.actions", "Draft delete failed", { message: error.message });
    return { error: publicResourceError(error) };
  }

  revalidateSubmissionViews(submission.id, submission.slug);
  redirect("/my/resources?notice=deleted");
}

export type UploadTicket =
  | { ok: true; bucket: string; path: string; expiresAt: string }
  | { ok: false; error: string };

/**
 * Reserves exactly one object key for exactly one file.
 *
 * The browser never picks a path and never receives directory-wide permission.
 * `create_upload_intent()` decides the key, checks every quota (counting other
 * open reservations so parallel requests cannot oversubscribe), and records a
 * short-lived row. The Storage INSERT policy then requires that row, so an
 * upload outside this flow has nothing to write to.
 *
 * The preflight below is UX only — it produces a better message than a database
 * exception for the common cases. The RPC re-checks all of it.
 */
export async function prepareResourceUpload(input: {
  resourceId: string;
  filename: string;
  sizeBytes: number;
  mimeType?: string | null;
}): Promise<UploadTicket> {
  const gate = await requireContributorClient();
  if (gate.error || !gate.supabase || !gate.access?.userId) {
    return { ok: false, error: gate.error ?? NOT_ALLOWED };
  }

  const submission = await loadManageableSubmission(gate.supabase, input.resourceId);
  if (!submission) {
    return { ok: false, error: "That resource no longer exists." };
  }
  const openDraft = submission.versions.find((version) => version.status === "DRAFT");
  const canUploadFiles =
    submission.status === "DRAFT" ||
    submission.status === "CHANGES_REQUESTED" ||
    (submission.status === "PUBLISHED" && Boolean(openDraft));
  if (!canUploadFiles) {
    return { ok: false, error: "This resource is locked and cannot accept files." };
  }

  const existingVideoBytes = submission.files
    .filter((file) => file.storageBucket === TUTORIAL_VIDEOS_BUCKET)
    .reduce((total, file) => total + (file.sizeBytes ?? 0), 0);

  const rejection = checkUpload({
    filename: input.filename,
    sizeBytes: input.sizeBytes,
    resourceType: submission.resourceType,
    existingFileCount: submission.files.length,
    existingTotalBytes: submission.files.reduce((total, file) => total + (file.sizeBytes ?? 0), 0),
    existingVideoBytes,
    mimeType: input.mimeType,
  });
  if (rejection) {
    return { ok: false, error: UPLOAD_REJECTION_MESSAGES[rejection] };
  }

  const { data, error } = await gate.supabase.rpc("create_upload_intent", {
    p_resource_id: submission.id,
    p_filename: input.filename,
    p_size_bytes: Math.floor(input.sizeBytes),
    p_mime_type: input.mimeType ?? null,
  });

  if (error || !data?.storagePath || !data.bucket) {
    logger.warn("resources.actions", "Upload authorization refused", {
      message: error?.message,
      resourceId: submission.id,
    });
    return { ok: false, error: publicResourceError(error) };
  }

  const bucket = resolveResourceStorageBucket(data.bucket);

  return {
    ok: true,
    bucket,
    path: data.storagePath,
    expiresAt: data.expiresAt,
  };
}

export type TouchUploadResult = { ok: true; expiresAt: string } | { ok: false; error: string };

/**
 * Extends a still-PENDING Upload Intent. The returned `expiresAt` is the
 * database value — the client must not invent a new TTL.
 */
export async function touchResourceUpload(input: { path: string }): Promise<TouchUploadResult> {
  const gate = await requireContributorClient();
  if (gate.error || !gate.supabase) {
    return { ok: false, error: gate.error ?? NOT_ALLOWED };
  }

  const { data, error } = await gate.supabase.rpc("touch_upload_intent", {
    p_storage_path: input.path,
  });
  const expiresAt = authoritativeExpiresAt(data);
  if (error || !expiresAt) {
    return { ok: false, error: error ? publicResourceError(error) : "Your upload authorization expired. Choose the file and upload it again." };
  }
  return { ok: true, expiresAt };
}

export type RegisterFileResult = { ok: true } | { ok: false; error: string };

/**
 * Turns an uploaded object into a registered resource file.
 *
 * `complete_upload_intent()` reads the real row out of `storage.objects`, so the
 * recorded size is what Storage actually holds rather than what the browser
 * claimed, and it burns the reservation in the same transaction. A retry of the
 * same path returns the existing file instead of inserting a duplicate.
 */
export async function registerResourceFile(input: {
  resourceId: string;
  path: string;
}): Promise<RegisterFileResult> {
  const gate = await requireContributorClient();
  if (gate.error || !gate.supabase || !gate.access?.userId) {
    return { ok: false, error: gate.error ?? NOT_ALLOWED };
  }

  const submission = await loadManageableSubmission(gate.supabase, input.resourceId);
  if (!submission?.versionId) {
    return { ok: false, error: "That resource no longer exists." };
  }
  if (!isResourceObjectPath(input.path, { resourceId: submission.id, versionId: submission.versionId })) {
    return { ok: false, error: "That upload location is not valid for this resource." };
  }

  const displayName = safeFilename(input.path.split("/").pop()?.slice(37) ?? "") ?? "upload";
  const { error } = await gate.supabase.rpc("complete_upload_intent", {
    p_storage_path: input.path,
    p_file_type: fileCategoryFor(displayName),
    p_mime_type: mimeTypeFor(displayName),
  });

  if (error) {
    logger.warn("resources.actions", "Upload finalization failed", {
      message: error.message,
      resourceId: submission.id,
    });
    // Do not delete the Storage object here. Transport may have succeeded;
    // complete_upload_intent is idempotent and the UI can retry finalization
    // without re-uploading. Explicit cancel still uses abandonResourceUpload.
    return { ok: false, error: publicResourceError(error) };
  }

  revalidateSubmissionViews(submission.id);
  return { ok: true };
}

/**
 * Delete the Storage object first, then cancel the reservation.
 *
 * Cancelling while the object still exists is refused by the database, so the
 * bytes cannot vanish from quota. The bucket comes from the intent row, never
 * from the caller.
 */
export async function abandonResourceUpload(input: { path: string }): Promise<void> {
  const gate = await requireContributorClient();
  if (gate.error || !gate.supabase) {
    return;
  }

  const { data: intent } = await gate.supabase
    .from("resource_upload_intents")
    .select("storage_path, storage_bucket")
    .eq("storage_path", input.path)
    .maybeSingle();

  const bucket = resolveResourceStorageBucket(intent?.storage_bucket);
  if (intent?.storage_path) {
    const { error: removeError } = await gate.supabase.storage
      .from(bucket)
      .remove([intent.storage_path]);
    if (removeError) {
      logger.warn("resources.actions", "Could not delete unregistered upload", {
        message: removeError.message,
        path: intent.storage_path,
        bucket,
      });
    }
  }

  const { error: cancelError } = await gate.supabase.rpc("cancel_upload_intent", {
    p_storage_path: input.path,
  });
  if (cancelError) {
    logger.warn("resources.actions", "Upload reservation still counting toward quota", {
      message: cancelError.message,
      path: input.path,
    });
  }
}

export async function removeResourceFile(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const gate = await requireContributorClient();
  if (gate.error || !gate.supabase || !gate.access?.userId) {
    return { error: gate.error ?? NOT_ALLOWED };
  }

  const resourceId = readString(formData, "resourceId");
  const fileId = readString(formData, "fileId");
  const submission = await loadManageableSubmission(gate.supabase, resourceId);
  if (!submission || !isUuid(fileId)) {
    return { error: "That file no longer exists." };
  }
  const openDraft = submission.versions.find((version) => version.status === "DRAFT");
  const canChangeFiles =
    submission.status === "DRAFT" ||
    submission.status === "CHANGES_REQUESTED" ||
    (submission.status === "PUBLISHED" && Boolean(openDraft));
  if (!canChangeFiles) {
    return { error: "This resource is locked and its files cannot be changed." };
  }

  const file = submission.files.find((item) => item.id === fileId);
  if (!file) {
    return { error: "That file no longer exists." };
  }
  if (submission.status === "PUBLISHED" && (!openDraft || file.versionId !== openDraft.id)) {
    return { error: "Published version files cannot be changed." };
  }

  const { error } = await gate.supabase
    .from("resource_files")
    .delete()
    .eq("id", fileId)
    .eq("resource_id", submission.id);

  if (error) {
    logger.warn("resources.actions", "File delete failed", { message: error.message });
    return { error: publicResourceError(error) };
  }

  // Best effort: the metadata row is already gone, so a Storage failure leaves an
  // unreferenced object rather than a broken download. Logged for follow-up.
  const { error: storageError } = await gate.supabase.storage
    .from(resolveResourceStorageBucket(file.storageBucket))
    .remove([file.storagePath]);
  if (storageError) {
    logger.warn("resources.actions", "Orphaned storage object after file delete", {
      message: storageError.message,
      path: file.storagePath,
    });
  }

  revalidateSubmissionViews(submission.id);
  redirect(`/my/resources/${submission.id}/edit?notice=file-removed`);
}

