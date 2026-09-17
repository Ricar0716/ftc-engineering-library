import assert from "node:assert/strict";
import { test } from "node:test";
import { parseExploreSearchParams, buildExplorePath } from "./params.ts";

test("explore filters parse type, tag, and sort without inventing values", () => {
  const filters = parseExploreSearchParams({
    type: "CAD",
    tag: "mecanum",
    sort: "updated",
    q: "intake",
  });
  assert.equal(filters.type, "CAD");
  assert.equal(filters.tag, "mecanum");
  assert.equal(filters.sort, "updated");
  assert.equal(filters.q, "intake");
  assert.equal(parseExploreSearchParams({ type: "NOPE" }).type, null);
});

test("newest and relevance aliases stay on existing simple sorts", () => {
  assert.equal(parseExploreSearchParams({ sort: "newest" }).sort, "latest");
  assert.equal(parseExploreSearchParams({ sort: "relevance" }).sort, "relevance");
  assert.equal(parseExploreSearchParams({ sort: "downloads" }).sort, "downloads");
  assert.equal(parseExploreSearchParams({ sort: "rating" }).sort, "rating");
  assert.equal(parseExploreSearchParams({ sort: "vector" }).sort, "latest");
});

test("explore paths keep filters in the query string", () => {
  assert.equal(
    buildExplorePath({ type: "CODE", sort: "updated", q: "pid" }),
    "/explore?q=pid&type=CODE&sort=updated",
  );
  assert.equal(buildExplorePath({ sort: "latest" }), "/explore");
  assert.equal(
    buildExplorePath({ type: "CAD", season: "IntoDeep", tag: "drivetrain", sort: "downloads" }),
    "/explore?type=CAD&tag=drivetrain&season=IntoDeep&sort=downloads",
  );
  assert.equal(buildExplorePath({ sort: "rating" }), "/explore?sort=rating");
});
