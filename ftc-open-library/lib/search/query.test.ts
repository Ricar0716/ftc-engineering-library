import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatResultCount,
  ilikeContainsPattern,
  intersectIds,
  toFtsQuery,
  uniqueIds,
} from "./query.ts";

test("keyword search sanitizes FTS operators", () => {
  assert.equal(toFtsQuery("  mecanum  "), "mecanum");
  assert.equal(toFtsQuery(`mecanum & drivetrain | "quoted"`), "mecanum drivetrain quoted");
  assert.equal(toFtsQuery(":::"), null);
});

test("ILIKE patterns reject wildcard injection and short tokens", () => {
  assert.equal(ilikeContainsPattern("mecanum"), "%mecanum%");
  assert.equal(ilikeContainsPattern("%drivetrain_"), "%drivetrain%");
  assert.equal(ilikeContainsPattern("a"), null);
  assert.equal(ilikeContainsPattern(""), null);
});

test("id helpers stay stable for search unions", () => {
  assert.deepEqual(uniqueIds(["a", "b", "a"]), ["a", "b"]);
  assert.deepEqual(intersectIds(["a", "b"], ["b", "c"]), ["b"]);
  assert.deepEqual(intersectIds(undefined, ["b", "c"]), ["b", "c"]);
});

test("result copy matches the Explore empty and count states", () => {
  assert.equal(formatResultCount(23, "mecanum"), "23 resources found");
  assert.equal(formatResultCount(1, "intake"), "1 resource found");
  assert.equal(formatResultCount(0, "zzz"), "0 resources found");
  assert.equal(formatResultCount(4, ""), "4 resources");
});
