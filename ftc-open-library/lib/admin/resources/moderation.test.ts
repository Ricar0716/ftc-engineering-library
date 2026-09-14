import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isPubliclyVisible, statusAfterDecision } from "../../resources/transitions.ts";

const queries = readFileSync(new URL("./queries.ts", import.meta.url), "utf8");
const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const reviewActions = readFileSync(new URL("../review-actions.ts", import.meta.url), "utf8");
const listPage = readFileSync(new URL("../../../app/admin/resources/page.tsx", import.meta.url), "utf8");
const detailPage = readFileSync(
  new URL("../../../app/admin/resources/[id]/page.tsx", import.meta.url),
  "utf8",
);
const detail = readFileSync(
  new URL("../../../components/admin/resources/resource-review-detail.tsx", import.meta.url),
  "utf8",
);
const card = readFileSync(
  new URL("../../../components/admin/resources/resource-review-card.tsx", import.meta.url),
  "utf8",
);
const moderationActions = readFileSync(
  new URL("../../../components/admin/resources/moderation-actions.tsx", import.meta.url),
  "utf8",
);
const note = readFileSync(
  new URL("../../../components/admin/resources/moderation-note.tsx", import.meta.url),
  "utf8",
);
const layout = readFileSync(new URL("../../../app/admin/layout.tsx", import.meta.url), "utf8");
const publicPage = readFileSync(
  new URL("../../../app/(public)/resources/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const dashboardReviews = readFileSync(
  new URL("../../../app/dashboard/reviews/page.tsx", import.meta.url),
  "utf8",
);
const previewRoute = readFileSync(
  new URL("../../../app/api/previews/[fileId]/route.ts", import.meta.url),
  "utf8",
);
const privateFiles = readFileSync(
  new URL("../../../app/api/resource-files/[fileId]/route.ts", import.meta.url),
  "utf8",
);

test("admin resource list queries require a Site Admin and the cookie client", () => {
  assert.match(queries, /requireSiteAdmin/);
  assert.match(queries, /getConfiguredServerClient/);
  assert.match(queries, /eq\("status", status\)/);
  assert.doesNotMatch(queries, /getConfiguredAdminClient/);
  assert.doesNotMatch(queries, /createAdminClient/);
  assert.doesNotMatch(queries, /SERVICE_ROLE/);
  assert.doesNotMatch(queries, /select\("email/i);
  assert.doesNotMatch(queries, /storage_path/);
  assert.doesNotMatch(queries, /storage_bucket/);
});

test("admin resource routes stay behind the existing admin layout gate", () => {
  assert.match(layout, /requireAdminPage\("\/admin"\)/);
  assert.match(listPage, /listAdminModerationResources/);
  assert.match(listPage, /parseAdminResourceFilter/);
  assert.match(listPage, /ADMIN_RESOURCE_FILTERS/);
  assert.match(listPage, /ADMIN_RESOURCE_FILTER_LABELS/);
  assert.match(detailPage, /getSubmissionDetail/);
  assert.match(detailPage, /ResourceReviewDetail/);
});

test("first-publish decisions reuse review_resource instead of a second moderation RPC", () => {
  assert.match(actions, /export \{ reviewResource \} from "@\/lib\/admin\/review-actions"/);
  assert.match(reviewActions, /requireSiteAdmin/);
  assert.match(reviewActions, /rpc\("review_resource"/);
  assert.match(reviewActions, /redirect\(`\/admin\/resources\/\$\{resourceId\}\?notice=\$\{notice\}`\)/);
  assert.doesNotMatch(actions, /rpc\(/);
  assert.doesNotMatch(reviewActions, /review_resource_revision/);
});

test("the resource review detail reuses ResourcePreview and existing review actions", () => {
  assert.match(detail, /<ResourcePreview/);
  assert.match(detail, /<ResourcePreviewCard>/);
  assert.match(detail, /toPreviewFiles/);
  assert.match(detail, /isPreviewable/);
  assert.match(detail, /<ModerationActions/);
  assert.match(moderationActions, /ReviewDecisionForm/);
  assert.match(note, /ReviewHistory/);
  assert.match(note, /not shown on the public\s+resource page/);
  assert.doesNotMatch(detail, /ReviewRevisionForm/);
  assert.doesNotMatch(detail, /storagePath/);
  assert.doesNotMatch(detail, /storage_path/);
  assert.doesNotMatch(card, /storage_path/);
});

test("approving a resource does not approve later versions", () => {
  assert.match(detail, /does not approve future versions/);
  assert.match(detail, /\/admin\/versions\/\$\{pendingRevision\.id\}/);
  assert.doesNotMatch(detail, /review_resource_revision/);
});

test("admin moderation actions map to the existing resource statuses", () => {
  assert.equal(statusAfterDecision("APPROVED"), "PUBLISHED");
  assert.equal(statusAfterDecision("REJECTED"), "REJECTED");
  assert.equal(statusAfterDecision("CHANGES_REQUESTED"), "CHANGES_REQUESTED");
  assert.equal(isPubliclyVisible("PUBLISHED"), true);
  assert.equal(isPubliclyVisible("REJECTED"), false);
  assert.equal(isPubliclyVisible("PENDING_REVIEW"), false);
  assert.equal(isPubliclyVisible("CHANGES_REQUESTED"), false);
});

test("contributors can watch review status but cannot moderate", () => {
  assert.match(dashboardReviews, /You cannot publish these yourself/);
  assert.match(dashboardReviews, /listOwnDashboardResources/);
  assert.doesNotMatch(dashboardReviews, /reviewResource/);
  assert.doesNotMatch(dashboardReviews, /ReviewDecisionForm/);
  assert.doesNotMatch(publicPage, /ReviewHistory/);
  assert.doesNotMatch(publicPage, /ModerationNote/);
});

test("unpublished files stay behind the existing private preview and download checks", () => {
  assert.match(previewRoute, /can_manage_resource/);
  assert.match(previewRoute, /access\.isSiteAdmin/);
  assert.match(previewRoute, /unpublishedVersion/);
  assert.match(previewRoute, /catalogPreview/);
  assert.match(privateFiles, /can_manage_resource/);
  assert.match(privateFiles, /!manageable && !access\.isSiteAdmin/);
  assert.doesNotMatch(previewRoute, /searchParams\.get\(["']bucket["']\)/);
});
