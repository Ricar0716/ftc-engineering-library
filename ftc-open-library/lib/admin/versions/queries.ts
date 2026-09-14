import "server-only";

import { requireSiteAdmin } from "@/lib/auth/session";
import { asRelationList, asSingleRelation, getConfiguredServerClient } from "@/lib/db/client";
import { getSubmissionDetail } from "@/lib/db/submissions";
import {
  ADMIN_VERSION_FILTER_STATUS,
  ADMIN_VERSION_PAGE_SIZE,
  changelogSummary,
  type AdminVersionFilter,
} from "@/lib/admin/versions/params";
import { latestPublishedVersion } from "@/lib/versioning/queries";
import { logger } from "@/lib/utils/logger";
import type {
  ResourceReviewEntry,
  ResourceType,
  ResourceVersionStatus,
  ResourceVersionSummary,
  SubmissionDetail,
  SubmissionFile,
} from "@/types/resources";

const LIST_ERROR = "Something went wrong while loading versions for review.";

export type AdminModerationVersion = {
  id: string;
  resourceId: string;
  resourceTitle: string;
  resourceSlug: string;
  resourceType: ResourceType;
  versionNumber: number;
  versionLabel: string | null;
  status: ResourceVersionStatus;
  changelogSummary: string | null;
  contributorName: string | null;
  authorName: string | null;
  teamName: string | null;
  teamNumber: string | null;
  createdAt: string;
  submittedAt: string | null;
  fileCount: number;
  currentVersionLabel: string | null;
  currentVersionNumber: number | null;
};

