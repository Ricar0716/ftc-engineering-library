import {
  DEFAULT_EXPLORE_SORT,
  EXPLORE_PAGE_SIZE,
  RESOURCE_TYPES,
  type ExploreSort,
} from "@/lib/constants/resources";
import { asRelationList, asSingleRelation, getConfiguredServerClient } from "@/lib/db/client";
import {
  resourceIdsForTag,
  listCategories,
  listSeasons,
  resolveCategoryId,
  resolveSeasonId,
  resolveTagId,
} from "@/lib/db/catalog";
import {
  findCategoryById,
  getCategoryBreadcrumb,
  getCategoryDescendants,
} from "@/lib/categories/tree";
import {
  mapResourceFile,
  mapResourceSummary,
  mapResourceVersion,
  type ResourceSummarySource,
} from "@/lib/db/mappers";
import { expandSearchResourceIds } from "@/lib/db/search-expand";
import { intersectIds, toFtsQuery, uniqueIds } from "@/lib/search/query";
import { logger } from "@/lib/utils/logger";
import type { ResourceStatsRow } from "@/types/database";
import type { ResourceDetail, ResourceSummary, ResourceTag, ResourceType } from "@/types/resources";

const RESOURCE_ERROR = "Something went wrong while loading resources.";
const STATS_SORT_SCAN_LIMIT = 500;
const SEARCH_MATCH_SCAN_LIMIT = 500;

const RESOURCE_SUMMARY_SELECT = `
  id,
  title,
  slug,
  resource_type,
  description,
  thumbnail_url,
  updated_at,
  published_at,
  author:profiles!author_id ( username, display_name ),
  teams ( name, team_number ),
  seasons ( label ),
  categories ( id, name, slug ),
  resource_tags ( tags ( name, slug ) )
`;

export type ListPublishedResourcesInput = {
  query?: string;
  resourceType?: ResourceType | null;
  categoryId?: string | null;
  tagSlug?: string | null;
  seasonLabel?: string | null;
  teamId?: string | null;
  authorId?: string | null;
  sort?: ExploreSort;
  page?: number;
  pageSize?: number;
};

export type PublishedResourceList = {
  items: ResourceSummary[];
  total: number;
  page: number;
  pageSize: number;
};

function emptyList(page: number, pageSize: number): PublishedResourceList {
  return { items: [], total: 0, page, pageSize };
}

function tagsFromRow(row: {
  resource_tags?:
    { tags: { name: string; slug: string } | { name: string; slug: string }[] | null }[] | null;
}): ResourceTag[] {
  const tags: ResourceTag[] = [];
  for (const item of row.resource_tags ?? []) {
    const tag = asSingleRelation(item.tags);
    if (tag?.name && tag.slug) {
      tags.push({ name: tag.name, slug: tag.slug });
    }
  }
  return tags;
}

function toSummarySource(row: {
  id: string;
  title: string;
  slug: string;
  resource_type: ResourceType;
  description: string;
  thumbnail_url: string | null;
  updated_at?: string | null;
  published_at?: string | null;
  author?:
    | { username: string; display_name: string | null }
    | { username: string; display_name: string | null }[]
    | null;
  teams?: { name: string; team_number: string } | { name: string; team_number: string }[] | null;
  seasons?: { label: string } | { label: string }[] | null;
  categories?: { id?: string; name: string; slug?: string } | { id?: string; name: string; slug?: string }[] | null;
  resource_tags?:
    { tags: { name: string; slug: string } | { name: string; slug: string }[] | null }[] | null;
}): ResourceSummarySource {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    resource_type: row.resource_type,
    description: row.description,
    thumbnail_url: row.thumbnail_url,
    updated_at: row.updated_at,
    published_at: row.published_at,
    author: asSingleRelation(row.author),
    teams: asSingleRelation(row.teams),
    seasons: asSingleRelation(row.seasons),
    categories: asSingleRelation(row.categories),
    tags: tagsFromRow(row),
  };
}

