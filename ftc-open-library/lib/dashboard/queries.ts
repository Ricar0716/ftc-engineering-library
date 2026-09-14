import { asRelationList, asSingleRelation, getConfiguredServerClient } from "@/lib/db/client";
import { getProfileById } from "@/lib/db/profiles";
import {
  countPublishedResources,
  listPublishedResources,
  type PublishedResourceList,
} from "@/lib/db/resources";
import { countOwnPublishedFavorites } from "@/lib/favorites/queries";
import {
  DASHBOARD_RESOURCE_FILTER_STATUSES,
  type DashboardResourceFilter,
} from "@/lib/dashboard/params";
import { DASHBOARD_PAGE_SIZE } from "@/lib/dashboard/nav";
import { logger } from "@/lib/utils/logger";
import type { ResourceStatus, ResourceType, ResourceVersionStatus } from "@/types/resources";
import type { PublicUserProfile, TeamMemberRole } from "@/types/users";

const DASHBOARD_ERROR = "Something went wrong while loading your dashboard.";

export type DashboardCounts = {
  published: number;
  drafts: number;
  pendingReviews: number;
  saved: number;
  questions: number;
  replies: number;
};

export type DashboardResourceRow = {
  id: string;
  title: string;
  slug: string;
  resourceType: ResourceType;
  status: ResourceStatus;
  categoryName: string | null;
  updatedAt: string;
  submittedAt: string | null;
  publishedAt: string | null;
  fileCount: number;
};

export type DashboardResourceList = {
  items: DashboardResourceRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type DashboardVersionRow = {
  id: string;
  resourceId: string;
  resourceTitle: string;
  resourceSlug: string;
  resourceStatus: ResourceStatus;
  versionNumber: number;
  versionLabel: string | null;
  status: ResourceVersionStatus;
  createdAt: string;
  submittedAt: string | null;
  releasedAt: string | null;
};

export type DashboardVersionList = {
  items: DashboardVersionRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type DashboardDiscussionRow = {
  id: string;
  resourceId: string;
  resourceTitle: string;
  resourceSlug: string;
  parentId: string | null;
  body: string;
  createdAt: string;
};

export type DashboardDiscussionList = {
  items: DashboardDiscussionRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type DashboardTeamMembership = {
  teamId: string;
  teamName: string;
  teamNumber: string;
  role: TeamMemberRole;
  publishedCount: number;
};

function emptyResourceList(page: number, pageSize: number): DashboardResourceList {
  return { items: [], total: 0, page, pageSize };
}

function emptyVersionList(page: number, pageSize: number): DashboardVersionList {
  return { items: [], total: 0, page, pageSize };
}

function emptyDiscussionList(page: number, pageSize: number): DashboardDiscussionList {
  return { items: [], total: 0, page, pageSize };
}

function safePage(page: number): number {
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

async function countOwnResources(
  userId: string,
  statuses: readonly ResourceStatus[] | null,
): Promise<number> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return 0;
  }

  let request = supabase
    .from("resources")
    .select("id", { count: "exact", head: true })
    .eq("author_id", userId);
  if (statuses) {
    request = request.in("status", [...statuses]);
  }

  const { count, error } = await request;
  if (error) {
    logger.warn("dashboard.query", "Failed to count resources", { message: error.message });
    return 0;
  }
  return count ?? 0;
}

async function countOwnPendingRevisions(userId: string): Promise<number> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return 0;
  }

  const { count, error } = await supabase
    .from("resource_versions")
    .select("id, resources!inner(author_id)", { count: "exact", head: true })
    .eq("status", "PENDING_REVIEW")
    .gt("version_number", 1)
    .eq("resources.author_id", userId);

  if (error) {
    logger.warn("dashboard.query", "Failed to count pending versions", { message: error.message });
    return 0;
  }
  return count ?? 0;
}

