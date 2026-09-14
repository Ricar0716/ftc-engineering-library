"use server";

import { revalidatePath } from "next/cache";
import { canFavorite } from "@/lib/auth/permissions";
import { getCurrentAccess } from "@/lib/auth/session";
import { FAVORITE_ERRORS } from "@/lib/favorites/messages";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils/id";
import { logger } from "@/lib/utils/logger";

export type FavoriteActionResult = { ok: true } | { ok: false; error: string };

async function requireFavoriteClient(): Promise<
  | { error: string; access: null; supabase: null }
  | {
      error: null;
      access: Awaited<ReturnType<typeof getCurrentAccess>>;
      supabase: Awaited<ReturnType<typeof createClient>>;
    }
> {
  if (!isSupabaseConfigured()) {
    return { error: FAVORITE_ERRORS.unavailable, access: null, supabase: null };
  }

  const access = await getCurrentAccess();
  if (access.level === "guest" || !access.userId) {
    return { error: FAVORITE_ERRORS.guest, access: null, supabase: null };
  }
  if (!canFavorite(access)) {
    return { error: FAVORITE_ERRORS.unverified, access: null, supabase: null };
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
    logger.warn("favorites.action", "Failed to load resource for favorite", {
      message: error.message,
    });
    return null;
  }
  if (!data || data.status !== "PUBLISHED" || data.visibility !== "PUBLIC") {
    return null;
  }
  return data.slug;
}

function revalidateFavoriteViews(slug: string | null) {
  revalidatePath("/dashboard/favorites");
  revalidatePath("/dashboard");
  if (slug) {
    revalidatePath(`/resources/${slug}`);
  }
}

export async function addFavorite(resourceId: string): Promise<FavoriteActionResult> {
  if (!isUuid(resourceId)) {
    return { ok: false, error: FAVORITE_ERRORS.save };
  }

  const gate = await requireFavoriteClient();
  if (gate.error || !gate.access?.userId) {
    return { ok: false, error: gate.error ?? FAVORITE_ERRORS.save };
  }

  const slug = await publishedPublicSlug(gate.supabase, resourceId);
  if (!slug) {
    return { ok: false, error: FAVORITE_ERRORS.unpublished };
  }

  const { error } = await gate.supabase.from("favorites").insert({
    user_id: gate.access.userId,
    resource_id: resourceId,
  });

  if (error) {
    if (error.code === "23505") {
      revalidateFavoriteViews(slug);
      return { ok: true };
    }
    logger.warn("favorites.action", "Failed to add favorite", {
      message: error.message,
      code: error.code,
    });
    return { ok: false, error: FAVORITE_ERRORS.save };
  }

  revalidateFavoriteViews(slug);
  return { ok: true };
}

export async function removeFavorite(resourceId: string): Promise<FavoriteActionResult> {
  if (!isUuid(resourceId)) {
    return { ok: false, error: FAVORITE_ERRORS.remove };
  }

  const gate = await requireFavoriteClient();
  if (gate.error || !gate.access?.userId) {
    return { ok: false, error: gate.error ?? FAVORITE_ERRORS.remove };
  }

  const { error } = await gate.supabase
    .from("favorites")
    .delete()
    .eq("user_id", gate.access.userId)
    .eq("resource_id", resourceId);

  if (error) {
    logger.warn("favorites.action", "Failed to remove favorite", {
      message: error.message,
      code: error.code,
    });
    return { ok: false, error: FAVORITE_ERRORS.remove };
  }

  const slug = await publishedPublicSlug(gate.supabase, resourceId);
  revalidateFavoriteViews(slug);
  return { ok: true };
}