async function loadResourceStats(
  resourceIds: string[],
): Promise<
  Map<string, Pick<ResourceStatsRow, "rating_average" | "download_count" | "rating_count" | "favorite_count">>
> {
  const stats = new Map<
    string,
    Pick<ResourceStatsRow, "rating_average" | "download_count" | "rating_count" | "favorite_count">
  >();
  if (resourceIds.length === 0) {
    return stats;
  }

  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return stats;
  }

  const { data, error } = await supabase
    .from("resource_stats")
    .select("resource_id, rating_average, download_count, rating_count, favorite_count")
    .in("resource_id", resourceIds);

  if (error) {
    logger.error("db.resources", "Failed to load resource stats", {
      message: error.message,
      code: error.code,
    });
    throw new Error(RESOURCE_ERROR);
  }

  for (const row of data ?? []) {
    if (row.resource_id) {
      stats.set(row.resource_id, {
        rating_average: row.rating_average,
        download_count: row.download_count,
        rating_count: row.rating_count,
        favorite_count: row.favorite_count,
      });
    }
  }

  return stats;
}

async function mapRows(rows: Parameters<typeof toSummarySource>[0][]): Promise<ResourceSummary[]> {
  const statsByResourceId = await loadResourceStats(rows.map((row) => row.id));
  return rows.map((row) =>
    mapResourceSummary(toSummarySource(row), statsByResourceId.get(row.id) ?? null),
  );
}

type ResolvedListFilters = {
  resourceType?: ResourceType;
  teamId?: string;
  authorId?: string;
  categoryIds?: string[];
  seasonId?: string;
  resourceIds?: string[];
  fts?: string;
  searchOrIds?: string[];
};

async function resolveListFilters(
  input: ListPublishedResourcesInput,
): Promise<ResolvedListFilters | null> {
  const resolved: ResolvedListFilters = {};

  if (input.resourceType) {
    resolved.resourceType = input.resourceType;
  }
  if (input.teamId) {
    resolved.teamId = input.teamId;
  }
  if (input.authorId) {
    resolved.authorId = input.authorId;
  }

  if (input.categoryId) {
    const exists = await resolveCategoryId(input.categoryId);
    if (!exists) {
      return null;
    }
    const taxonomy = await listCategories(input.resourceType);
    if (!findCategoryById(taxonomy, input.categoryId)) {
      return null;
    }
    resolved.categoryIds = getCategoryDescendants(taxonomy, input.categoryId);
  }

  if (input.seasonLabel) {
    const seasonId = await resolveSeasonId(input.seasonLabel);
    if (!seasonId) {
      return null;
    }
    resolved.seasonId = seasonId;
  }

  if (input.tagSlug) {
    const tagId = await resolveTagId(input.tagSlug);
    if (!tagId) {
      return null;
    }
    const ids = await resourceIdsForTag(tagId);
    if (ids.length === 0) {
      return null;
    }
    resolved.resourceIds = ids;
  }

  if (input.query) {
    const fts = toFtsQuery(input.query);
    if (fts) {
      resolved.fts = fts;
    }
    const extraIds = await expandSearchResourceIds(input.query);
    if (extraIds.length > 0) {
      resolved.searchOrIds = extraIds;
    }
  }

  return resolved;
}

function applyResolvedFilters<
  Query extends {
    eq: (column: string, value: string) => Query;
    in: (column: string, values: string[]) => Query;
    textSearch: (
      column: string,
      query: string,
      options: { type: "plain"; config: string },
    ) => Query;
  },
