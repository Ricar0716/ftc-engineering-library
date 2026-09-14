import type { Metadata } from "next";
import { siteConfig } from "../config/site.ts";
import { DEFAULT_EXPLORE_SORT, RESOURCE_TYPE_LABELS } from "../constants/resources.ts";
import { publicCardImageUrl } from "../discovery/thumbnail.ts";
import { hasActiveExploreFilters, parseExploreSearchParams } from "../search/params.ts";
import { indexRobots, noIndexRobots } from "./robots.ts";
import { absoluteUrl, canonicalUrl } from "./site-url.ts";
import type { ResourceType } from "../../types/resources.ts";

const DESCRIPTION_MIN = 40;
const DESCRIPTION_MAX = 160;

export function resourceSeoDescription(
  title: string,
  description: string | null | undefined,
  type: ResourceType,
): string {
  const trimmed = (description ?? "").replace(/\s+/g, " ").trim();
  if (trimmed.length >= DESCRIPTION_MIN) {
    return trimmed.length > DESCRIPTION_MAX ? `${trimmed.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…` : trimmed;
  }
  return `Explore ${title}, a ${RESOURCE_TYPE_LABELS[type]} resource shared on ${siteConfig.name}.`;
}

export function notFoundMetadata(
  kind: "page" | "resource" | "profile" | "team" = "page",
): Metadata {
  const titles = {
    page: "Page not found",
    resource: "Resource not found",
    profile: "Profile not found",
    team: "Team not found",
  } as const;
  return {
    title: titles[kind],
    description: "That page is not available in the public library.",
    robots: noIndexRobots,
  };
}

export function publicPageMetadata(input: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  type?: "website" | "article" | "profile";
  imagePath?: string | null;
}): Metadata {
  const url = canonicalUrl(input.path);
  const index = input.index !== false;
  const publicImage = publicCardImageUrl(input.imagePath ?? null);

  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    robots: index ? indexRobots : noIndexRobots,
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: siteConfig.name,
      type: input.type ?? "website",
      ...(publicImage ? { images: [{ url: absoluteUrl(publicImage) }] } : {}),
    },
  };
}

export function exploreIsIndexable(
  input: Record<string, string | string[] | undefined>,
): boolean {
  const filters = parseExploreSearchParams(input);
  return (
    !hasActiveExploreFilters(filters) &&
    filters.page <= 1 &&
    filters.sort === DEFAULT_EXPLORE_SORT
  );
}

export function truncateSeoText(value: string | null | undefined, fallback: string): string {
  const trimmed = (value ?? "").replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed.length > DESCRIPTION_MAX ? `${trimmed.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…` : trimmed;
}
