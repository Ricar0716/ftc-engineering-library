"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSiteAdmin } from "@/lib/auth/session";
import { getSubmissionDetail } from "@/lib/db/submissions";
import { isSupabaseConfigured } from "@/lib/env";
import { publicResourceError } from "@/lib/resources/errors";
import type { ResourceFormState } from "@/lib/resources/form-state";
import { firstFieldErrors, reviewDecisionSchema } from "@/lib/resources/validation";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils/id";
import { logger } from "@/lib/utils/logger";

/**
 * Moderation actions.
 *
 * Authorization is checked twice on purpose: once here so the UI can fail
 * politely, and again inside `public.review_resource()`, which is the boundary a
 * direct Supabase API call would have to cross.
 */
const NOT_ALLOWED = "You do not have permission to review submissions.";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function requireReviewerClient() {
  if (!isSupabaseConfigured()) {
    return { error: "Review is unavailable on this server." as const, supabase: null };
  }
  const admin = await requireSiteAdmin();
  if (!admin) {
    return { error: NOT_ALLOWED, supabase: null };
  }
  return { error: null, supabase: await createClient() };
}

function revalidateReviewViews(resourceId: string, slug?: string) {
  revalidatePath("/admin/review");
  revalidatePath(`/admin/review/${resourceId}`);
  revalidatePath("/admin/resources");
  revalidatePath(`/admin/resources/${resourceId}`);
  revalidatePath("/admin");
  revalidatePath("/my/resources");
  revalidatePath(`/my/resources/${resourceId}/edit`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/resources");
  revalidatePath("/dashboard/drafts");
  revalidatePath("/dashboard/reviews");
  revalidatePath("/dashboard/versions");
  revalidatePath("/explore");
  revalidatePath("/");
  if (slug) {
    revalidatePath(`/resources/${slug}`);
  }
}

export async function reviewResource(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const gate = await requireReviewerClient();
  if (gate.error || !gate.supabase) {
    return { error: gate.error ?? NOT_ALLOWED };
  }

  const parsed = reviewDecisionSchema.safeParse({
    resourceId: readString(formData, "resourceId"),
    decision: readString(formData, "decision"),
    message: readString(formData, "message"),
  });
  if (!parsed.success) {
    return { error: "Fix the highlighted fields.", fieldErrors: firstFieldErrors(parsed.error) };
  }

  const { resourceId, decision, message } = parsed.data;
  const submission = await getSubmissionDetail(resourceId);
  if (!submission) {
    return { error: "That submission no longer exists." };
  }

  // reviewer_id is taken from auth.uid() inside the RPC, never from the form.
  const { error } = await gate.supabase.rpc("review_resource", {
    p_resource_id: resourceId,
    p_decision: decision,
    p_message: message.length > 0 ? message : null,
  });

  if (error) {
    logger.warn("admin.review", "Review decision failed", { message: error.message });
    return { error: publicResourceError(error) };
  }

  revalidateReviewViews(resourceId, submission.slug);

  const notice =
    decision === "APPROVED" ? "approved" : decision === "REJECTED" ? "rejected" : "changes-requested";
  redirect(`/admin/resources/${resourceId}?notice=${notice}`);
}

export async function setResourceArchived(
  _prev: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const gate = await requireReviewerClient();
  if (gate.error || !gate.supabase) {
    return { error: gate.error ?? NOT_ALLOWED };
  }

  const resourceId = readString(formData, "resourceId");
  if (!isUuid(resourceId)) {
    return { error: "That resource no longer exists." };
  }
  const archived = readString(formData, "archived") === "true";

  const submission = await getSubmissionDetail(resourceId);
  if (!submission) {
    return { error: "That resource no longer exists." };
  }

  const { error } = await gate.supabase.rpc("set_resource_archived", {
    p_resource_id: resourceId,
    p_archived: archived,
  });

  if (error) {
    logger.warn("admin.review", "Archive toggle failed", { message: error.message });
    return { error: publicResourceError(error) };
  }

  revalidateReviewViews(resourceId, submission.slug);
  redirect(`/admin/review/${resourceId}?notice=${archived ? "archived" : "restored"}`);
}