async function countOwnComments(userId: string, roots: boolean): Promise<number> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return 0;
  }

  let request = supabase
    .from("comments")
    .select("id, resources!inner(status, visibility)", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "VISIBLE")
    .eq("resources.status", "PUBLISHED")
    .eq("resources.visibility", "PUBLIC");
  request = roots ? request.is("parent_id", null) : request.not("parent_id", "is", null);

  const { count, error } = await request;
  if (error) {
    logger.warn("dashboard.query", "Failed to count discussions", { message: error.message });
    return 0;
  }
  return count ?? 0;
}

export async function getDashboardCounts(userId: string): Promise<DashboardCounts> {
  const [published, drafts, pendingResources, pendingRevisions, saved, questions, replies] =
    await Promise.all([
      countOwnResources(userId, ["PUBLISHED"]),
      countOwnResources(userId, ["DRAFT", "CHANGES_REQUESTED"]),
      countOwnResources(userId, ["PENDING_REVIEW"]),
      countOwnPendingRevisions(userId),
      countOwnPublishedFavorites(),
      countOwnComments(userId, true),
      countOwnComments(userId, false),
    ]);

  return {
    published,
    drafts,
    pendingReviews: pendingResources + pendingRevisions,
    saved,
    questions,
    replies,
  };
}

export async function listOwnDashboardResources(
  userId: string,
  filter: DashboardResourceFilter,
  page = 1,
): Promise<DashboardResourceList> {
  const current = safePage(page);
  const pageSize = DASHBOARD_PAGE_SIZE;
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return emptyResourceList(current, pageSize);
  }

  const statuses = DASHBOARD_RESOURCE_FILTER_STATUSES[filter];
  const from = (current - 1) * pageSize;
  const to = from + pageSize - 1;

  let request = supabase
    .from("resources")
    .select(
      `
      id,
      title,
      slug,
      resource_type,
      status,
      updated_at,
      submitted_at,
      published_at,
      categories ( name ),
      resource_files ( id )
    `,
      { count: "exact" },
    )
    .eq("author_id", userId)
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (statuses) {
    request = request.in("status", [...statuses]);
  }

  const { data, error, count } = await request;
  if (error) {
    logger.error("dashboard.query", "Failed to list resources", { message: error.message });
    throw new Error(DASHBOARD_ERROR);
  }

  return {
    items: (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      resourceType: row.resource_type as ResourceType,
      status: row.status as ResourceStatus,
      categoryName: asSingleRelation(row.categories)?.name ?? null,
      updatedAt: row.updated_at,
      submittedAt: row.submitted_at,
      publishedAt: row.published_at,
      fileCount: asRelationList(row.resource_files).length,
    })),
    total: count ?? 0,
    page: current,
    pageSize,
  };
}

export async function listOwnPublishedResourceCards(
  userId: string,
  page = 1,
  pageSize = DASHBOARD_PAGE_SIZE,
): Promise<PublishedResourceList> {
  return listPublishedResources({
    authorId: userId,
    sort: "latest",
    page,
    pageSize,
  });
}

export async function listOwnDashboardVersions(
  userId: string,
  page = 1,
): Promise<DashboardVersionList> {
  const current = safePage(page);
  const pageSize = DASHBOARD_PAGE_SIZE;
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return emptyVersionList(current, pageSize);
  }

  const from = (current - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("resource_versions")
    .select(
      `
      id,
      version_number,
      version_label,
      status,
      created_at,
      submitted_at,
      released_at,
      resources!inner (
        id,
        title,
        slug,
        status,
        author_id
      )
    `,
      { count: "exact" },
    )
    .eq("resources.author_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    logger.error("dashboard.query", "Failed to list versions", { message: error.message });
    throw new Error(DASHBOARD_ERROR);
  }

  const items: DashboardVersionRow[] = [];
  for (const row of data ?? []) {
    const resource = asSingleRelation(row.resources);
    if (!resource || resource.author_id !== userId) {
      continue;
    }
    items.push({
      id: row.id,
      resourceId: resource.id,
      resourceTitle: resource.title,
      resourceSlug: resource.slug,
      resourceStatus: resource.status as ResourceStatus,
      versionNumber: row.version_number,
      versionLabel: row.version_label,
      status: row.status as ResourceVersionStatus,
      createdAt: row.created_at,
      submittedAt: row.submitted_at,
      releasedAt: row.released_at,
    });
  }

  return { items, total: count ?? 0, page: current, pageSize };
}

