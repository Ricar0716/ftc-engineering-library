import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const homepage = readFileSync(new URL("../../app/(public)/page.tsx", import.meta.url), "utf8");
const explore = readFileSync(new URL("../../app/(public)/explore/page.tsx", import.meta.url), "utf8");
const card = readFileSync(
  new URL("../../components/resources/resource-card.tsx", import.meta.url),
  "utf8",
);
const list = readFileSync(new URL("../db/resources.ts", import.meta.url), "utf8");
const hero = readFileSync(
  new URL("../../components/discovery/homepage-hero.tsx", import.meta.url),
  "utf8",
);

test("the homepage loads published lists, not drafts or CAD viewers", () => {
  assert.match(homepage, /listPublishedResources/);
  assert.match(homepage, /<HomepageHero/);
  assert.match(homepage, /<FeaturedResources/);
  assert.match(homepage, /<CategorySection type="CAD"/);
  assert.doesNotMatch(homepage, /CADPreview/);
  assert.doesNotMatch(homepage, /ModelViewer/);
  assert.doesNotMatch(homepage, /fetchPreviewBytes/);
  assert.doesNotMatch(homepage, /status: "DRAFT"/);
});

test("homepage copy does not invent statistics", () => {
  assert.match(hero, /publishedCount/);
  assert.doesNotMatch(hero, /1,000/);
  assert.doesNotMatch(hero, /10k/);
});

test("resource cards link to the public slug and never embed private storage", () => {
  assert.match(card, /href \?\? `\/resources\/\$\{resource\.slug\}`/);
  assert.match(card, /publicCardImageUrl/);
  assert.doesNotMatch(card, /\/api\/previews/);
  assert.doesNotMatch(card, /\/api\/downloads/);
  assert.doesNotMatch(card, /resource-files/);
  assert.doesNotMatch(card, /createSignedUrl/);
});

test("explore uses URL filters, pagination, and empty states", () => {
  assert.match(explore, /parseExploreSearchParams/);
  assert.match(explore, /<SearchResults/);
  assert.match(explore, /<ResourceFilters/);
  assert.doesNotMatch(explore, /CADPreview/);
  assert.doesNotMatch(explore, /ModelViewer/);
});

test("public resource lists always constrain PUBLISHED and PUBLIC", () => {
  assert.match(list, /eq\("status", "PUBLISHED"\)\.eq\("visibility", "PUBLIC"\)/);
  assert.doesNotMatch(list, /eq\("status", "DRAFT"\)/);
});
