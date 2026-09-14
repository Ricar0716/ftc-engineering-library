import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isDiscussionEnabled } from "../config/features.ts";
import { siteConfig } from "../config/site.ts";
import {
  exploreIsIndexable,
  notFoundMetadata,
  publicPageMetadata,
  resourceSeoDescription,
} from "./metadata.ts";
import { canonicalUrl, getSiteUrl } from "./site-url.ts";

const rootLayout = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");
const resourcePage = readFileSync(
  new URL("../../app/(public)/resources/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const profilePage = readFileSync(
  new URL("../../app/(public)/profile/[username]/page.tsx", import.meta.url),
  "utf8",
);
const teamPage = readFileSync(
  new URL("../../app/(public)/teams/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const explorePage = readFileSync(
  new URL("../../app/(public)/explore/page.tsx", import.meta.url),
  "utf8",
);
const sitemap = readFileSync(new URL("../../app/sitemap.ts", import.meta.url), "utf8");
const robots = readFileSync(new URL("../../app/robots.ts", import.meta.url), "utf8");
const queries = readFileSync(new URL("./queries.ts", import.meta.url), "utf8");
const jsonLd = readFileSync(
  new URL("../../components/seo/resource-json-ld.tsx", import.meta.url),
  "utf8",
);
const adminLayout = readFileSync(new URL("../../app/admin/layout.tsx", import.meta.url), "utf8");
const dashboardLayout = readFileSync(
  new URL("../../app/dashboard/layout.tsx", import.meta.url),
  "utf8",
);
const authLayout = readFileSync(new URL("../../app/(auth)/layout.tsx", import.meta.url), "utf8");
const submitPage = readFileSync(new URL("../../app/submit/page.tsx", import.meta.url), "utf8");
const myLayout = readFileSync(new URL("../../app/my/layout.tsx", import.meta.url), "utf8");
const notFound = readFileSync(new URL("../../app/not-found.tsx", import.meta.url), "utf8");
const resourceNotFound = readFileSync(
  new URL("../../app/(public)/resources/[slug]/not-found.tsx", import.meta.url),
  "utf8",
);
const features = readFileSync(new URL("../config/features.ts", import.meta.url), "utf8");
const discussionActions = readFileSync(new URL("../discussion/actions.ts", import.meta.url), "utf8");
const dashboardNav = readFileSync(new URL("../dashboard/nav.ts", import.meta.url), "utf8");
const homepage = readFileSync(new URL("../../app/(public)/page.tsx", import.meta.url), "utf8");
const homepageHero = readFileSync(
  new URL("../../components/discovery/homepage-hero.tsx", import.meta.url),
  "utf8",
);
const dashboardOverview = readFileSync(
  new URL("../../app/dashboard/page.tsx", import.meta.url),
  "utf8",
);
const uploadPage = readFileSync(new URL("../../app/upload/page.tsx", import.meta.url), "utf8");

test("root metadata uses the site name and a title template", () => {
  assert.equal(siteConfig.name, "FTC Open Library");
  assert.equal(siteConfig.titleTemplate, "%s | FTC Open Library");
  assert.match(rootLayout, /template: siteConfig\.titleTemplate/);
  assert.match(rootLayout, /metadataBase: new URL\(getSiteUrl\(\)\)/);
  assert.match(siteConfig.description, /CAD, code, tutorials, and engineering models/);
});

test("canonical URLs use NEXT_PUBLIC_SITE_URL or a safe localhost fallback", () => {
  assert.equal(getSiteUrl(), "http://localhost:3000");
  assert.equal(canonicalUrl("/"), "http://localhost:3000");
  assert.equal(canonicalUrl("/explore"), "http://localhost:3000/explore");
  assert.equal(canonicalUrl("resources/demo"), "http://localhost:3000/resources/demo");
  const helper = readFileSync(new URL("./site-url.ts", import.meta.url), "utf8");
  assert.match(helper, /NEXT_PUBLIC_SITE_URL/);
  assert.match(helper, /VERCEL_URL/);
  assert.doesNotMatch(helper, /ftcopenlibrary\.com/);
});

test("published resource metadata is built from a public-only lightweight query", () => {
  assert.match(resourcePage, /getPublicResourceSeo/);
  assert.match(resourcePage, /resourceSeoDescription/);
  assert.match(queries, /eq\("status", "PUBLISHED"\)/);
  assert.match(queries, /eq\("visibility", "PUBLIC"\)/);
  assert.doesNotMatch(queries, /resource_files/);
  assert.doesNotMatch(queries, /resource_versions/);
  assert.doesNotMatch(queries, /storage_path/);
  assert.doesNotMatch(queries, /createSignedUrl/);
  assert.doesNotMatch(resourcePage, /getResourceBySlug\(slug\);\n\n  if \(!resource\) \{\n    return \{\n      title: resource/);
});

test("unpublished resources cannot leak a title through public metadata", () => {
  assert.match(
    resourcePage,
    /export async function generateMetadata[\s\S]*if \(!resource\) \{\s*notFound\(\);/,
  );
  assert.doesNotMatch(resourcePage, /return notFoundMetadata/);
  const missing = notFoundMetadata("resource");
  assert.equal(missing.title, "Resource not found");
  assert.deepEqual(missing.robots, { index: false, follow: false });
  assert.doesNotMatch(String(missing.title), /PENDING|DRAFT|Secret/);
  assert.match(resourceNotFound, /notFoundMetadata\("resource"\)/);
  assert.match(notFound, /notFoundMetadata\("page"\)/);
  assert.match(profilePage, /if \(!profile\) \{\s*notFound\(\);/);
  assert.match(teamPage, /if \(!team\) \{\s*notFound\(\);/);
});

test("resource description fallback is deterministic and not AI-generated", () => {
  assert.equal(
    resourceSeoDescription("Mecanum Drive Base", "   ", "CAD"),
    "Explore Mecanum Drive Base, a CAD resource shared on FTC Open Library.",
  );
  assert.equal(
    resourceSeoDescription("Short", "A complete mecanum chassis with updated wheel mounts and gearbox notes.", "CAD"),
    "A complete mecanum chassis with updated wheel mounts and gearbox notes.",
  );
});

test("sitemap lists only published public resources and does not include private routes", () => {
  assert.match(sitemap, /listPublicSitemapResources/);
  assert.match(sitemap, /listPublicSitemapProfiles/);
  assert.match(sitemap, /listPublicSitemapTeams/);
  assert.match(sitemap, /\/explore/);
  assert.doesNotMatch(sitemap, /\/admin/);
  assert.doesNotMatch(sitemap, /\/dashboard/);
  assert.doesNotMatch(sitemap, /\/login/);
  assert.doesNotMatch(sitemap, /\/submit/);
  assert.doesNotMatch(queries, /PENDING_REVIEW/);
  assert.doesNotMatch(queries, /status: "DRAFT"/);
  assert.doesNotMatch(queries, /resource_versions/);
});

test("robots.txt allows public pages and disallows private application routes", () => {
  assert.match(robots, /allow: "\/"/);
  assert.match(robots, /\/admin/);
  assert.match(robots, /\/dashboard/);
  assert.match(robots, /\/login/);
  assert.match(robots, /\/signup/);
  assert.match(robots, /\/submit/);
  assert.match(robots, /\/my\//);
  assert.match(robots, /Disallow is not access control/);
  assert.match(adminLayout, /robots: noIndexRobots/);
  assert.match(dashboardLayout, /robots: noIndexRobots/);
  assert.match(authLayout, /robots: noIndexRobots/);
  assert.match(submitPage, /index: false/);
  assert.match(myLayout, /robots: noIndexRobots/);
  assert.match(uploadPage, /robots: noIndexRobots/);
});

test("public profile metadata uses public identity fields only", () => {
  assert.match(profilePage, /getPublicProfileByUsername/);
  assert.match(profilePage, /profile\.displayName/);
  assert.match(profilePage, /profile\.bio/);
  assert.doesNotMatch(profilePage, /email/);
  assert.doesNotMatch(profilePage, /encrypted_password/);
  assert.match(teamPage, /FTC Team \$\{team\.teamNumber\}/);
  assert.doesNotMatch(teamPage, /team_members/);
});

test("explore search and filter URLs are not indexable duplicates", () => {
  assert.equal(exploreIsIndexable({}), true);
  assert.equal(exploreIsIndexable({ q: "mecanum" }), false);
  assert.equal(exploreIsIndexable({ type: "CAD" }), false);
  assert.equal(exploreIsIndexable({ tag: "intake" }), false);
  assert.equal(exploreIsIndexable({ page: "2" }), false);
  assert.match(explorePage, /exploreIsIndexable/);
  assert.match(explorePage, /path: "\/explore"/);
  const meta = publicPageMetadata({
    title: "Explore FTC Robotics Resources",
    description: "Search",
    path: "/explore",
    index: false,
  });
  assert.equal(meta.alternates?.canonical, "http://localhost:3000/explore");
  assert.deepEqual(meta.robots, { index: false, follow: false });
});

test("historical version query params canonicalize to the resource slug", () => {
  assert.match(resourcePage, /path: `\/resources\/\$\{resource\.slug\}`/);
  assert.doesNotMatch(resourcePage, /searchParams.*generateMetadata/);
  assert.doesNotMatch(sitemap, /version=/);
});

test("structured data is CreativeWork without invented ratings or offers", () => {
  assert.match(jsonLd, /CreativeWork/);
  assert.match(resourcePage, /<ResourceJsonLd/);
  assert.doesNotMatch(jsonLd, /aggregateRating/);
  assert.doesNotMatch(jsonLd, /offers/);
  assert.doesNotMatch(jsonLd, /downloadCount/);
  assert.doesNotMatch(jsonLd, /award/);
});

test("metadata never emits private storage or signed URLs", () => {
  assert.doesNotMatch(queries, /createSignedUrl/);
  assert.doesNotMatch(queries, /storage_path/);
  assert.doesNotMatch(jsonLd, /createSignedUrl/);
  assert.doesNotMatch(resourcePage, /\/api\/previews/);
  assert.doesNotMatch(resourcePage, /\/api\/downloads/);
  assert.match(queries, /thumbnail_url/);
});

test("public discussion is off for Beta while the implementation remains", () => {
  assert.equal(isDiscussionEnabled(), false);
  assert.match(features, /NEXT_PUBLIC_DISCUSSION_ENABLED === "true"/);
  assert.match(resourcePage, /isDiscussionEnabled/);
  assert.match(dashboardNav, /visibleDashboardNav/);
  assert.match(dashboardNav, /href: "\/dashboard\/discussions"/);
  assert.match(discussionActions, /DISCUSSION_ERRORS\.disabled/);
  assert.match(discussionActions, /createDiscussion/);
  assert.match(discussionActions, /hideDiscussion/);
  assert.match(dashboardOverview, /isDiscussionEnabled\(\) \?/);
  assert.match(dashboardOverview, /label="Questions"/);
});

test("the homepage keeps a single H1 and server-rendered public lists", () => {
  assert.match(homepage, /<HomepageHero/);
  assert.match(homepageHero, /<h1/);
  assert.match(homepageHero, /siteConfig\.description/);
  assert.match(homepage, /listPublishedResources/);
  assert.doesNotMatch(homepage, /CADPreview/);
});
