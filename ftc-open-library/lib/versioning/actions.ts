"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { getCurrentAccess } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { EMPTY_RESOURCE_FORM_STATE, type ResourceFormState } from "@/lib/resources/form-state";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils/id";
import { logger } from "@/lib/utils/logger";
import { VERSION_ERRORS } from "@/lib/versioning/messages";
import { normalizeChangelog, normalizeVersionLabel } from "@/lib/versioning/validation";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function requireManagerClient(resourceId: string) {
  if (!isSupabaseConfigured()) {
    return { error: VERSION_ERRORS.unavailable, access: null, supabase: null };
  }
  const access = await getCurrentAccess();
  if (access.level === "guest" || !access.userId) {
    return { error: VERSION_ERRORS.guest, access: null, supabase: null };
  }
  if (access.level === "unverified") {
    return { error: VERSION_ERRORS.unverified, access: null, supabase: null };
  }
  const supabase = await createClient();
  const { data: manageable } = await supabase.rpc("can_manage_resource", {
    p_resource_id: resourceId,
  });
  if (!manageable) {
    return { error: VERSION_ERRORS.unauthorized, access: null, supabase: null };
  }
  return { error: null, access, supabase };
}

function revalidateVersionViews(resourceId: string, slug?: string | null) {
  revalidatePath("/my/resources");
  revalidatePath(`/my/resources/${resourceId}/edit`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/resources");
  revalidatePath("/dashboard/reviews");
  revalidatePath("/dashboard/versions");
  revalidatePath("/admin/review");
  revalidatePath(`/admin/review/${resourceId}`);
  revalidatePath("/admin/versions");
  revalidatePath("/admin");
  revalidatePath("/explore");
  if (slug) {
    revalidatePath(`/resources/${slug}`);
  }
}

export async function startResourceRevision(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const resourceId = readString(formData, "resourceId");
  if (!isUuid(resourceId)) {
    return { error: VERSION_ERRORS.save };
  }

  const label = normalizeVersionLabel(readString(formData, "versionLabel"));
  const changelogResult = normalizeChangelog(readString(formData, "changelog"));
  if (!changelogResult.ok) {
    return {
      error: "Keep the changelog to 4,000 characters or fewer.",
      fieldErrors: { changelog: "Keep the changelog to 4,000 characters or fewer." },
    };
  }

  const gate = await requireManagerClient(resourceId);
  if (gate.error || !gate.supabase) {
    return { error: gate.error ?? VERSION_ERRORS.save };
  }

  const { data, error } = await gate.supabase.rpc("start_resource_revision", {
    p_resource_id: resourceId,
    p_version_label: label,
    p_changelog: changelogResult.changelog,
  });

  if (error || !data) {
    logger.warn("versioning.action", "Failed to start revision", {
      message: error?.message,
      code: error?.code,
    });
    if (error?.message?.includes("revision_open")) {
      return { error: VERSION_ERRORS.open };
    }
    if (error?.message?.includes("not_published")) {
      return { error: VERSION_ERRORS.unpublished };
    }
    if (error?.message?.includes("label_too_long")) {
      return { error: VERSION_ERRORS.label };
    }
    if (error?.message?.includes("changelog_too_long")) {
      return {
        error: "Keep the changelog to 4,000 characters or fewer.",
        fieldErrors: { changelog: "Keep the changelog to 4,000 characters or fewer." },
      };
    }
    return { error: VERSION_ERRORS.save };
  }

  revalidateVersionViews(resourceId);
  redirect(`/my/resources/${resourceId}/edit?notice=revision-created`);
}

export async function submitResourceRevision(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const versionId = readString(formData, "versionId");
  const resourceId = readString(formData, "resourceId");
  if (!isUuid(versionId) || !isUuid(resourceId)) {
    return { error: VERSION_ERRORS.submit };
  }

  const gate = await requireManagerClient(resourceId);
  if (gate.error || !gate.supabase) {
    return { error: gate.error ?? VERSION_ERRORS.submit };
  }

  const { error } = await gate.supabase.rpc("submit_resource_revision", {
    p_version_id: versionId,
  });
  if (error) {
    logger.warn("versioning.action", "Failed to submit revision", {
      message: error.message,
      code: error.code,
    });
    if (error.message.includes("changelog_required")) {
      return { error: VERSION_ERRORS.changelog };
    }
    if (error.message.includes("files_required")) {
      return { error: VERSION_ERRORS.files };
    }
    return { error: VERSION_ERRORS.submit };
  }

  revalidateVersionViews(resourceId);
  redirect(`/my/resources/${resourceId}/edit?notice=revision-submitted`);
}

export async function withdrawResourceRevision(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const versionId = readString(formData, "versionId");
  const resourceId = readString(formData, "resourceId");
  if (!isUuid(versionId) || !isUuid(resourceId)) {
    return { error: VERSION_ERRORS.withdraw };
  }

  const gate = await requireManagerClient(resourceId);
  if (gate.error || !gate.supabase) {
    return { error: gate.error ?? VERSION_ERRORS.withdraw };
  }

  const { error } = await gate.supabase.rpc("withdraw_resource_revision", {
    p_version_id: versionId,
  });
  if (error) {
    logger.warn("versioning.action", "Failed to withdraw revision", {
      message: error.message,
    });
    return { error: VERSION_ERRORS.withdraw };
  }

  revalidateVersionViews(resourceId);
  redirect(`/my/resources/${resourceId}/edit?notice=revision-withdrawn`);
}

export async function updateRevisionChangelog(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const versionId = readString(formData, "versionId");
  const resourceId = readString(formData, "resourceId");
  const label = normalizeVersionLabel(readString(formData, "versionLabel"));
  const changelogResult = normalizeChangelog(readString(formData, "changelog"));
  if (!isUuid(versionId) || !isUuid(resourceId)) {
    return { error: VERSION_ERRORS.save };
  }
  if (!changelogResult.ok) {
    return {
      error: "Keep the changelog to 4,000 characters or fewer.",
      fieldErrors: { changelog: "Keep the changelog to 4,000 characters or fewer." },
    };
  }

  const gate = await requireManagerClient(resourceId);
  if (gate.error || !gate.supabase) {
    return { error: gate.error ?? VERSION_ERRORS.save };
  }

  const { error } = await gate.supabase
    .from("resource_versions")
    .update({ version_label: label, changelog: changelogResult.changelog })
    .eq("id", versionId)
    .eq("status", "DRAFT");

  if (error) {
    logger.warn("versioning.action", "Failed to update revision notes", {
      message: error.message,
    });
    return { error: VERSION_ERRORS.save };
  }

  revalidateVersionViews(resourceId);
  return EMPTY_RESOURCE_FORM_STATE;
}

export async function reviewResourceRevision(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  if (!isSupabaseConfigured()) {
    return { error: VERSION_ERRORS.unavailable };
  }
  const access = await getCurrentAccess();
  if (!canAccessAdmin(access)) {
    return { error: VERSION_ERRORS.moderate };
  }

  const versionId = readString(formData, "versionId");
  const resourceId = readString(formData, "resourceId");
  const decision = readString(formData, "decision");
  const message = readString(formData, "message");
  if (!isUuid(versionId) || !isUuid(resourceId)) {
    return { error: VERSION_ERRORS.moderate };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_resource_revision", {
    p_version_id: versionId,
    p_decision: decision,
    p_message: message || null,
  });

  if (error) {
    logger.warn("versioning.action", "Failed to review revision", {
      message: error.message,
      code: error.code,
    });
    return { error: VERSION_ERRORS.moderate };
  }

  const { data } = await supabase.from("resources").select("slug").eq("id", resourceId).maybeSingle();
  revalidateVersionViews(resourceId, data?.slug);
  revalidatePath(`/admin/versions/${versionId}`);
  const notice =
    decision === "APPROVED"
      ? "revision-approved"
      : decision === "CHANGES_REQUESTED"
        ? "revision-changes"
        : "revision-rejected";
  redirect(`/admin/versions/${versionId}?notice=${notice}`);
}
