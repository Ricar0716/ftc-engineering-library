import type { ProfileRow, ResourceRow, ResourceStatsRow, TeamRow } from "@/types/database";
import type {
  ResourceAuthor,
  ResourceFileSummary,
  ResourceSummary,
  ResourceTag,
  ResourceType,
  ResourceVersionSummary,
} from "@/types/resources";
import type { TeamSummary } from "@/types/teams";
import type { PublicUserProfile } from "@/types/users";

export function mapPublicProfile(
  row: Pick<ProfileRow, "id" | "username" | "display_name" | "avatar_url" | "bio" | "created_at">,
): PublicUserProfile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name ?? row.username,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    joinedAt: row.created_at,
  };
}

export function mapTeamSummary(
  row: Pick<TeamRow, "id" | "team_number" | "name" | "country" | "logo_url" | "description">,
  counts?: { resourceCount?: number | null; memberCount?: number | null },
): TeamSummary {
  return {
    id: row.id,
    slug: row.team_number,
    teamNumber: row.team_number,
    name: row.name,
    country: row.country,
    logoUrl: row.logo_url,
    description: row.description,
    resourceCount: counts?.resourceCount ?? null,
    memberCount: counts?.memberCount ?? null,
  };
}

export type ResourceSummarySource = Pick<
  ResourceRow,
  "id" | "title" | "slug" | "resource_type" | "description" | "thumbnail_url"
> & {
  updated_at?: string | null;
  published_at?: string | null;
  author?: { username: string; display_name: string | null } | null;
  teams?: Pick<TeamRow, "name" | "team_number"> | null;
  seasons?: { label: string } | null;
  categories?: { id?: string; name: string; slug?: string } | null;
  tags?: ResourceTag[];
};

export function mapResourceSummary(
  row: ResourceSummarySource,
  stats?: Pick<ResourceStatsRow, "rating_average" | "download_count" | "favorite_count"> | null,
): ResourceSummary {
  const author: ResourceAuthor | null = row.author
    ? {
        username: row.author.username,
        displayName: row.author.display_name ?? row.author.username,
      }
    : null;

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    resourceType: row.resource_type as ResourceType,
    description: row.description,
    author,
    teamName: row.teams?.name ?? null,
    teamSlug: row.teams?.team_number ?? null,
    seasonLabel: row.seasons?.label ?? null,
    categoryId: row.categories?.id ?? null,
    categoryName: row.categories?.name ?? null,
    tags: row.tags ?? [],
    updatedAt: row.updated_at ?? null,
    publishedAt: row.published_at ?? null,
    ratingAverage: stats?.rating_average ?? null,
    downloadCount: stats?.download_count ?? null,
    favoriteCount: stats?.favorite_count ?? null,
    thumbnailUrl: row.thumbnail_url,
  };
}

export function mapResourceVersion(row: {
  id: string;
  version_number: number;
  version_label: string | null;
  changelog: string | null;
  status?: ResourceVersionSummary["status"] | null;
  released_at?: string | null;
  created_at: string;
  submitted_at?: string | null;
  creator?: { username: string; display_name: string | null } | null;
}): ResourceVersionSummary {
  return {
    id: row.id,
    versionNumber: row.version_number,
    versionLabel: row.version_label,
    changelog: row.changelog,
    status: row.status ?? "PUBLISHED",
    releasedAt: row.released_at ?? null,
    createdAt: row.created_at,
    submittedAt: row.submitted_at ?? null,
    createdByUsername: row.creator?.username ?? null,
    createdByDisplayName: row.creator ? (row.creator.display_name ?? row.creator.username) : null,
  };
}

export function mapResourceFile(row: {
  id: string;
  version_id: string;
  filename: string;
  file_type: ResourceFileSummary["fileType"];
  mime_type: string | null;
  size_bytes: number | null;
}): ResourceFileSummary {
  return {
    id: row.id,
    versionId: row.version_id,
    filename: row.filename,
    fileType: row.file_type,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
  };
}
