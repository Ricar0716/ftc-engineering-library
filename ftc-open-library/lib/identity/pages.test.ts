import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const profilePage = readFileSync(
  new URL("../../app/(public)/profile/[username]/page.tsx", import.meta.url),
  "utf8",
);
const profileDb = readFileSync(new URL("../db/profiles.ts", import.meta.url), "utf8");
const teamPage = readFileSync(
  new URL("../../app/(public)/teams/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const teamDb = readFileSync(new URL("../db/teams.ts", import.meta.url), "utf8");
const counts = readFileSync(new URL("../db/resources.ts", import.meta.url), "utf8");
const hero = readFileSync(
  new URL("../../components/resources/resource-hero.tsx", import.meta.url),
  "utf8",
);
const author = readFileSync(
  new URL("../../components/resources/resource-author-card.tsx", import.meta.url),
  "utf8",
);
const header = readFileSync(
  new URL("../../components/profile/profile-header.tsx", import.meta.url),
  "utf8",
);
const stats = readFileSync(
  new URL("../../components/profile/profile-stats.tsx", import.meta.url),
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

test("public profiles render identity fields and never select email", () => {
  assert.match(profilePage, /<ProfileHeader profile=\{profile\}/);
  assert.match(profilePage, /<ProfileStats counts=\{counts\}/);
  assert.match(profilePage, /<ProfileResources/);
  assert.match(header, /joinedAt/);
  assert.match(header, /profile\.bio/);
  assert.match(header, /UserAvatar/);
  assert.match(profileDb, /select\("id, username, display_name, avatar_url, bio, created_at"\)/);
  assert.doesNotMatch(profileDb, /email/);
  assert.doesNotMatch(profilePage, /email/);
  assert.doesNotMatch(header, /email/);
});

test("profile and team lists only ask for published public resources", () => {
  assert.match(profilePage, /listPublishedResources/);
  assert.match(profilePage, /countPublishedResources\(\{ authorId: profile\.id \}\)/);
  assert.match(teamPage, /listTeamResources/);
  assert.match(teamPage, /countPublishedResources\(\{ teamId: team\.id \}\)/);
  assert.match(counts, /eq\("status", "PUBLISHED"\)\.eq\("visibility", "PUBLIC"\)/);
  assert.match(teamDb, /eq\("status", "PUBLISHED"\)/);
  assert.match(teamDb, /eq\("visibility", "PUBLIC"\)/);
  assert.doesNotMatch(profilePage, /DRAFT/);
  assert.doesNotMatch(profilePage, /FavoriteButton/);
  assert.doesNotMatch(teamPage, /PENDING_REVIEW/);
  assert.doesNotMatch(profileResources, /SearchResultCard/);
  assert.match(profileResources, /ResourceGrid/);
  assert.match(teamResources, /ResourceGrid/);
});

test("contribution stats use real type counts and no invented popularity", () => {
  assert.match(stats, /RESOURCE_TYPES/);
  assert.match(stats, /counts\.total/);
  assert.match(stats, /counts\.byType\[type\]/);
  assert.doesNotMatch(stats, /followers/i);
  assert.doesNotMatch(stats, /reputation/i);
  assert.doesNotMatch(teamPage, /leaderboard/i);
});

test("resource attribution links to contributor and team identity pages", () => {
  assert.match(hero, /contributorHref\(resource\.authorUsername\)/);
  assert.match(hero, /teamHref\(resource\.teamSlug\)/);
  assert.match(hero, /teamIdentityLabel/);
  assert.match(author, /contributorHref\(resource\.authorUsername\)/);
  assert.match(author, /teamHref\(resource\.teamSlug\)/);
  assert.doesNotMatch(author, /Follow/);
  assert.doesNotMatch(author, /Message/);
});
