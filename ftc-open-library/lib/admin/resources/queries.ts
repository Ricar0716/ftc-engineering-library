import "server-only";

import { requireSiteAdmin } from "@/lib/auth/session";
import { asRelationList, asSingleRelation, getConfiguredServerClient } from "@/lib/db/client";
import {
  ADMIN_RESOURCE_FILTER_STATUS,
  ADMIN_RESOURCE_PAGE_SIZE,
  type AdminResourceFilter,
} from "@/lib/admin/resources/params";
import { logger } from "@/lib/utils/logger";
import type { ResourceStatus, ResourceType } from "@/types/resources";

const LIST_ERROR = "Something went wrong while loading resources for review.";

export type AdminModerationResource = {
  id: string;
  title: string;
  resourceType: ResourceType;
  status: ResourceStatus;
  categoryName: string | null;
  contributorName: string | null;
  teamName: string | null;
  teamNumber: string | null;
  submittedAt: string | null;
  fileCount: number;
};

export type AdminModerationResourceList = {
  items: AdminModerationResource[];
  total: number;
  page: number;
  pageSize: number;
};

function emptyList(page: number): AdminModerationResourceList {
  return { items: [], total: 0, page, pageSize: ADMIN_RESOURCE_PAGE_SIZE };
}

/**
 * First-publish moderation list. Site Admins only. Counts and titles for the
 * filtered status — no storage paths, emails, or file bytes.
 */
export async function listAdminModerationResources(
  filter: AdminResourceFilter,
  page = 1,
): Promise<AdminModerationResourceList> {
  const admin = await requireSiteAdmin();
  if (!admin) {
    return emptyList(page);
  }

  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return emptyList(page);
  }

  const current = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const pageSize = ADMIN_RESOURCE_PAGE_SIZE;
  const from = (current - 1) * pageSize;
  const to = from + pageSize - 1;
  const status = ADMIN_RESOURCE_FILTER_STATUS[filter];

  const oldestFirst = filter === "pending";
  const { data, error, count } = await supabase
    .from("resources")
    .select(
      `
      id,
      title,
      resource_type,
      status,
      submitted_at,
      categories ( name ),
      author:profiles!author_id ( username, display_name ),
      teams ( name, team_number ),
      resource_files ( id )
    `,
      { count: "exact" },
    )
    .eq("status", status)
    .order("submitted_at", { ascending: oldestFirst, nullsFirst: false })
    .range(from, to);

  if (error) {
    logger.error("admin.resources", "Failed to list resources", { message: error.message });
    throw new Error(LIST_ERROR);
  }

  return {
    items: (data ?? []).map((row) => {
      const author = asSingleRelation(row.author);
      const team = asSingleRelation(row.teams);
      return {
        id: row.id,
        title: row.title,
        resourceType: row.resource_type as ResourceType,
        status: row.status as ResourceStatus,
        categoryName: asSingleRelation(row.categories)?.name ?? null,
        contributorName: author ? (author.display_name ?? author.username) : null,
        teamName: team?.name ?? null,
        teamNumber: team?.team_number ?? null,
        submittedAt: row.submitted_at,
        fileCount: asRelationList(row.resource_files).length,
      };
    }),
    total: count ?? 0,
    page: current,
    pageSize,
  };
}
