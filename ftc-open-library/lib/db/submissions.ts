import { asRelationList, asSingleRelation, getConfiguredServerClient } from "@/lib/db/client";
import { mapResourceVersion } from "@/lib/db/mappers";
import { getCategoryBreadcrumb } from "@/lib/categories/tree";
import { listCategories } from "@/lib/db/catalog";
import { resolveResourceStorageBucket } from "@/lib/downloads/path";
import { logger } from "@/lib/utils/logger";
import type {
  ResourceReviewEntry,
  ResourceStatus,
  ResourceType,
  SubmissionDetail,
  SubmissionSummary,
} from "@/types/resources";

/**
 * Private submission reads.
 *
 * Every query runs through the request-scoped Supabase client, so RLS decides
 * what a caller may see: contributors get their own rows, Site Admins get rows
 * they moderate, and everyone else gets nothing. No service-role client is used
 * here.
 */
const SUBMISSION_ERROR = "Something went wrong while loading submissions.";

type ReviewRow = {
  id: string;
  version_id?: string | null;
  decision: ResourceReviewEntry["decision"];
  message: string | null;
  created_at: string;
  reviewer?:
    | { username: string; display_name: string | null }
    | { username: string; display_name: string | null }[]
    | null;
};

function mapReview(row: ReviewRow): ResourceReviewEntry {
  const reviewer = asSingleRelation(row.reviewer);
  return {
    id: row.id,
    versionId: row.version_id ?? null,
    decision: row.decision,
    message: row.message,
    createdAt: row.created_at,
    reviewerName: reviewer ? (reviewer.display_name ?? reviewer.username) : null,
  };
}

export async function listMySubmissions(userId: string): Promise<SubmissionSummary[]> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
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
    )
    .eq("author_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    logger.error("db.submissions", "Failed to list submissions", {
      message: error.message,
      code: error.code,
    });
    throw new Error(SUBMISSION_ERROR);
  }

  const rows = data ?? [];
  const latestReviews = await latestReviewByResource(rows.map((row) => row.id));

  return rows.map((row) => ({
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
    latestReview: latestReviews.get(row.id) ?? null,
  }));
}

async function latestReviewByResource(
  resourceIds: string[],
): Promise<Map<string, ResourceReviewEntry>> {
  const latest = new Map<string, ResourceReviewEntry>();
  if (resourceIds.length === 0) {
    return latest;
  }

  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return latest;
  }

  const { data, error } = await supabase
    .from("resource_reviews")
    .select(
      "id, resource_id, version_id, decision, message, created_at, reviewer:profiles!reviewer_id ( username, display_name )",
    )
    .in("resource_id", resourceIds)
    .order("created_at", { ascending: false });

  if (error) {
    logger.warn("db.submissions", "Failed to load review history", { message: error.message });
    return latest;
  }

  for (const row of data ?? []) {
    if (!latest.has(row.resource_id)) {
      latest.set(row.resource_id, mapReview(row));
    }
  }

  return latest;
}