export async function listOwnPendingRevisionRows(
  userId: string,
): Promise<DashboardVersionRow[]> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("resource_versions")
    .select(
      `
      id,
      version_number,
      version_label,
      status,
      created_at,
      submitted_at,
      released_at,
      resources!inner (
        id,
        title,
        slug,
        status,
        author_id
      )
    `,
    )
    .eq("status", "PENDING_REVIEW")
    .gt("version_number", 1)
    .eq("resources.author_id", userId)
    .order("created_at", { ascending: false })
    .limit(DASHBOARD_PAGE_SIZE);

  if (error) {
    logger.error("dashboard.query", "Failed to list pending revisions", { message: error.message });
    throw new Error(DASHBOARD_ERROR);
  }

  const items: DashboardVersionRow[] = [];
  for (const row of data ?? []) {
    const resource = asSingleRelation(row.resources);
    if (!resource || resource.author_id !== userId) {
      continue;
    }
    items.push({
      id: row.id,
      resourceId: resource.id,
      resourceTitle: resource.title,
      resourceSlug: resource.slug,
      resourceStatus: resource.status as ResourceStatus,
      versionNumber: row.version_number,
      versionLabel: row.version_label,
      status: row.status as ResourceVersionStatus,
      createdAt: row.created_at,
      submittedAt: row.submitted_at,
      releasedAt: row.released_at,
    });
  }
  return items;
}

export async function listOwnDashboardDiscussions(
  userId: string,
  page = 1,
): Promise<DashboardDiscussionList> {
  const current = safePage(page);
  const pageSize = DASHBOARD_PAGE_SIZE;
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return emptyDiscussionList(current, pageSize);
  }

  const from = (current - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("comments")
    .select(
      `
      id,
      resource_id,
      parent_id,
      body,
      created_at,
      resources!inner (
        title,
        slug,
        status,
        visibility
      )
    `,
      { count: "exact" },
    )
    .eq("user_id", userId)
    .eq("status", "VISIBLE")
    .eq("resources.status", "PUBLISHED")
    .eq("resources.visibility", "PUBLIC")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    logger.error("dashboard.query", "Failed to list discussions", { message: error.message });
    throw new Error(DASHBOARD_ERROR);
  }

  return {
    items: (data ?? []).map((row) => {
      const resource = asSingleRelation(row.resources);
      return {
        id: row.id,
        resourceId: row.resource_id,
        resourceTitle: resource?.title ?? "Resource",
        resourceSlug: resource?.slug ?? "",
        parentId: row.parent_id,
        body: row.body,
        createdAt: row.created_at,
      };
    }),
    total: count ?? 0,
    page: current,
    pageSize,
  };
}

export async function listOwnDashboardTeams(userId: string): Promise<DashboardTeamMembership[]> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("team_members")
    .select("role, team_id, teams ( id, name, team_number )")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    logger.warn("dashboard.query", "Failed to list teams", { message: error.message });
    return [];
  }

  const memberships: DashboardTeamMembership[] = [];
  for (const row of data ?? []) {
    const team = asSingleRelation(row.teams);
    if (!team) {
      continue;
    }
    memberships.push({
      teamId: team.id,
      teamName: team.name,
      teamNumber: team.team_number,
      role: row.role as TeamMemberRole,
      publishedCount: 0,
    });
  }

  if (memberships.length === 0) {
    return [];
  }

  return Promise.all(
    memberships.map(async (item) => {
      const counts = await countPublishedResources({ teamId: item.teamId });
      return { ...item, publishedCount: counts.total };
    }),
  );
}

export async function getOwnDashboardProfile(userId: string): Promise<PublicUserProfile | null> {
  return getProfileById(userId);
}
