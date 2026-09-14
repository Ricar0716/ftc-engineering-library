import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const queries = readFileSync(new URL("./queries.ts", import.meta.url), "utf8");
const layout = readFileSync(new URL("../../app/dashboard/layout.tsx", import.meta.url), "utf8");
const favorites = readFileSync(
  new URL("../../app/dashboard/favorites/page.tsx", import.meta.url),
  "utf8",
);
const resources = readFileSync(
  new URL("../../app/dashboard/resources/page.tsx", import.meta.url),
  "utf8",
);
const versions = readFileSync(
  new URL("../../app/dashboard/versions/page.tsx", import.meta.url),
  "utf8",
);
const discussions = readFileSync(
  new URL("../../app/dashboard/discussions/page.tsx", import.meta.url),
  "utf8",
);
const session = readFileSync(new URL("../auth/session.ts", import.meta.url), "utf8");

test("guests are redirected to login before any dashboard page renders", () => {
  assert.match(layout, /requireSignedInPage\("\/dashboard"\)/);
  assert.match(session, /export async function requireSignedInPage/);
  assert.match(session, /access\.level === "guest"/);
  assert.match(session, /loginPath\(nextPath\)/);
});

test("dashboard resource, version, discussion, and team queries are scoped to the signed-in user", () => {
  assert.match(queries, /\.eq\("author_id", userId\)/);
  assert.match(queries, /\.eq\("resources\.author_id", userId\)/);
  assert.match(queries, /\.eq\("user_id", userId\)/);
  assert.match(queries, /resource\.author_id !== userId/);
  assert.doesNotMatch(queries, /getConfiguredAdminClient/);
  assert.doesNotMatch(queries, /createAdminClient/);
  assert.doesNotMatch(queries, /SERVICE_ROLE/);
});

test("dashboard lists do not load another user's id from the URL and do not show review notes", () => {
  assert.doesNotMatch(resources, /query\.userId|searchParams\.userId|\.get\("userId"\)/);
  assert.doesNotMatch(versions, /query\.userId|searchParams\.userId|\.get\("userId"\)/);
  assert.doesNotMatch(discussions, /query\.userId|searchParams\.userId|\.get\("userId"\)/);
  assert.doesNotMatch(queries, /latestReview/);
  assert.doesNotMatch(queries, /reviewer_id/);
  assert.doesNotMatch(queries, /from\("resource_reviews"\)/);
});

test("saved resources reuse the existing favorites queries", () => {
  assert.match(favorites, /listOwnPublishedFavorites/);
  assert.match(favorites, /requireVerifiedPage/);
  assert.match(favorites, /ResourceGrid/);
  assert.doesNotMatch(favorites, /from\("favorites"\)/);
});

test("discussion and team stats reuse published counts instead of loading full histories", () => {
  assert.match(queries, /countPublishedResources/);
  assert.match(queries, /resources\.visibility", "PUBLIC"/);
  assert.doesNotMatch(queries, /select\("team_id"\)/);
});
