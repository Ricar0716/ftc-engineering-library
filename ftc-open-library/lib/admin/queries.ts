import "server-only";

import { requireSiteAdmin } from "@/lib/auth/session";
import { getConfiguredServerClient } from "@/lib/db/client";
import { logger } from "@/lib/utils/logger";

export type AdminOverviewStats = {
  users: number;
  resources: number;
  publishedResources: number;
  pendingReviews: number;
  pendingVersions: number;
  discussions: number;
};

const EMPTY_STATS: AdminOverviewStats = {
  users: 0,
  resources: 0,
  publishedResources: 0,
  pendingReviews: 0,
  pendingVersions: 0,
  discussions: 0,
};

async function countExact(
  request: PromiseLike<{ count: number | null; error: { message: string } | null }>,
  label: string,
): Promise<number> {
  const { count, error } = await request;
  if (error) {
    logger.warn("admin.query", `Failed to count ${label}`, { message: error.message });
    return 0;
  }
  return count ?? 0;
}

/**
 * Aggregated Site Admin overview. Counts only — no profile emails, files, or
 * unpublished resource rows are returned. Callers must already be on an
 * admin-gated page; this also refuses non-admins so the query cannot leak
 * pending totals.
 */
export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  const admin = await requireSiteAdmin();
  if (!admin) {
    return EMPTY_STATS;
  }

  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return EMPTY_STATS;
  }

  const [users, resources, publishedResources, pendingReviews, pendingVersions, discussions] =
    await Promise.all([
      countExact(supabase.from("profiles").select("id", { count: "exact", head: true }), "users"),
      countExact(supabase.from("resources").select("id", { count: "exact", head: true }), "resources"),
      countExact(
        supabase.from("resources").select("id", { count: "exact", head: true }).eq("status", "PUBLISHED"),
        "published resources",
      ),
      countExact(
        supabase
          .from("resources")
          .select("id", { count: "exact", head: true })
          .eq("status", "PENDING_REVIEW"),
        "pending reviews",
      ),
      countExact(
        supabase
          .from("resource_versions")
          .select("id, resources!inner(status)", { count: "exact", head: true })
          .eq("status", "PENDING_REVIEW")
          .gt("version_number", 1)
          .eq("resources.status", "PUBLISHED"),
        "pending versions",
      ),
      countExact(
        supabase.from("comments").select("id", { count: "exact", head: true }).eq("status", "VISIBLE"),
        "discussions",
      ),
    ]);

  return {
    users,
    resources,
    publishedResources,
    pendingReviews,
    pendingVersions,
    discussions,
  };
}