export type AdminModerationVersionList = {
  items: AdminModerationVersion[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminVersionReview = {
  submission: SubmissionDetail;
  version: ResourceVersionSummary;
  currentPublished: ResourceVersionSummary | null;
  comparisonPublished: ResourceVersionSummary | null;
  submittedFiles: SubmissionFile[];
  comparisonFiles: SubmissionFile[];
  reviews: ResourceReviewEntry[];
};

function emptyList(page: number): AdminModerationVersionList {
  return { items: [], total: 0, page, pageSize: ADMIN_VERSION_PAGE_SIZE };
}

function mapCurrentPublished(
  rows: { resource_id: string; version_number: number; version_label: string | null }[],
): Map<string, { versionNumber: number; versionLabel: string | null }> {
  const latest = new Map<string, { versionNumber: number; versionLabel: string | null }>();
  for (const row of rows) {
    const current = latest.get(row.resource_id);
    if (!current || row.version_number > current.versionNumber) {
      latest.set(row.resource_id, {
        versionNumber: row.version_number,
        versionLabel: row.version_label,
      });
    }
  }
  return latest;
}

async function changeRequestedVersionIds(): Promise<string[] | null> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("resource_reviews")
    .select("version_id")
    .eq("decision", "CHANGES_REQUESTED")
    .not("version_id", "is", null);

  if (error) {
    logger.error("admin.versions", "Failed to load change-request reviews", {
      message: error.message,
    });
    return null;
  }

  return [...new Set((data ?? []).map((row) => row.version_id).filter((id): id is string => Boolean(id)))];
}

/**
 * Later-version moderation list. Site Admins only. First-publish version 1 is
 * not included. No storage paths, emails, or file bytes.
 */
export async function listAdminModerationVersions(
  filter: AdminVersionFilter,
  page = 1,
): Promise<AdminModerationVersionList> {
  const admin = await requireSiteAdmin();
  if (!admin) {
    return emptyList(page);
  }

  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return emptyList(page);
  }

  const current = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const pageSize = ADMIN_VERSION_PAGE_SIZE;
  const from = (current - 1) * pageSize;
  const to = from + pageSize - 1;
  const status = ADMIN_VERSION_FILTER_STATUS[filter];
  const oldestFirst = filter === "pending";

  let changeIds: string[] | null = null;
  if (filter === "changes") {
    changeIds = await changeRequestedVersionIds();
    if (changeIds === null) {
      throw new Error(LIST_ERROR);
    }
    if (changeIds.length === 0) {
      return emptyList(current);
    }
  }

  let request = supabase
    .from("resource_versions")
    .select(
      `
      id,
      version_number,
      version_label,
      changelog,
      status,
      created_at,
      submitted_at,
      created_by,
      creator:profiles!created_by ( username, display_name ),
      resource_files!version_id ( id ),
      resources!inner (
        id,
        title,
        slug,
        resource_type,
        status,
        categories ( name ),
        author:profiles!author_id ( username, display_name ),
        teams ( name, team_number )
      )
    `,
      { count: "exact" },
    )
    .eq("status", status)
    .gt("version_number", 1)
    .eq("resources.status", "PUBLISHED");

  if (changeIds) {
    request = request.in("id", changeIds);
  }

  const { data, error, count } = await request
    .order("submitted_at", { ascending: oldestFirst, nullsFirst: false })
    .range(from, to);

  if (error) {
    logger.error("admin.versions", "Failed to list versions", { message: error.message });
    throw new Error(LIST_ERROR);
  }

  const rows = data ?? [];
  const resourceIds = rows
    .map((row) => asSingleRelation(row.resources)?.id)
    .filter((id): id is string => Boolean(id));

  let currentPublished = new Map<string, { versionNumber: number; versionLabel: string | null }>();
  if (resourceIds.length > 0) {
    const { data: publishedRows, error: publishedError } = await supabase
      .from("resource_versions")
      .select("resource_id, version_number, version_label")
      .in("resource_id", resourceIds)
      .eq("status", "PUBLISHED");

    if (publishedError) {
      logger.warn("admin.versions", "Failed to load current published versions", {
        message: publishedError.message,
      });
    } else {
      currentPublished = mapCurrentPublished(publishedRows ?? []);
    }
  }

  return {
    items: rows.map((row) => {
      const resource = asSingleRelation(row.resources);
      const creator = asSingleRelation(row.creator);
      const author = asSingleRelation(resource?.author);
      const team = asSingleRelation(resource?.teams);
      const currentRelease = resource ? currentPublished.get(resource.id) : undefined;
      return {
        id: row.id,
        resourceId: resource?.id ?? "",
        resourceTitle: resource?.title ?? "Untitled resource",
        resourceSlug: resource?.slug ?? "",
        resourceType: (resource?.resource_type ?? "CAD") as ResourceType,
        versionNumber: row.version_number,
        versionLabel: row.version_label,
        status: row.status as ResourceVersionStatus,
        changelogSummary: changelogSummary(row.changelog),
        contributorName: creator ? (creator.display_name ?? creator.username) : null,
        authorName: author ? (author.display_name ?? author.username) : null,
        teamName: team?.name ?? null,
        teamNumber: team?.team_number ?? null,
        createdAt: row.created_at,
        submittedAt: row.submitted_at,
        fileCount: asRelationList(row.resource_files).length,
        currentVersionLabel: currentRelease?.versionLabel ?? null,
        currentVersionNumber: currentRelease?.versionNumber ?? null,
      };
    }),
    total: count ?? 0,
    page: current,
    pageSize,
  };
}

export async function getAdminVersionReview(versionId: string): Promise<AdminVersionReview | null> {
  const admin = await requireSiteAdmin();
  if (!admin) {
    return null;
  }

  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return null;
  }

  const { data: versionRow, error } = await supabase
    .from("resource_versions")
    .select("id, resource_id, version_number")
    .eq("id", versionId)
    .maybeSingle();

  if (error) {
    logger.error("admin.versions", "Failed to load version", { message: error.message });
    throw new Error(LIST_ERROR);
  }
  if (!versionRow || versionRow.version_number <= 1) {
    return null;
  }

  const submission = await getSubmissionDetail(versionRow.resource_id);
  if (!submission) {
    return null;
  }

  const version = submission.versions.find((item) => item.id === versionId) ?? null;
  if (!version) {
    return null;
  }

  const currentPublished = latestPublishedVersion(submission.versions);
  const comparisonPublished =
    version.status === "PUBLISHED"
      ? (submission.versions.find(
          (item) => item.status === "PUBLISHED" && item.versionNumber < version.versionNumber,
        ) ?? null)
      : currentPublished;

  return {
    submission,
    version,
    currentPublished,
    comparisonPublished,
    submittedFiles: submission.files.filter((file) => file.versionId === version.id),
    comparisonFiles: comparisonPublished
      ? submission.files.filter((file) => file.versionId === comparisonPublished.id)
      : [],
    reviews: submission.reviews.filter((review) => review.versionId === version.id),
  };
}
