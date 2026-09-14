import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const layout = readFileSync(new URL("../../app/dashboard/layout.tsx", import.meta.url), "utf8");
const overview = readFileSync(new URL("../../app/dashboard/page.tsx", import.meta.url), "utf8");
const resources = readFileSync(
  new URL("../../app/dashboard/resources/page.tsx", import.meta.url),
  "utf8",
);
const drafts = readFileSync(new URL("../../app/dashboard/drafts/page.tsx", import.meta.url), "utf8");
const reviews = readFileSync(new URL("../../app/dashboard/reviews/page.tsx", import.meta.url), "utf8");
const versions = readFileSync(
  new URL("../../app/dashboard/versions/page.tsx", import.meta.url),
  "utf8",
);
const profile = readFileSync(new URL("../../app/dashboard/profile/page.tsx", import.meta.url), "utf8");
const team = readFileSync(new URL("../../app/dashboard/team/page.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(
  new URL("../../components/dashboard/dashboard-sidebar.tsx", import.meta.url),
  "utf8",
);
const resourceRow = readFileSync(
  new URL("../../components/dashboard/dashboard-resource-row.tsx", import.meta.url),
  "utf8",
);
const versionRow = readFileSync(
  new URL("../../components/dashboard/dashboard-version-row.tsx", import.meta.url),
  "utf8",
);
const nav = readFileSync(new URL("./nav.ts", import.meta.url), "utf8");
const myResources = readFileSync(new URL("../../app/my/resources/page.tsx", import.meta.url), "utf8");

test("dashboard layout hosts a collapsible workspace nav", () => {
  assert.match(layout, /DashboardSidebar/);
  assert.match(sidebar, /<details/);
  assert.match(sidebar, /lg:hidden/);
  assert.match(sidebar, /Workspace/);
  assert.match(sidebar, /visibleDashboardNav/);
  assert.match(nav, /label: "My Resources"/);
  assert.match(nav, /label: "Saved Resources"/);
});

test("overview cards use real counts and published ResourceCard previews", () => {
  assert.match(overview, /getDashboardCounts/);
  assert.match(overview, /ResourceGrid/);
  assert.match(overview, /listOwnPublishedResourceCards/);
  assert.match(overview, /isDiscussionEnabled/);
  assert.match(overview, /label="Questions"/);
  assert.doesNotMatch(overview, /reputation/i);
  assert.doesNotMatch(overview, /leaderboard/i);
  assert.doesNotMatch(overview, /notification/i);
});

test("own resources, drafts, reviews, and versions render management links not a new editor", () => {
  assert.match(resources, /listOwnDashboardResources/);
  assert.match(resources, /status=\$\{value\}/);
  assert.match(resources, /filter === "published"/);
  assert.match(drafts, /"drafts"/);
  assert.match(resourceRow, /Continue editing/);
  assert.match(resourceRow, /\/my\/resources\/\$\{resource\.id\}\/edit/);
  assert.match(reviews, /listOwnPendingRevisionRows/);
  assert.match(reviews, /You cannot publish these yourself/);
  assert.match(versions, /listOwnDashboardVersions/);
  assert.match(versionRow, /View version/);
  assert.match(versionRow, /Submitted \$\{formatDisplayDate\(version\.submittedAt\)/);
  assert.match(versionRow, /Created \$\{formatDisplayDate\(version\.createdAt\)/);
  assert.doesNotMatch(resources, /<textarea/i);
});

test("profile is read-only and team membership is display-only", () => {
  assert.match(profile, /read-only/);
  assert.match(profile, /View public profile/);
  assert.doesNotMatch(profile, /<form/);
  assert.match(team, /listOwnDashboardTeams/);
  assert.match(team, /Team management is not available/);
  assert.doesNotMatch(team, /invite/i);
});

test("legacy my resources list redirects into the dashboard workspace", () => {
  assert.match(myResources, /redirect\("\/dashboard\/resources/);
});