>(request: Query, filters: ResolvedListFilters): Query {
  let next = request.eq("status", "PUBLISHED").eq("visibility", "PUBLIC");

  if (filters.resourceType) {
    next = next.eq("resource_type", filters.resourceType);
  }
  if (filters.teamId) {
    next = next.eq("team_id", filters.teamId);
  }
  if (filters.authorId) {
    next = next.eq("author_id", filters.authorId);
  }
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    next = next.in("category_id", filters.categoryIds);
  }
  if (filters.seasonId) {
    next = next.eq("season_id", filters.seasonId);
  }
  if (filters.resourceIds) {
    next = next.in("id", filters.resourceIds);
  }
  if (filters.fts) {
    next = next.textSearch("search_vector", filters.fts, {
      type: "plain",
      config: "english",
    });
  }

  return next;
}

function withoutSearch(filters: ResolvedListFilters): ResolvedListFilters {
  return {
    resourceType: filters.resourceType,
    teamId: filters.teamId,
    authorId: filters.authorId,
    categoryIds: filters.categoryIds,
    seasonId: filters.seasonId,
    resourceIds: filters.resourceIds,
  };
}

function compareNullableDate(left: string | null, right: string | null, ascending: boolean): number {
  if (left === right) {
    return 0;
  }
  if (!left) {
    return 1;
  }
  if (!right) {
    return -1;
  }
  const delta = left < right ? -1 : 1;
  return ascending ? delta : -delta;
}

async function collectMatchedIds(filters: ResolvedListFilters): Promise<string[]> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return [];
  }

  const structural = withoutSearch(filters);
  const buckets: string[][] = [];

  if (filters.fts) {
    const { data, error } = await applyResolvedFilters(
      supabase.from("resources").select("id"),
      { ...structural, fts: filters.fts },
    ).limit(SEARCH_MATCH_SCAN_LIMIT);

    if (error) {
      logger.error("db.resources", "Failed to list FTS matches", {
        message: error.message,
        code: error.code,
      });
      throw new Error(RESOURCE_ERROR);
    }

    buckets.push((data ?? []).map((row: { id: string }) => row.id));
  }

  if (filters.searchOrIds && filters.searchOrIds.length > 0) {
    const extraIds = intersectIds(filters.resourceIds, filters.searchOrIds);
    if (extraIds.length > 0) {
      const { data, error } = await applyResolvedFilters(
        supabase.from("resources").select("id"),
        { ...structural, resourceIds: extraIds },
      ).limit(SEARCH_MATCH_SCAN_LIMIT);

      if (error) {
        logger.error("db.resources", "Failed to list expanded search matches", {
          message: error.message,
          code: error.code,
        });
        throw new Error(RESOURCE_ERROR);
      }

      buckets.push((data ?? []).map((row: { id: string }) => row.id));
    }
  }

  return uniqueIds(buckets.flat()).slice(0, SEARCH_MATCH_SCAN_LIMIT);
}

async function orderMatchedIds(
  ids: string[],
  sort: ExploreSort,
): Promise<string[]> {
  if (ids.length === 0) {
    return [];
  }

  if (sort === "downloads" || sort === "rating") {
    const stats = await loadResourceStats(ids);
    return [...ids].sort((a, b) => {
      const left = stats.get(a);
      const right = stats.get(b);
      if (sort === "downloads") {
        const downloadDelta = (right?.download_count ?? 0) - (left?.download_count ?? 0);
        if (downloadDelta !== 0) {
          return downloadDelta;
        }
      } else {
        const ratingDelta = (right?.rating_average ?? 0) - (left?.rating_average ?? 0);
        if (ratingDelta !== 0) {
          return ratingDelta;
        }
        const countDelta = (right?.rating_count ?? 0) - (left?.rating_count ?? 0);
        if (countDelta !== 0) {
          return countDelta;
        }
      }
      return a.localeCompare(b);
    });
  }

  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return ids;
  }

  const { data, error } = await supabase
    .from("resources")
    .select("id, published_at, updated_at, created_at")
    .eq("status", "PUBLISHED")
    .eq("visibility", "PUBLIC")
    .in("id", ids);

  if (error) {
    logger.error("db.resources", "Failed to load search result order", {
      message: error.message,
      code: error.code,
    });
    throw new Error(RESOURCE_ERROR);
  }

  const ascending = sort === "oldest";
  const useUpdated = sort === "updated";
  const rows = new Map(
    (data ?? []).map((row: { id: string; published_at: string | null; updated_at: string | null; created_at: string }) => [
      row.id,
      row,
    ]),
  );

  return [...ids].sort((a, b) => {
    const left = rows.get(a);
    const right = rows.get(b);
    const primary = compareNullableDate(
      useUpdated ? (left?.updated_at ?? null) : (left?.published_at ?? null),
      useUpdated ? (right?.updated_at ?? null) : (right?.published_at ?? null),
      ascending,
    );
    if (primary !== 0) {
      return primary;
    }
    const secondary = compareNullableDate(
      left?.created_at ?? null,
      right?.created_at ?? null,
      ascending,
    );
    if (secondary !== 0) {
      return secondary;
    }
    return a.localeCompare(b);
  });
}

