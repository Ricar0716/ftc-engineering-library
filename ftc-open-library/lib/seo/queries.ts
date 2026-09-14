import "server-only";

import { asSingleRelation, getConfiguredServerClient } from "@/lib/db/client";
import { logger } from "@/lib/utils/logger";
import type { ResourceType } from "@/types/resources";

const SITEMAP_LIMIT = 5000;
const SEO_ERROR = "Something went wrong while loading public metadata.";

export type PublicResourceSeo = {
  title: string;
  slug: string;
  resourceType: ResourceType;
  description: string;
  publishedAt: string | null;
  updatedAt: string | null;
  thumbnailUrl: string | null;
  authorUsername: string | null;
  authorDisplayName: string | null;
  teamName: string | null;
  teamNumber: string | null;
};

export type SitemapEntry = {
  path: string;
  lastModified: Date;
};

/**
 * Lightweight public metadata for a published resource. No files, versions,
 * related rows, private Storage URLs, or moderation fields.
 */
export async function getPublicResourceSeo(slug: string): Promise<PublicResourceSeo | null> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("resources")
    .select(
      `
      title,
      slug,
      resource_type,
      description,
      published_at,
      updated_at,
      thumbnail_url,
      author:profiles!author_id ( username, display_name ),
      teams ( name, team_number )
    `,
    )
    .eq("slug", slug)
    .eq("status", "PUBLISHED")
    .eq("visibility", "PUBLIC")
    .maybeSingle();

  if (error) {
    logger.error("seo.query", "Failed to load resource metadata", { message: error.message });
    throw new Error(SEO_ERROR);
  }
  if (!data) {
    return null;
  }

  const author = asSingleRelation(data.author);
  const team = asSingleRelation(data.teams);

  return {
    title: data.title,
    slug: data.slug,
    resourceType: data.resource_type as ResourceType,
    description: data.description,
    publishedAt: data.published_at,
    updatedAt: data.updated_at,
    thumbnailUrl: data.thumbnail_url,
    authorUsername: author?.username ?? null,
    authorDisplayName: author?.display_name ?? author?.username ?? null,
    teamName: team?.name ?? null,
    teamNumber: team?.team_number ?? null,
  };
}

export async function listPublicSitemapResources(): Promise<SitemapEntry[]> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("resources")
    .select("slug, updated_at, published_at")
    .eq("status", "PUBLISHED")
    .eq("visibility", "PUBLIC")
    .order("updated_at", { ascending: false })
    .limit(SITEMAP_LIMIT);

  if (error) {
    logger.error("seo.query", "Failed to list sitemap resources", { message: error.message });
    throw new Error(SEO_ERROR);
  }

  return (data ?? []).map((row) => ({
    path: `/resources/${row.slug}`,
    lastModified: new Date(row.updated_at ?? row.published_at ?? Date.now()),
  }));
}

export async function listPublicSitemapProfiles(): Promise<SitemapEntry[]> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("resources")
    .select("updated_at, author:profiles!author_id ( username )")
    .eq("status", "PUBLISHED")
    .eq("visibility", "PUBLIC")
    .not("author_id", "is", null)
    .limit(SITEMAP_LIMIT);

  if (error) {
    logger.error("seo.query", "Failed to list sitemap profiles", { message: error.message });
    throw new Error(SEO_ERROR);
  }

  const latest = new Map<string, Date>();
  for (const row of data ?? []) {
    const author = asSingleRelation(row.author);
    const username = author?.username;
    if (!username) {
      continue;
    }
    const stamp = new Date(row.updated_at ?? Date.now());
    const current = latest.get(username);
    if (!current || stamp > current) {
      latest.set(username, stamp);
    }
  }

  return [...latest.entries()].map(([username, lastModified]) => ({
    path: `/profile/${username}`,
    lastModified,
  }));
}

export async function listPublicSitemapTeams(): Promise<SitemapEntry[]> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("resources")
    .select("updated_at, teams ( team_number )")
    .eq("status", "PUBLISHED")
    .eq("visibility", "PUBLIC")
    .not("team_id", "is", null)
    .limit(SITEMAP_LIMIT);

  if (error) {
    logger.error("seo.query", "Failed to list sitemap teams", { message: error.message });
    throw new Error(SEO_ERROR);
  }

  const latest = new Map<string, Date>();
  for (const row of data ?? []) {
    const team = asSingleRelation(row.teams);
    const number = team?.team_number;
    if (!number) {
      continue;
    }
    const stamp = new Date(row.updated_at ?? Date.now());
    const current = latest.get(number);
    if (!current || stamp > current) {
      latest.set(number, stamp);
    }
  }

  return [...latest.entries()].map(([teamNumber, lastModified]) => ({
    path: `/teams/${teamNumber}`,
    lastModified,
  }));
}

export { SITEMAP_LIMIT };