export async function getSubmissionDetail(resourceId: string): Promise<SubmissionDetail | null> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("resources")
    .select(
      `
      id,
      title,
      slug,
      resource_type,
      description,
      status,
      visibility,
      category_id,
      season_id,
      license_id,
      team_id,
      author_id,
      rights_acknowledged_at,
      created_at,
      updated_at,
      submitted_at,
      reviewed_at,
      published_at,
      author:profiles!author_id ( username, display_name ),
      teams ( name, team_number ),
      licenses ( name ),
      resource_tags ( tag_id ),
      resource_versions (
        id,
        version_number,
        version_label,
        changelog,
        status,
        released_at,
        created_at,
        submitted_at,
        created_by,
        creator:profiles!created_by ( username, display_name )
      ),
      resource_files ( id, version_id, filename, file_type, mime_type, size_bytes, storage_path, storage_bucket, created_at )
    `,
    )
    .eq("id", resourceId)
    .maybeSingle();

  if (error) {
    logger.error("db.submissions", "Failed to load submission", {
      message: error.message,
      code: error.code,
    });
    throw new Error(SUBMISSION_ERROR);
  }
  if (!data) {
    return null;
  }

  const author = asSingleRelation(data.author);
  const resourceType = data.resource_type as ResourceType;
  const taxonomy = data.category_id ? await listCategories(resourceType) : [];
  const versions = asRelationList(data.resource_versions)
    .map((row) =>
      mapResourceVersion({
        ...row,
        creator: asSingleRelation(row.creator),
      }),
    )
    .sort((a, b) => b.versionNumber - a.versionNumber);
  const openRevision = versions.find((version) => version.status === "DRAFT" || version.status === "PENDING_REVIEW");
  const uploadVersion = openRevision ?? versions[0] ?? null;

  const { data: reviewRows, error: reviewError } = await supabase
    .from("resource_reviews")
    .select(
      "id, version_id, decision, message, created_at, reviewer:profiles!reviewer_id ( username, display_name )",
    )
    .eq("resource_id", resourceId)
    .order("created_at", { ascending: false });

  if (reviewError) {
    logger.warn("db.submissions", "Failed to load review history", {
      message: reviewError.message,
    });
  }

  return {
    id: data.id,
    title: data.title,
    slug: data.slug,
    resourceType,
    description: data.description,
    status: data.status as ResourceStatus,
    visibility: data.visibility,
    categoryId: data.category_id,
    categoryBreadcrumb: getCategoryBreadcrumb(taxonomy, data.category_id).map((item) => ({
      id: item.id,
      name: item.name,
    })),
    seasonId: data.season_id,
    licenseId: data.license_id,
    licenseName: asSingleRelation(data.licenses)?.name ?? null,
    teamId: data.team_id,
    teamName: asSingleRelation(data.teams)?.name ?? null,
    teamNumber: asSingleRelation(data.teams)?.team_number ?? null,
    authorId: data.author_id,
    authorUsername: author?.username ?? null,
    authorDisplayName: author?.display_name ?? author?.username ?? null,
    tagIds: asRelationList(data.resource_tags).map((row) => row.tag_id),
    versionId: uploadVersion?.id ?? null,
    versions,
    files: asRelationList(data.resource_files)
      .map((file) => ({
        id: file.id,
        versionId: file.version_id,
        filename: file.filename,
        fileType: file.file_type,
        mimeType: file.mime_type,
        sizeBytes: file.size_bytes,
        storagePath: file.storage_path,
        storageBucket: resolveResourceStorageBucket(file.storage_bucket),
        createdAt: file.created_at,
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    reviews: (reviewRows ?? []).map(mapReview),
    rightsAcknowledgedAt: data.rights_acknowledged_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    submittedAt: data.submitted_at,
    reviewedAt: data.reviewed_at,
    publishedAt: data.published_at,
  };
}

export type ReviewQueueItem = {
  id: string;
  title: string;
  resourceType: ResourceType;
  categoryName: string | null;
  contributorName: string | null;
  contributorUsername: string | null;
  submittedAt: string | null;
  fileCount: number;
  kind: "resource" | "revision";
  versionId: string | null;
  versionLabel: string | null;
};

export async function listReviewQueue(
  resourceType?: ResourceType | null,
): Promise<ReviewQueueItem[]> {
  const [resources, revisions] = await Promise.all([
    listResourceReviewQueue(resourceType),
    listRevisionQueue(resourceType),
  ]);
  return [...resources, ...revisions].sort((a, b) => {
    const left = a.submittedAt ?? "";
    const right = b.submittedAt ?? "";
    return left.localeCompare(right);
  });
}

async function listResourceReviewQueue(
  resourceType?: ResourceType | null,
): Promise<ReviewQueueItem[]> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return [];
  }

  let request = supabase
    .from("resources")
    .select(
      `
      id,
      title,
      resource_type,
      submitted_at,
      categories ( name ),
      author:profiles!author_id ( username, display_name ),
      resource_files ( id )
    `,
    )
    .eq("status", "PENDING_REVIEW");

  if (resourceType) {
    request = request.eq("resource_type", resourceType);
  }

  const { data, error } = await request.order("submitted_at", {
    ascending: true,
    nullsFirst: false,
  });

  if (error) {
    logger.error("db.submissions", "Failed to load review queue", {
      message: error.message,
      code: error.code,
    });
    throw new Error(SUBMISSION_ERROR);
  }

  return (data ?? []).map((row) => {
    const author = asSingleRelation(row.author);
    return {
      id: row.id,
      title: row.title,
      resourceType: row.resource_type as ResourceType,
      categoryName: asSingleRelation(row.categories)?.name ?? null,
      contributorName: author ? (author.display_name ?? author.username) : null,
      contributorUsername: author?.username ?? null,
      submittedAt: row.submitted_at,
      fileCount: asRelationList(row.resource_files).length,
      kind: "resource" as const,
      versionId: null,
      versionLabel: null,
    };
  });
}

