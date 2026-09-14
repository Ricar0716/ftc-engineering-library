import { canFavorite } from "@/lib/auth/permissions";
import { getCurrentAccess } from "@/lib/auth/session";
import { getPublishedSummariesByIds, type PublishedResourceList } from "@/lib/db/resources";
import { getConfiguredServerClient } from "@/lib/db/client";
import { isUuid } from "@/lib/utils/id";
import { logger } from "@/lib/utils/logger";

export const FAVORITES_PAGE_SIZE = 20;

function emptyList(page: number, pageSize: number): PublishedResourceList {
  return { items: [], total: 0, page, pageSize };
}

export async function isResourceFavorited(resourceId: string): Promise<boolean> {
  if (!isUuid(resourceId)) {
    return false;
  }

  const access = await getCurrentAccess();
  if (!canFavorite(access) || !access.userId) {
    return false;
  }

  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase
    .from("favorites")
    .select("resource_id")
    .eq("user_id", access.userId)
    .eq("resource_id", resourceId)
    .maybeSingle();

  if (error) {
    logger.warn("favorites.query", "Failed to read favorite state", { message: error.message });
    return false;
  }

  return Boolean(data);
}

export async function countOwnPublishedFavorites(): Promise<number> {
  const access = await getCurrentAccess();
  if (!canFavorite(access) || !access.userId) {
    return 0;
  }

  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return 0;
  }

  const { data, error } = await supabase.rpc("count_own_published_favorites");
  if (error) {
    logger.warn("favorites.query", "Failed to count favorites", { message: error.message });
    return 0;
  }

  return typeof data === "number" && Number.isFinite(data) ? data : 0;
}

export async function listOwnPublishedFavorites(page = 1): Promise<PublishedResourceList> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const pageSize = FAVORITES_PAGE_SIZE;
  const access = await getCurrentAccess();
  if (!canFavorite(access) || !access.userId) {
    return emptyList(safePage, pageSize);
  }

  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return emptyList(safePage, pageSize);
  }

  const offset = (safePage - 1) * pageSize;
  const [rows, total] = await Promise.all([
    supabase.rpc("list_own_published_favorites", { p_limit: pageSize, p_offset: offset }),
    supabase.rpc("count_own_published_favorites"),
  ]);

  if (rows.error) {
    logger.error("favorites.query", "Failed to list favorites", { message: rows.error.message });
    throw new Error("Something went wrong while loading saved resources.");
  }
  if (total.error) {
    logger.error("favorites.query", "Failed to count favorites", { message: total.error.message });
    throw new Error("Something went wrong while loading saved resources.");
  }

  const ids = (rows.data ?? []).map((row) => row.resource_id);
  const items = await getPublishedSummariesByIds(ids);
  const count = typeof total.data === "number" ? total.data : 0;

  return {
    items,
    total: count,
    page: safePage,
    pageSize,
  };
}
