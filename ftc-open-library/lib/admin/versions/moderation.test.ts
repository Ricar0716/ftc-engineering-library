import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { latestPublishedVersion, selectPublishedVersion } from "../../versioning/queries.ts";
import type { ResourceVersionSummary } from "@/types/resources";

const queries = readFileSync(new URL("./queries.ts", import.meta.url), "utf8");
const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const versionActions = readFileSync(new URL("../../versioning/actions.ts", import.meta.url), "utf8");
const sql = readFileSync(
  new URL("../../../supabase/migrations/20260909200000_resource_versioning.sql", import.meta.url),
  "utf8",
);
const listPage = readFileSync(new URL("../../../app/admin/versions/page.tsx", import.meta.url), "utf8");
const detailPage = readFileSync(
  new URL("../../../app/admin/versions/[versionId]/page.tsx", import.meta.url),
  "utf8",
);
const detail = readFileSync(
  new URL("../../../components/admin/versions/version-review-detail.tsx", import.meta.url),
  "utf8",
);
const card = readFileSync(
  new URL("../../../components/admin/versions/version-review-card.tsx", import.meta.url),
  "utf8",
);
const moderationActions = readFileSync(
  new URL("../../../components/admin/versions/version-moderation-actions.tsx", import.meta.url),
  "utf8",
);
const layout = readFileSync(new URL("../../../app/admin/layout.tsx", import.meta.url), "utf8");
const queueRedirect = readFileSync(new URL("../../../app/admin/review/page.tsx", import.meta.url), "utf8");
const reviewRedirect = readFileSync(
  new URL("../../../app/admin/review/[resourceId]/page.tsx", import.meta.url),
  "utf8",
);
const publicPage = readFileSync(
  new URL("../../../app/(public)/resources/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const publicLoad = readFileSync(new URL("../../db/resources.ts", import.meta.url), "utf8");
const previewRoute = readFileSync(
  new URL("../../../app/api/previews/[fileId]/route.ts", import.meta.url),
  "utf8",
);
const downloadRoute = readFileSync(
  new URL("../../../app/api/downloads/[fileId]/route.ts", import.meta.url),
  "utf8",
);
const dashboardReviews = readFileSync(
  new URL("../../../app/dashboard/reviews/page.tsx", import.meta.url),
  "utf8",
);
const dashboardVersions = readFileSync(
  new URL("../../../app/dashboard/versions/page.tsx", import.meta.url),
  "utf8",
);
const nav = readFileSync(new URL("../nav.ts", import.meta.url), "utf8");
const canEditVersion = sql.slice(
  sql.indexOf("FUNCTION public.can_edit_version(p_version_id uuid)"),
  sql.indexOf("\n$$;", sql.indexOf("FUNCTION public.can_edit_version(p_version_id uuid)")),
);
const reviewRevision = sql.slice(
  sql.indexOf("FUNCTION public.review_resource_revision("),
  sql.indexOf("\n$$;", sql.indexOf("FUNCTION public.review_resource_revision(")),
);

function version(partial: Partial<ResourceVersionSummary> & Pick<ResourceVersionSummary, "id" | "versionNumber" | "status">): ResourceVersionSummary {
  return {
    versionLabel: null,
    changelog: null,
    releasedAt: null,
    createdAt: "2026-09-01T00:00:00Z",
    ...partial,
  };
}

test("admin version list queries require a Site Admin and the cookie client", () => {
  assert.match(queries, /requireSiteAdmin/);
  assert.match(queries, /getConfiguredServerClient/);
  assert.match(queries, /gt\("version_number", 1\)/);
  assert.match(queries, /eq\("resources\.status", "PUBLISHED"\)/);
  assert.doesNotMatch(queries, /getConfiguredAdminClient/);
  assert.doesNotMatch(queries, /SERVICE_ROLE/);
  assert.doesNotMatch(queries, /select\("email/i);
  assert.doesNotMatch(queries, /storage_path/);
  assert.doesNotMatch(queries, /storage_bucket/);
});

test("admin version routes stay behind the existing admin layout gate", () => {
  assert.match(layout, /requireAdminPage\("\/admin"\)/);
  assert.match(listPage, /listAdminModerationVersions/);
  assert.match(listPage, /parseAdminVersionFilter/);
  assert.match(detailPage, /getAdminVersionReview/);
  assert.match(detailPage, /VersionReviewDetail/);
  assert.match(nav, /href: "\/admin\/versions"/);
  const later = nav.slice(nav.indexOf("adminNavLater"));
  assert.doesNotMatch(later, /"Versions"/);
});

test("version decisions reuse review_resource_revision instead of review_resource", () => {
  assert.match(actions, /export \{ reviewResourceRevision \} from "@\/lib\/versioning\/actions"/);
  assert.match(versionActions, /canAccessAdmin/);
  assert.match(versionActions, /rpc\("review_resource_revision"/);
  assert.match(versionActions, /redirect\(`\/admin\/versions\/\$\{versionId\}\?notice=\$\{notice\}`\)/);
  assert.doesNotMatch(actions, /rpc\(/);
  assert.doesNotMatch(versionActions, /rpc\("review_resource"\)/);
  assert.match(reviewRevision, /is_site_admin\(\)/);
  assert.match(reviewRevision, /auth\.uid\(\)/);
  assert.match(reviewRevision, /INSERT INTO public\.resource_reviews \(resource_id, version_id/);
});

test("the version review detail previews submitted files, not the live release", () => {
  assert.match(detail, /<ResourcePreview/);
  assert.match(detail, /toPreviewFiles\(submittedFiles\)/);
  assert.match(detail, /Preview uses files from \{submittedName\}/);
  assert.match(detail, /<VersionModerationActions/);
  assert.match(moderationActions, /ReviewRevisionForm/);
  assert.doesNotMatch(detail, /ReviewDecisionForm/);
  assert.doesNotMatch(detail, /storagePath/);
  assert.doesNotMatch(card, /storage_path/);
});

test("approving a version does not unpublish the resource or rewrite the previous release", () => {
  assert.match(reviewRevision, /r\.status <> 'PUBLISHED'/);
  assert.match(reviewRevision, /SET status = 'PUBLISHED'/);
  assert.match(reviewRevision, /SET status = 'DRAFT'/);
  assert.match(reviewRevision, /SET status = 'ARCHIVED'/);
  assert.doesNotMatch(reviewRevision, /UPDATE public\.resources SET status/);
  assert.doesNotMatch(reviewRevision, /DELETE FROM public\.resource_versions/);
  assert.doesNotMatch(reviewRevision, /DELETE FROM public\.resource_files/);
  assert.match(detail, /without\s+unpublishing the resource/);
});

test("latest published version is the highest published number, not a second current flag", () => {
  const versions = [
    version({ id: "v2", versionNumber: 2, status: "PUBLISHED", versionLabel: "v1.1" }),
    version({ id: "v1", versionNumber: 1, status: "PUBLISHED", versionLabel: "v1.0" }),
    version({ id: "v3", versionNumber: 3, status: "PENDING_REVIEW", versionLabel: "v1.2" }),
  ];
  assert.equal(latestPublishedVersion(versions)?.id, "v2");
  assert.equal(selectPublishedVersion(versions, null)?.id, "v2");
  assert.equal(selectPublishedVersion(versions, 1)?.id, "v1");
  assert.equal(selectPublishedVersion(versions, 3)?.id, "v2");
  assert.match(queries, /latestPublishedVersion/);
  assert.doesNotMatch(sql, /is_current/);
  assert.doesNotMatch(sql, /current_version_id/);
});

test("public catalog and downloads still hide unpublished versions", () => {
  assert.match(publicLoad, /filter\(\(version\) => version\.status === "PUBLISHED"\)/);
  assert.match(publicLoad, /publishedVersionIds\.has\(file\.versionId\)/);
  assert.match(publicPage, /selectPublishedVersion/);
  assert.match(downloadRoute, /version\.status !== "PUBLISHED"/);
  assert.doesNotMatch(publicPage, /PENDING_REVIEW/);
  assert.doesNotMatch(downloadRoute, /isSiteAdmin/);
});

test("admins and managers may preview unpublished revision files; guests cannot", () => {
  assert.match(previewRoute, /unpublishedVersion/);
  assert.match(previewRoute, /catalogPreview/);
  assert.match(previewRoute, /can_manage_resource/);
  assert.match(previewRoute, /access\.isSiteAdmin/);
  assert.match(previewRoute, /access\.level === "guest"/);
  assert.doesNotMatch(previewRoute, /searchParams\.get\(["']bucket["']\)/);
});

test("contributors can watch version status but cannot approve their own revision", () => {
  assert.match(dashboardReviews, /listOwnPendingRevisionRows/);
  assert.match(dashboardVersions, /listOwnDashboardVersions/);
  assert.doesNotMatch(dashboardReviews, /reviewResourceRevision/);
  assert.doesNotMatch(dashboardVersions, /ReviewRevisionForm/);
  assert.match(canEditVersion, /v\.status = 'DRAFT'/);
  assert.doesNotMatch(canEditVersion, /PENDING_REVIEW/);
  assert.doesNotMatch(canEditVersion, /PUBLISHED/);
});

test("the mixed review queue redirects instead of duplicating moderation", () => {
  assert.match(queueRedirect, /redirect\("\/admin\/versions"\)/);
  assert.match(reviewRedirect, /\/admin\/versions\/\$\{query\.version\}/);
  assert.match(reviewRedirect, /\/admin\/resources\/\$\{resourceId\}/);
});

test("version review queue uses version creator and submitted_at", () => {
  assert.match(queries, /creator:profiles!created_by/);
  assert.match(queries, /order\("submitted_at"/);
  assert.match(card, /Submitted by \{submittedBy\}/);
  assert.match(detail, /Original resource author/);
  assert.match(detail, /formatDisplayDate\(version\.submittedAt\)/);
});