async function listRevisionQueue(
  resourceType?: ResourceType | null,
): Promise<ReviewQueueItem[]> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("resource_versions")
    .select(
      `
      id,
      resource_id,
      version_label,
      version_number,
      created_at,
      resource_files!version_id ( id ),
      resources!inner (
        id,
        title,
        resource_type,
        status,
        categories ( name ),
        author:profiles!author_id ( username, display_name )
      )
    `,
    )
    .eq("status", "PENDING_REVIEW")
    .gt("version_number", 1)
    .eq("resources.status", "PUBLISHED")
    .order("created_at", { ascending: true });

  if (error) {
    logger.error("db.submissions", "Failed to load revision queue", {
      message: error.message,
      code: error.code,
    });
    throw new Error(SUBMISSION_ERROR);
  }

  const items: ReviewQueueItem[] = [];
  for (const row of data ?? []) {
    const resource = asSingleRelation(row.resources);
    if (!resource) {
      continue;
    }
    if (resourceType && resource.resource_type !== resourceType) {
      continue;
    }
    const author = asSingleRelation(resource.author);
    items.push({
      id: resource.id,
      title: resource.title,
      resourceType: resource.resource_type as ResourceType,
      categoryName: asSingleRelation(resource.categories)?.name ?? null,
      contributorName: author ? (author.display_name ?? author.username) : null,
      contributorUsername: author?.username ?? null,
      submittedAt: row.created_at,
      fileCount: asRelationList(row.resource_files).length,
      kind: "revision",
      versionId: row.id,
      versionLabel: row.version_label ?? `v${row.version_number}`,
    });
  }
  return items;
}

export async function countPendingReviews(): Promise<number> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return 0;
  }

  const [resources, revisions] = await Promise.all([
    supabase.from("resources").select("id", { count: "exact", head: true }).eq("status", "PENDING_REVIEW"),
    supabase
      .from("resource_versions")
      .select("id, resources!inner(status)", { count: "exact", head: true })
      .eq("status", "PENDING_REVIEW")
      .gt("version_number", 1)
      .eq("resources.status", "PUBLISHED"),
  ]);

  if (resources.error) {
    logger.warn("db.submissions", "Failed to count pending reviews", { message: resources.error.message });
  }
  if (revisions.error) {
    logger.warn("db.submissions", "Failed to count pending revisions", { message: revisions.error.message });
  }

  return (resources.count ?? 0) + (revisions.count ?? 0);
}

/**
 * Whether a category must be chosen before submitting. Zero configured
 * categories for a type is a valid state, so submission stays possible then.
 */
export async function categoryRequiredFor(resourceType: ResourceType): Promise<boolean> {
  const categories = await listCategories(resourceType, { activeOnly: true });
  return categories.length > 0;
}
