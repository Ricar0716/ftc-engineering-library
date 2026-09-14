"use server";

import { revalidatePath } from "next/cache";
import { canAccessAdmin, canDiscuss } from "@/lib/auth/permissions";
import { getCurrentAccess } from "@/lib/auth/session";
import { isDiscussionEnabled } from "@/lib/config/features";
import { DISCUSSION_ERRORS } from "@/lib/discussion/messages";
import { normalizeDiscussionBody } from "@/lib/discussion/validation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils/id";
import { logger } from "@/lib/utils/logger";

export type DiscussionActionResult = { ok: true } | { ok: false; error: string };

type DiscussionClient =
  | { error: string; access: null; supabase: null }
  | {
      error: null;
      access: Awaited<ReturnType<typeof getCurrentAccess>>;
      supabase: Awaited<ReturnType<typeof createClient>>;
    };

async function requireDiscussionClient(): Promise<DiscussionClient> {
  if (!isSupabaseConfigured()) {
    return { error: DISCUSSION_ERRORS.unavailable, access: null, supabase: null };
  }

  const access = await getCurrentAccess();
  if (access.level === "guest" || !access.userId) {
    return { error: DISCUSSION_ERRORS.guest, access: null, supabase: null };
  }
  if (!canDiscuss(access)) {
    return { error: DISCUSSION_ERRORS.unverified, access: null, supabase: null };
  }

  return { error: null, access, supabase: await createClient() };
}

async function publishedPublicSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  resourceId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("resources")
    .select("slug, status, visibility")
    .eq("id", resourceId)
    .maybeSingle();

  if (error) {
    logger.warn("discussion.action", "Failed to load resource for discussion", {
      message: error.message,
    });
    return null;
  }
  if (!data || data.status !== "PUBLISHED" || data.visibility !== "PUBLIC") {
    return null;
  }
  return data.slug;
}

function revalidateDiscussion(slug: string | null) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/discussions");
  if (slug) {
    revalidatePath(`/resources/${slug}`);
  }
}

function mapWriteError(code: string | undefined, fallback: string): string {
  if (code === "23514") {
    return DISCUSSION_ERRORS.tooLong;
  }
  if (code === "42501") {
    return fallback;
  }
  return fallback;
}

export async function createDiscussion(input: {
  resourceId: string;
  body: string;
  parentId?: string | null;
}): Promise<DiscussionActionResult> {
  if (!isDiscussionEnabled()) {
    return { ok: false, error: DISCUSSION_ERRORS.disabled };
  }
  if (!isUuid(input.resourceId) || (input.parentId && !isUuid(input.parentId))) {
    return { ok: false, error: DISCUSSION_ERRORS.save };
  }

  const normalized = normalizeDiscussionBody(input.body);
  if (!normalized.ok) {
    return {
      ok: false,
      error: normalized.error === "too_long" ? DISCUSSION_ERRORS.tooLong : DISCUSSION_ERRORS.empty,
    };
  }

  const gate = await requireDiscussionClient();
  if (gate.error || !gate.access?.userId) {
    return { ok: false, error: gate.error ?? DISCUSSION_ERRORS.save };
  }

  const slug = await publishedPublicSlug(gate.supabase, input.resourceId);
  if (!slug) {
    return { ok: false, error: DISCUSSION_ERRORS.unpublished };
  }

  const { error } = await gate.supabase.from("comments").insert({
    resource_id: input.resourceId,
    user_id: gate.access.userId,
    parent_id: input.parentId ?? null,
    body: normalized.body,
    status: "VISIBLE",
  });

  if (error) {
    logger.warn("discussion.action", "Failed to create discussion", {
      message: error.message,
      code: error.code,
    });
    return { ok: false, error: mapWriteError(error.code, DISCUSSION_ERRORS.save) };
  }

  revalidateDiscussion(slug);
  return { ok: true };
}

export async function updateDiscussion(input: {
  id: string;
  body: string;
}): Promise<DiscussionActionResult> {
  if (!isDiscussionEnabled()) {
    return { ok: false, error: DISCUSSION_ERRORS.disabled };
  }
  if (!isUuid(input.id)) {
    return { ok: false, error: DISCUSSION_ERRORS.update };
  }

  const normalized = normalizeDiscussionBody(input.body);
  if (!normalized.ok) {
    return {
      ok: false,
      error: normalized.error === "too_long" ? DISCUSSION_ERRORS.tooLong : DISCUSSION_ERRORS.empty,
    };
  }

  const gate = await requireDiscussionClient();
  if (gate.error || !gate.access?.userId) {
    return { ok: false, error: gate.error ?? DISCUSSION_ERRORS.update };
  }

  const { data, error } = await gate.supabase
    .from("comments")
    .update({ body: normalized.body })
    .eq("id", input.id)
    .eq("user_id", gate.access.userId)
    .eq("status", "VISIBLE")
    .select("resource_id")
    .maybeSingle();

  if (error) {
    logger.warn("discussion.action", "Failed to update discussion", {
      message: error.message,
      code: error.code,
    });
    return { ok: false, error: mapWriteError(error.code, DISCUSSION_ERRORS.update) };
  }
  if (!data) {
    return { ok: false, error: DISCUSSION_ERRORS.update };
  }

  const slug = await publishedPublicSlug(gate.supabase, data.resource_id);
  revalidateDiscussion(slug);
  return { ok: true };
}

export async function hideDiscussion(id: string): Promise<DiscussionActionResult> {
  return setDiscussionStatus(id, "HIDDEN");
}

export async function restoreDiscussion(id: string): Promise<DiscussionActionResult> {
  return setDiscussionStatus(id, "VISIBLE");
}

async function setDiscussionStatus(
  id: string,
  status: "VISIBLE" | "HIDDEN",
): Promise<DiscussionActionResult> {
  if (!isUuid(id)) {
    return { ok: false, error: DISCUSSION_ERRORS.moderate };
  }

  if (!isSupabaseConfigured()) {
    return { ok: false, error: DISCUSSION_ERRORS.unavailable };
  }

  const access = await getCurrentAccess();
  if (!canAccessAdmin(access) || !access.userId) {
    return { ok: false, error: DISCUSSION_ERRORS.moderate };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .update({ status })
    .eq("id", id)
    .select("resource_id")
    .maybeSingle();

  if (error) {
    logger.warn("discussion.action", "Failed to moderate discussion", {
      message: error.message,
      code: error.code,
    });
    return { ok: false, error: DISCUSSION_ERRORS.moderate };
  }
  if (!data) {
    return { ok: false, error: DISCUSSION_ERRORS.moderate };
  }

  const slug = await publishedPublicSlug(supabase, data.resource_id);
  revalidateDiscussion(slug);
  if (!slug) {
    revalidatePath(`/admin/review/${data.resource_id}`);
  }
  return { ok: true };
}
