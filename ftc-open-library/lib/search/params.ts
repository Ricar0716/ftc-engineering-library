import {
  DEFAULT_EXPLORE_SORT,
  EXPLORE_SORTS,
  RESOURCE_TYPES,
  type ExploreSort,
} from "../constants/resources.ts";
import { isUuid } from "../utils/id.ts";
import type { ResourceType } from "../../types/resources.ts";

export type ExploreSearchParams = {
  q: string;
  type: ResourceType | null;
  category: string | null;
  tag: string | null;
  season: string | null;
  sort: ExploreSort;
  page: number;
};

const SORT_ALIASES: Record<string, ExploreSort> = {
  latest: "latest",
  oldest: "oldest",
  downloads: "downloads",
  rating: "rating",
  newest: "latest",
  updated: "updated",
  relevance: "relevance",
};

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function isResourceType(value: string): value is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(value);
}

function isExploreSort(value: string): value is ExploreSort {
  return (EXPLORE_SORTS as readonly string[]).includes(value);
}

export function parseExploreSearchParams(
  input: Record<string, string | string[] | undefined>,
): ExploreSearchParams {
  const typeValue = first(input.type);
  const sortValue = first(input.sort);
  const pageValue = Number(first(input.page) ?? "1");
  const query = first(input.q)?.trim() || first(input.query)?.trim() || "";

  const mappedSort = sortValue ? (SORT_ALIASES[sortValue] ?? sortValue) : DEFAULT_EXPLORE_SORT;

  return {
    q: query,
    type: typeValue && isResourceType(typeValue) ? typeValue : null,
    category: (() => {
      const raw = first(input.category)?.trim() || null;
      return raw && isUuid(raw) ? raw : null;
    })(),
    tag: first(input.tag)?.trim() || null,
    season: first(input.season)?.trim() || null,
    sort: isExploreSort(mappedSort) ? mappedSort : DEFAULT_EXPLORE_SORT,
    page: Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) : 1,
  };
}

export function buildExplorePath(filters: Partial<ExploreSearchParams>): string {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }
  if (filters.type) {
    params.set("type", filters.type);
  }
  if (filters.category) {
    params.set("category", filters.category);
  }
  if (filters.tag) {
    params.set("tag", filters.tag);
  }
  if (filters.season) {
    params.set("season", filters.season);
  }
  if (filters.sort && filters.sort !== DEFAULT_EXPLORE_SORT) {
    params.set("sort", filters.sort);
  }
  if (filters.page && filters.page > 1) {
    params.set("page", String(filters.page));
  }

  const query = params.toString();
  return query ? `/explore?${query}` : "/explore";
}

export function explorePathWith(
  current: ExploreSearchParams,
  patch: Partial<ExploreSearchParams>,
): string {
  return buildExplorePath({
    ...current,
    page: 1,
    ...patch,
  });
}

export function hasActiveExploreFilters(filters: ExploreSearchParams): boolean {
  return Boolean(filters.q || filters.type || filters.category || filters.tag || filters.season);
}
