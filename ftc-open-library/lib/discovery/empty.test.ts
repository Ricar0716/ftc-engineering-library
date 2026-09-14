import assert from "node:assert/strict";
import { test } from "node:test";
import { DISCOVERY_EMPTY, exploreEmptyCopy, typeSectionEmptyTitle } from "./empty.ts";
import { parseExploreSearchParams } from "../search/params.ts";

test("explore empty states cover search, type, and the full library", () => {
  assert.deepEqual(exploreEmptyCopy(parseExploreSearchParams({ q: "intake" })), {
    title: DISCOVERY_EMPTY.search,
    description: DISCOVERY_EMPTY.filter,
  });
  assert.equal(
    exploreEmptyCopy(parseExploreSearchParams({ type: "CAD" })).title,
    DISCOVERY_EMPTY.search,
  );
  assert.equal(exploreEmptyCopy(parseExploreSearchParams({})).title, DISCOVERY_EMPTY.library);
  assert.equal(
    exploreEmptyCopy(parseExploreSearchParams({ tag: "vision", season: "IntoDeep" })).title,
    DISCOVERY_EMPTY.search,
  );
  assert.equal(typeSectionEmptyTitle("CODE"), "No published Code resources yet.");
});
