import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { mapResourceSummary } from "../db/mappers.ts";
import { hasPublicRating } from "../utils/format-count.ts";

const card = readFileSync(
  new URL("../../components/resources/resource-card.tsx", import.meta.url),
  "utf8",
);
const stats = readFileSync(
  new URL("../../components/resources/resource-stats.tsx", import.meta.url),
  "utf8",
);
const mapper = readFileSync(new URL("../db/mappers.ts", import.meta.url), "utf8");

const baseRow = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Mecanum Intake",
  slug: "mecanum-intake",
  resource_type: "CAD" as const,
  description: "A 3-stage intake.",
  thumbnail_url: null,
};

test("resource summaries map rating count from resource_stats", () => {
  const resource = mapResourceSummary(baseRow, {
    rating_average: 4.8,
    rating_count: 24,
    download_count: 327,
    favorite_count: 81,
  });
  assert.equal(resource.ratingAverage, 4.8);
  assert.equal(resource.ratingCount, 24);
  assert.equal(resource.downloadCount, 327);
  assert.equal(resource.favoriteCount, 81);
  assert.match(mapper, /ratingCount: stats\?\.rating_count/);
});

test("missing stats stay empty instead of pretending to be rated", () => {
  const resource = mapResourceSummary(baseRow);
  assert.equal(resource.ratingAverage, null);
  assert.equal(resource.ratingCount, null);
  assert.equal(resource.downloadCount, null);
  assert.equal(resource.favoriteCount, null);
  assert.equal(hasPublicRating(resource), false);
  assert.equal(hasPublicRating({ ratingAverage: 0, ratingCount: 0 }), false);
});

test("resource cards show social proof without nested controls or private storage", () => {
  assert.match(card, /<ResourceStats resource=\{resource\} \/>/);
  assert.match(card, /line-clamp-2/);
  assert.match(stats, /hasPublicRating/);
  assert.match(stats, /sr-only/);
  assert.doesNotMatch(card, /<button/);
  assert.doesNotMatch(card, /\/api\/previews/);
  assert.doesNotMatch(card, /\/api\/downloads/);
  assert.doesNotMatch(card, /resource-files/);
});