async function listPublishedResourcesByMatchedIds(
  filters: ResolvedListFilters,
  page: number,
  pageSize: number,
  sort: ExploreSort,
): Promise<PublishedResourceList> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return emptyList(page, pageSize);
  }

  const matched = await collectMatchedIds(filters);
  if (matched.length === 0) {
    return emptyList(page, pageSize);
  }

  const ordered = await orderMatchedIds(matched, sort);
  const from = (page - 1) * pageSize;
  const pageIds = ordered.slice(from, from + pageSize);
  if (pageIds.length === 0) {
    return { items: [], total: ordered.length, page, pageSize };
  }

  const { data, error } = await supabase
    .from("resources")
    .select(RESOURCE_SUMMARY_SELECT)
    .eq("status", "PUBLISHED")
    .eq("visibility", "PUBLIC")
    .in("id", pageIds);

  if (error) {
    logger.error("db.resources", "Failed to load matched search resources", {
      message: error.message,
      code: error.code,
    });
    throw new Error(RESOURCE_ERROR);
  }

  const summaries = await mapRows((data ?? []) as Parameters<typeof toSummarySource>[0][]);
  const byId = new Map(summaries.map((item) => [item.id, item]));

  return {
    items: pageIds
      .map((id) => byId.get(id))
      .filter((item): item is ResourceSummary => Boolean(item)),
    total: ordered.length,
    page,
    pageSize,
  };
}

export async function listPublishedResources(
  input: ListPublishedResourcesInput = {},
): Promise<PublishedResourceList> {
  const page = input.page && input.page > 0 ? input.page : 1;
  const pageSize = input.pageSize && input.pageSize > 0 ? input.pageSize : EXPLORE_PAGE_SIZE;
  const sort = input.sort ?? DEFAULT_EXPLORE_SORT;
  const supabase = await getConfiguredServerClient();

  if (!supabase) {
    return emptyList(page, pageSize);
  }

  const resolved = await resolveListFilters(input);
  if (!resolved) {
    return emptyList(page, pageSize);
  }

  if (resolved.searchOrIds && resolved.searchOrIds.length > 0) {
    return listPublishedResourcesByMatchedIds(resolved, page, pageSize, sort);
  }

  if (sort === "downloads" || sort === "rating") {
    return listPublishedResourcesByStats(resolved, page, pageSize, sort);
  }

  const request = applyResolvedFilters(
    supabase.from("resources").select(RESOURCE_SUMMARY_SELECT, { count: "exact" }),
    resolved,
  );

  const ascending = sort === "oldest";
  const orderColumn = sort === "updated" ? "updated_at" : "published_at";
  const from = (page - 1) * pageSize;
  const { data, error, count } = await request
    .order(orderColumn, { ascending, nullsFirst: false })
    .order("created_at", { ascending })
    .range(from, from + pageSize - 1);

  if (error) {
    logger.error("db.resources", "Failed to list published resources", {
      message: error.message,
      code: error.code,
    });
    throw new Error(RESOURCE_ERROR);
  }

  return {
    items: await mapRows((data ?? []) as Parameters<typeof toSummarySource>[0][]),
    total: count ?? 0,
    page,
    pageSize,
  };
}

