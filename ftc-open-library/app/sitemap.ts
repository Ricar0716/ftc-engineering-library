import type { MetadataRoute } from "next";
import {
  listPublicSitemapProfiles,
  listPublicSitemapResources,
  listPublicSitemapTeams,
} from "@/lib/seo/queries";
import { canonicalUrl, getSiteUrl } from "@/lib/seo/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = ["/", "/explore", "/about", "/teams"].map((path) => ({
    url: path === "/" ? getSiteUrl() : canonicalUrl(path),
    lastModified: now,
  }));

  const [resources, profiles, teams] = await Promise.all([
    listPublicSitemapResources(),
    listPublicSitemapProfiles(),
    listPublicSitemapTeams(),
  ]);

  return [
    ...staticPages,
    ...resources.map((entry) => ({
      url: canonicalUrl(entry.path),
      lastModified: entry.lastModified,
    })),
    ...profiles.map((entry) => ({
      url: canonicalUrl(entry.path),
      lastModified: entry.lastModified,
    })),
    ...teams.map((entry) => ({
      url: canonicalUrl(entry.path),
      lastModified: entry.lastModified,
    })),
  ];
}
