import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { contributeActionLabel, GUEST_ACCESS } from "../auth/permissions.ts";
import { DISCOVERY_EMPTY, exploreEmptyCopy } from "../discovery/empty.ts";
import { publicDownloadError } from "../downloads/messages.ts";
import { DETAIL_EMPTY, fileDownloadLabel, primaryDownloadAction } from "../resources/detail-ui.ts";
import { parseExploreSearchParams } from "../search/params.ts";
import { requestedPublishedVersionMissing, selectPublishedVersion } from "../versioning/queries.ts";
import type { ResourceVersionSummary } from "../../types/resources.ts";

const exploreResults = readFileSync(
  new URL("../../components/search/search-results.tsx", import.meta.url),
  "utf8",
);
const activeFilters = readFileSync(
  new URL("../../components/search/active-filters.tsx", import.meta.url),
  "utf8",
);
const resourceNotFound = readFileSync(
  new URL("../../app/(public)/resources/[slug]/not-found.tsx", import.meta.url),
  "utf8",
);
const globalNotFound = readFileSync(new URL("../../app/not-found.tsx", import.meta.url), "utf8");
const notFoundPanel = readFileSync(
  new URL("../../components/layout/not-found-panel.tsx", import.meta.url),
  "utf8",
);
const related = readFileSync(
  new URL("../../components/resources/resource-related.tsx", import.meta.url),
  "utf8",
);
const explorer = readFileSync(
  new URL("../../components/resources/resource-file-explorer.tsx", import.meta.url),
  "utf8",
);
const modelViewer = readFileSync(
  new URL("../../components/viewer/model-viewer.tsx", import.meta.url),
  "utf8",
);
const codePreview = readFileSync(
  new URL("../../components/previews/code-preview.tsx", import.meta.url),
  "utf8",
);
const downloadButton = readFileSync(
  new URL("../../components/resources/file-download-button.tsx", import.meta.url),
  "utf8",
);
const favorite = readFileSync(
  new URL("../../components/favorites/favorite-button.tsx", import.meta.url),
  "utf8",
);
const profileResources = readFileSync(
  new URL("../../components/profile/profile-resources.tsx", import.meta.url),
  "utf8",
);
const teamResources = readFileSync(
  new URL("../../components/teams/team-resources.tsx", import.meta.url),
  "utf8",
);
const resourcePage = readFileSync(
  new URL("../../app/(public)/resources/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const logo = readFileSync(new URL("../../components/layout/site-logo.tsx", import.meta.url), "utf8");
const hero = readFileSync(
  new URL("../../components/resources/resource-hero.tsx", import.meta.url),
  "utf8",
);
const card = readFileSync(
  new URL("../../components/resources/resource-card.tsx", import.meta.url),
  "utf8",
);
const errors = readFileSync(new URL("../resources/errors.ts", import.meta.url), "utf8");
const transport = readFileSync(new URL("../uploads/errors.ts", import.meta.url), "utf8");
const homepage = readFileSync(new URL("../../app/(public)/page.tsx", import.meta.url), "utf8");
const headerAuth = readFileSync(
  new URL("../../components/layout/header-auth-links.tsx", import.meta.url),
  "utf8",
);
const siteHeader = readFileSync(new URL("../../components/layout/site-header.tsx", import.meta.url), "utf8");

function published(versionNumber: number): ResourceVersionSummary {
  return {
    id: `v${versionNumber}`,
    versionNumber,
    versionLabel: `v${versionNumber}`,
    changelog: null,
    status: "PUBLISHED",
    releasedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

test("explore empty copy distinguishes a quiet library from active filters", () => {
  assert.deepEqual(exploreEmptyCopy(parseExploreSearchParams({})), {
    title: DISCOVERY_EMPTY.library,
    description: DISCOVERY_EMPTY.launch,
  });
  const filtered = exploreEmptyCopy(parseExploreSearchParams({ q: "intake", type: "CAD" }));
  assert.equal(filtered.title, DISCOVERY_EMPTY.search);
  assert.match(filtered.description, /removing some filters/);
  assert.match(exploreResults, /Clear filters/);
  assert.match(exploreResults, /hasActiveExploreFilters/);
  assert.match(activeFilters, /Clear filters/);
});

test("missing resources use a safe public not-found page", () => {
  assert.match(resourceNotFound, /Resource not found/);
  assert.match(resourceNotFound, /This resource is not available/);
  assert.match(globalNotFound, /NotFoundPanel/);
  assert.match(notFoundPanel, /Back to home/);
  assert.match(notFoundPanel, /Explore resources/);
  assert.doesNotMatch(resourceNotFound, /pending review/i);
  assert.doesNotMatch(resourceNotFound, /rejected/i);
});

test("optional related and file sections stay usable", () => {
  assert.match(related, /if \(resources\.length === 0\) \{\s*return null;/);
  assert.match(explorer, /DETAIL_EMPTY\.files/);
  assert.match(explorer, /This published version has no downloadable files/);
});

test("preview failures stay contained and offer a single retry", () => {
  assert.match(modelViewer, /Try again/);
  assert.match(modelViewer, /retryNonce/);
  assert.match(codePreview, /Try again/);
  assert.doesNotMatch(codePreview, /\beval\s*\(/);
});

test("guest and unverified download labels stay distinct and never point at storage", () => {
  const guest = primaryDownloadAction(GUEST_ACCESS, "/resources/demo");
  assert.equal(guest.label, "Sign in to download");
  assert.equal(fileDownloadLabel("verify"), "Verify your email to download");
  assert.doesNotMatch(guest.href, /storage|resource-files|signed/);
  assert.equal(publicDownloadError(404), "This file is no longer available.");
  assert.equal(publicDownloadError(403), "Verify your email to download published files.");
  assert.match(downloadButton, /<a\s+href=\{href\}/);
  assert.doesNotMatch(downloadButton, /\bfetch\s*\(/);
  assert.doesNotMatch(downloadButton, /redirect:\s*["']manual["']/);
  assert.match(explorer, /FileDownloadButton/);
});

test("invalid or unpublished version requests fall back without describing pending work", () => {
  const versions = [
    published(2),
    published(1),
    { ...published(3), id: "pending", status: "PENDING_REVIEW" as const },
  ];
  assert.equal(selectPublishedVersion(versions, 99)?.versionNumber, 2);
  assert.equal(requestedPublishedVersionMissing(versions, 99), true);
  assert.equal(requestedPublishedVersionMissing(versions, 3), true);
  assert.doesNotMatch(DETAIL_EMPTY.versionUnavailable, /PENDING|pending revision/i);
  assert.match(resourcePage, /requestedPublishedVersionMissing/);
});

test("favorite failures roll back optimistic state and expose accessible labels", () => {
  assert.match(favorite, /setSaved\(!next\)/);
  assert.match(favorite, /aria-label=\{saved \? "Remove this resource from saved items"/);
  assert.match(favorite, /Removing…/);
});

test("profile and team empty states remain intentional", () => {
  assert.match(profileResources, /No published resources yet/);
  assert.match(teamResources, /No published resources yet/);
  assert.match(profileResources, /Explore resources/);
});

test("public discussion stays gated off the resource page", () => {
  assert.match(resourcePage, /isDiscussionEnabled/);
  assert.match(resourcePage, /discussionEnabled \?/);
});

test("public cards and titles wrap instead of overflowing", () => {
  assert.match(hero, /break-words/);
  assert.match(card, /break-words/);
  assert.match(logo, /betaLabel/);
  assert.match(headerAuth, /hidden items-center gap-2 sm:flex/);
  assert.doesNotMatch(headerAuth, /hidden sm:inline-flex/);
  assert.match(siteHeader, /xl:block/);
});

test("contributor and upload errors stay mapped away from SQL and storage internals", () => {
  assert.match(errors, /raw SQL/);
  assert.match(errors, /Your unpublished storage quota is full/);
  assert.match(errors, /Your upload session expired/);
  assert.match(transport, /TRANSPORT_ERROR_MESSAGES/);
  assert.doesNotMatch(transport, /supabase/);
});

test("the homepage hides empty popular and type sections", () => {
  assert.match(homepage, /popular\.total === 0/);
  assert.match(homepage, /DISCOVERY_EMPTY\.launch/);
});

test("contribute labels distinguish guest, unverified, and verified users", () => {
  assert.equal(contributeActionLabel(GUEST_ACCESS), "Sign in to contribute");
  assert.equal(contributeActionLabel({ level: "unverified" }), "Verify to contribute");
  assert.equal(contributeActionLabel({ level: "verified" }), "Submit a resource");
});