async function listPublishedResourcesByStats(
  filters: ResolvedListFilters,
  page: number,
  pageSize: number,
  sort: "downloads" | "rating",
): Promise<PublishedResourceList> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return emptyList(page, pageSize);
  }

  const { data: idRows, error: idError } = await applyResolvedFilters(
    supabase.from("resources").select("id"),
    filters,
  ).limit(STATS_SORT_SCAN_LIMIT);

  if (idError) {
    logger.error("db.resources", "Failed to list resource ids for stats sort", {
      message: idError.message,
      code: idError.code,
    });
    throw new Error(RESOURCE_ERROR);
  }

  const ids = (idRows ?? []).map((row: { id: string }) => row.id);
  const stats = await loadResourceStats(ids);
  const ordered = [...ids].sort((a, b) => {
    const left = stats.get(a);
    const right = stats.get(b);
    if (sort === "downloads") {
      return (right?.download_count ?? 0) - (left?.download_count ?? 0);
    }
    const ratingDelta = (right?.rating_average ?? 0) - (left?.rating_average ?? 0);
    if (ratingDelta !== 0) {
      return ratingDelta;
    }
    return (right?.rating_count ?? 0) - (left?.rating_count ?? 0);
  });

  const from = (page - 1) * pageSize;
  const pageIds = ordered.slice(from, from + pageSize);
  if (pageIds.length === 0) {
    return { items: [], total: ids.length, page, pageSize };
  }

  const { data, error } = await supabase
    .from("resources")
    .select(RESOURCE_SUMMARY_SELECT)
    .in("id", pageIds);

  if (error) {
    logger.error("db.resources", "Failed to load sorted resources", {
      message: error.message,
      code: error.code,
    });
    throw new Error(RESOURCE_ERROR);
  }

  const summaries = await mapRows((data ?? []) as Parameters<typeof toSummarySource>[0][]);
  const byId = new Map(summaries.map((item) => [item.id, item]));

  return {
    items: pageIds
      .map((id) => byId.get(id))
      .filter((item): item is ResourceSummary => Boolean(item)),
    total: ids.length,
    page,
    pageSize,
  };
}

export async function getLatestResources(limit = 6): Promise<ResourceSummary[]> {
  const result = await listPublishedResources({
    sort: "latest",
    page: 1,
    pageSize: limit,
  });
  return result.items;
}

export async function getLatestResourcesByType(
  resourceType: ResourceType,
  limit = 4,
): Promise<ResourceSummary[]> {
  const result = await listPublishedResources({
    resourceType,
    sort: "latest",
    page: 1,
    pageSize: limit,
  });
  return result.items;
}

