import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildExplorePath,
  explorePathWith,
  hasActiveExploreFilters,
  parseExploreSearchParams,
} from "./params.ts";
import { EXPLORE_SORT_OPTIONS } from "../constants/resources.ts";

const explore = readFileSync(new URL("../../app/(public)/explore/page.tsx", import.meta.url), "utf8");
const list = readFileSync(new URL("../db/resources.ts", import.meta.url), "utf8");
const expand = readFileSync(new URL("../db/search-expand.ts", import.meta.url), "utf8");
const results = readFileSync(
  new URL("../../components/search/search-results.tsx", import.meta.url),
  "utf8",
);
const filters = readFileSync(
  new URL("../../components/search/resource-filters.tsx", import.meta.url),
  "utf8",
);
const filterPanel = readFileSync(
  new URL("../../components/search/filter-panel.tsx", import.meta.url),
  "utf8",
);
const searchBar = readFileSync(
  new URL("../../components/search/search-bar.tsx", import.meta.url),
  "utf8",
);
const sortSelector = readFileSync(
  new URL("../../components/search/sort-selector.tsx", import.meta.url),
  "utf8",
);
const active = readFileSync(
  new URL("../../components/search/active-filters.tsx", import.meta.url),
  "utf8",
);

test("explore URL state covers query, type, category, tag, season, sort, and page", () => {
  const parsed = parseExploreSearchParams({
    q: "mecanum",
    type: "CAD",
    category: "11111111-1111-4111-8111-111111111111",
    tag: "drivetrain",
    season: "IntoDeep",
    sort: "newest",
    page: "2",
  });

  assert.equal(parsed.q, "mecanum");
  assert.equal(parsed.type, "CAD");
  assert.equal(parsed.category, "11111111-1111-4111-8111-111111111111");
  assert.equal(parsed.tag, "drivetrain");
  assert.equal(parsed.season, "IntoDeep");
  assert.equal(parsed.sort, "latest");
  assert.equal(parsed.page, 2);
  assert.equal(parseExploreSearchParams({ query: "intake" }).q, "intake");
  assert.equal(parseExploreSearchParams({ category: "drivetrain" }).category, null);
  assert.equal(parseExploreSearchParams({ type: "CODE" }).type, "CODE");
  assert.equal(parseExploreSearchParams({ type: "TUTORIAL" }).type, "TUTORIAL");
  assert.equal(parseExploreSearchParams({ type: "MODEL" }).type, "MODEL");
  assert.equal(parseExploreSearchParams({ sort: "updated" }).sort, "updated");
  assert.equal(parseExploreSearchParams({ sort: "downloads" }).sort, "downloads");
});

test("shareable explore paths keep filters out of React-only state", () => {
  assert.equal(
    buildExplorePath({
      q: "mecanum",
      type: "CAD",
      season: "IntoDeep",
      tag: "drivetrain",
      sort: "latest",
    }),
    "/explore?q=mecanum&type=CAD&tag=drivetrain&season=IntoDeep",
  );
  assert.equal(
    buildExplorePath({
      q: "vision",
      type: "CODE",
      sort: "updated",
      tag: "autonomous",
    }),
    "/explore?q=vision&type=CODE&tag=autonomous&sort=updated",
  );
  assert.equal(buildExplorePath({ sort: "downloads" }), "/explore?sort=downloads");
  assert.equal(
    explorePathWith(
      parseExploreSearchParams({ q: "mecanum", type: "CAD", page: "4" }),
      { tag: "drivetrain" },
    ),
    "/explore?q=mecanum&type=CAD&tag=drivetrain",
  );
  assert.equal(hasActiveExploreFilters(parseExploreSearchParams({ q: "mecanum" })), true);
  assert.equal(hasActiveExploreFilters(parseExploreSearchParams({ sort: "updated" })), false);
});

test("toolbar sorts are newest, recently updated, and real download counts", () => {
  assert.deepEqual(
    EXPLORE_SORT_OPTIONS.map((option) => option.value),
    ["latest", "updated", "downloads"],
  );
  assert.equal(
    EXPLORE_SORT_OPTIONS.find((option) => option.value === "downloads")?.label,
    "Most downloaded",
  );
  assert.match(sortSelector, /EXPLORE_SORT_OPTIONS/);
  assert.doesNotMatch(sortSelector, /popularity/);
});

test("explore search stays on published rows and database filters", () => {
  assert.match(explore, /parseExploreSearchParams/);
  assert.match(explore, /listPublishedResources/);
  assert.match(explore, /<ResourceFilters/);
  assert.match(explore, /<SearchResults/);
  assert.match(list, /expandSearchResourceIds/);
  assert.match(list, /eq\("status", "PUBLISHED"\)\.eq\("visibility", "PUBLIC"\)/);
  assert.match(list, /textSearch\("search_vector"/);
  assert.match(expand, /eq\("status", "PUBLISHED"\)/);
  assert.match(expand, /eq\("visibility", "PUBLIC"\)/);
  assert.doesNotMatch(list, /eq\("status", "DRAFT"\)/);
  assert.doesNotMatch(list, /PENDING_REVIEW/);
  assert.doesNotMatch(expand, /embedding/);
  assert.doesNotMatch(list, /pgvector/);
  assert.doesNotMatch(list, /openai/i);
});

test("search UI reuses ResourceCard, URL forms, and empty states", () => {
  assert.match(searchBar, /action="\/explore"/);
  assert.match(searchBar, /type="submit"/);
  assert.match(searchBar, /name="q"/);
  assert.match(results, /ResourceGrid/);
  assert.match(results, /exploreEmptyCopy/);
  assert.match(results, /formatResultCount/);
  assert.doesNotMatch(results, /SearchResultCard/);
  assert.match(filters, /FilterPanel/);
  assert.match(filterPanel, /RESOURCE_TYPES/);
  assert.match(filterPanel, /categoryTree/);
  assert.doesNotMatch(filterPanel, /Drivetrain/);
  assert.doesNotMatch(filterPanel, /Autonomous/);
  assert.match(active, /Clear filters/);
  assert.match(active, /Active/);
});
