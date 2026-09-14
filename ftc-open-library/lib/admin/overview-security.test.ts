import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const queries = readFileSync(new URL("./queries.ts", import.meta.url), "utf8");
const layout = readFileSync(new URL("../../app/admin/layout.tsx", import.meta.url), "utf8");
const overview = readFileSync(new URL("../../app/admin/page.tsx", import.meta.url), "utf8");
const session = readFileSync(new URL("../auth/session.ts", import.meta.url), "utf8");
const permissions = readFileSync(new URL("../auth/permissions.ts", import.meta.url), "utf8");

test("admin layout is server-gated; guests log in and non-admins are forbidden", () => {
  assert.match(layout, /requireAdminPage\("\/admin"\)/);
  assert.match(session, /export async function requireAdminPage/);
  assert.match(session, /adminGate\(access\.level\)/);
  assert.match(session, /loginPath\(nextPath\)/);
  assert.match(session, /redirect\("\/forbidden"\)/);
  assert.match(permissions, /if \(level !== "admin"\)/);
  assert.doesNotMatch(layout, /canAccessAdmin\(/);
});

test("overview stats require a site admin session and use the cookie client", () => {
  assert.match(queries, /requireSiteAdmin/);
  assert.match(queries, /getConfiguredServerClient/);
  assert.doesNotMatch(queries, /getConfiguredAdminClient/);
  assert.doesNotMatch(queries, /createAdminClient/);
  assert.doesNotMatch(queries, /SERVICE_ROLE/);
});

test("overview queries return head counts only and never private fields", () => {
  assert.match(queries, /count: "exact", head: true/);
  assert.match(queries, /from\("profiles"\)/);
  assert.match(queries, /from\("resources"\)/);
  assert.match(queries, /from\("resource_versions"\)/);
  assert.match(queries, /from\("comments"\)/);
  assert.match(queries, /eq\("status", "PENDING_REVIEW"\)/);
  assert.match(queries, /eq\("status", "VISIBLE"\)/);
  assert.doesNotMatch(queries, /select\("email/i);
  assert.doesNotMatch(queries, /\.eq\("email"/);
  assert.doesNotMatch(queries, /storage_path/);
  assert.doesNotMatch(queries, /storage_bucket/);
  assert.doesNotMatch(queries, /from\("resource_reviews"\)/);
  assert.doesNotMatch(queries, /select\("\*"\)/);
  assert.doesNotMatch(queries, /title,/);
  assert.doesNotMatch(queries, /body,/);
});

test("overview UI renders real counts and does not invent analytics", () => {
  assert.match(overview, /getAdminOverviewStats/);
  assert.match(overview, /stats\.users/);
  assert.match(overview, /stats\.publishedResources/);
  assert.match(overview, /stats\.pendingReviews/);
  assert.match(overview, /stats\.pendingVersions/);
  assert.match(overview, /stats\.discussions/);
  assert.doesNotMatch(overview, /reputation/i);
  assert.doesNotMatch(overview, /leaderboard/i);
  assert.doesNotMatch(overview, /1,000/);
  assert.doesNotMatch(overview, /analytics/i);
});