export async function getResourceBySlug(slug: string): Promise<ResourceDetail | null> {
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
      thumbnail_url,
      updated_at,
      published_at,
      author:profiles!author_id ( id, username, display_name, avatar_url, bio ),
      teams ( id, team_number, name, country, logo_url, description ),
      seasons ( label ),
      categories ( id, name, slug ),
      licenses ( name, url, spdx_id ),
      resource_tags ( tags ( name, slug ) ),
      resource_hardware ( hardware ( name, slug ) ),
      resource_versions ( id, version_number, version_label, changelog, status, released_at, created_at ),
      resource_files ( id, version_id, filename, file_type, mime_type, size_bytes )
    `,
    )
    .eq("slug", slug)
    .eq("status", "PUBLISHED")
    .eq("visibility", "PUBLIC")
    .maybeSingle();

  if (error) {
    logger.error("db.resources", "Failed to load resource", {
      message: error.message,
      code: error.code,
    });
    throw new Error(RESOURCE_ERROR);
  }

  if (!data) {
    return null;
  }

  const author = asSingleRelation(data.author);
  const team = asSingleRelation(data.teams);
  const license = asSingleRelation(data.licenses);
  const category = asSingleRelation(data.categories);
  const stats = (await loadResourceStats([data.id])).get(data.id) ?? null;
  const summary = mapResourceSummary(
    {
      ...toSummarySource({
        ...data,
        author,
        teams: team,
        categories: category,
      }),
      author: author ? { username: author.username, display_name: author.display_name } : null,
    },
    stats,
  );

  const related = await listRelatedResources(data.id);
  const similar =
    related.length > 0
      ? related
      : await listSimilarPublished({
          resourceId: data.id,
          resourceType: data.resource_type as ResourceType,
          categoryId: category?.id ?? null,
        });
  const taxonomy = await listCategories(data.resource_type);
  const categoryBreadcrumb = category?.id
    ? getCategoryBreadcrumb(taxonomy, category.id).map((item) => ({
        id: item.id,
        name: item.name,
      }))
    : [];
  const authorPublishedCount = author?.id
    ? (await countPublishedResources({ authorId: author.id })).total
    : null;

  const versions = asRelationList(data.resource_versions)
    .map(mapResourceVersion)
    .filter((version) => version.status === "PUBLISHED")
    .sort((a, b) => b.versionNumber - a.versionNumber);
  const publishedVersionIds = new Set(versions.map((version) => version.id));

  return {
    ...summary,
    authorId: author?.id ?? null,
    teamId: team?.id ?? null,
    authorUsername: author?.username ?? null,
    authorDisplayName: author?.display_name ?? author?.username ?? null,
    authorAvatarUrl: author?.avatar_url ?? null,
    authorBio: author?.bio ?? null,
    authorPublishedCount,
    categorySlug: category?.slug ?? null,
    categoryBreadcrumb,
    license: license ? { name: license.name, url: license.url, spdxId: license.spdx_id } : null,
    hardware: asRelationList(data.resource_hardware)
      .map((item) => asSingleRelation(item.hardware))
      .filter((item): item is { name: string; slug: string } => Boolean(item)),
    versions,
    files: asRelationList(data.resource_files)
      .map(mapResourceFile)
      .filter((file) => publishedVersionIds.has(file.versionId)),
    related: similar,
  };
}

export async function getPublishedSummariesByIds(ids: string[]): Promise<ResourceSummary[]> {
  if (ids.length === 0) {
    return [];
  }

  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("resources")
    .select(RESOURCE_SUMMARY_SELECT)
    .in("id", ids)
    .eq("status", "PUBLISHED")
    .eq("visibility", "PUBLIC");

  if (error) {
    logger.error("db.resources", "Failed to load published summaries", {
      message: error.message,
      code: error.code,
    });
    throw new Error(RESOURCE_ERROR);
  }

  const mapped = await mapRows((data ?? []).map((row) => toSummarySource(row)));
  const byId = new Map(mapped.map((item) => [item.id, item]));
  return ids.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

async function countPublishedResourcesRequest(
  filter: { authorId?: string; teamId?: string; resourceType?: ResourceType },
) {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return { count: 0, error: null };
  }

  let request = supabase
    .from("resources")
    .select("id", { count: "exact", head: true })
    .eq("status", "PUBLISHED")
    .eq("visibility", "PUBLIC");

  if (filter.authorId) {
    request = request.eq("author_id", filter.authorId);
  }
  if (filter.teamId) {
    request = request.eq("team_id", filter.teamId);
  }
  if (filter.resourceType) {
    request = request.eq("resource_type", filter.resourceType);
  }

  return await request;
}

export type PublishedResourceCounts = {
  total: number;
  byType: Record<ResourceType, number>;
};

const EMPTY_PUBLISHED_COUNTS: PublishedResourceCounts = {
  total: 0,
  byType: { CAD: 0, CODE: 0, TUTORIAL: 0, MODEL: 0 },
};

export async function countPublishedResources(filter: {
  authorId?: string;
  teamId?: string;
}): Promise<PublishedResourceCounts> {
  if (!filter.authorId && !filter.teamId) {
    return EMPTY_PUBLISHED_COUNTS;
  }

  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return EMPTY_PUBLISHED_COUNTS;
  }

  const [totalResult, ...typeResults] = await Promise.all([
    countPublishedResourcesRequest(filter),
    ...RESOURCE_TYPES.map((resourceType) =>
      countPublishedResourcesRequest({ ...filter, resourceType }),
    ),
  ]);

  const firstError = [totalResult, ...typeResults].find((result) => result.error)?.error;
  if (firstError) {
    logger.error("db.resources", "Failed to count published resources", {
      message: firstError.message,
      code: firstError.code,
    });
    return EMPTY_PUBLISHED_COUNTS;
  }

  const byType = { ...EMPTY_PUBLISHED_COUNTS.byType };
  RESOURCE_TYPES.forEach((type, index) => {
    byType[type] = typeResults[index]?.count ?? 0;
  });

  return {
    total: totalResult.count ?? 0,
    byType,
  };
}

export async function listPublishedSeasonLabels(filter: {
  authorId?: string;
  teamId?: string;
}): Promise<string[]> {
  if (!filter.authorId && !filter.teamId) {
    return [];
  }

  const seasons = await listSeasons();
  if (seasons.length === 0) {
    return [];
  }

  const present = await Promise.all(
    seasons.map(async (season) => {
      const supabase = await getConfiguredServerClient();
      if (!supabase) {
        return null;
      }

      let request = supabase
        .from("resources")
        .select("id", { count: "exact", head: true })
        .eq("status", "PUBLISHED")
        .eq("visibility", "PUBLIC")
        .eq("season_id", season.id);

      if (filter.authorId) {
        request = request.eq("author_id", filter.authorId);
      }
      if (filter.teamId) {
        request = request.eq("team_id", filter.teamId);
      }

      const { count, error } = await request;
      if (error) {
        logger.error("db.resources", "Failed to count season resources", {
          message: error.message,
          code: error.code,
        });
        return null;
      }

      return (count ?? 0) > 0 ? season.label : null;
    }),
  );

  return present.filter((label): label is string => Boolean(label));
}

async function listRelatedResources(resourceId: string): Promise<ResourceSummary[]> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("resource_relations")
    .select("source_resource_id, target_resource_id")
    .or(`source_resource_id.eq.${resourceId},target_resource_id.eq.${resourceId}`);

  if (error) {
    logger.error("db.resources", "Failed to load related resources", {
      message: error.message,
      code: error.code,
    });
    throw new Error(RESOURCE_ERROR);
  }

  const relatedIds = [
    ...new Set(
      (data ?? [])
        .flatMap((row) => [row.source_resource_id, row.target_resource_id])
        .filter((id) => id !== resourceId),
    ),
  ];

  if (relatedIds.length === 0) {
    return [];
  }

  const { data: rows, error: relatedError } = await supabase
    .from("resources")
    .select(RESOURCE_SUMMARY_SELECT)
    .eq("status", "PUBLISHED")
    .eq("visibility", "PUBLIC")
    .in("id", relatedIds);

  if (relatedError) {
    logger.error("db.resources", "Failed to load related resource summaries", {
      message: relatedError.message,
      code: relatedError.code,
    });
    throw new Error(RESOURCE_ERROR);
  }

  return mapRows((rows ?? []) as Parameters<typeof toSummarySource>[0][]);
}

async function listSimilarPublished(input: {
  resourceId: string;
  resourceType: ResourceType;
  categoryId: string | null;
}): Promise<ResourceSummary[]> {
  const result = await listPublishedResources({
    resourceType: input.resourceType,
    categoryId: input.categoryId,
    page: 1,
    pageSize: 8,
    sort: "latest",
  });
  return result.items.filter((item) => item.id !== input.resourceId).slice(0, 4);
}
