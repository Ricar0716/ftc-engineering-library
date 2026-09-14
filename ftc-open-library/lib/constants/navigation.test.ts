import assert from "node:assert/strict";
import { test } from "node:test";
import { isPrimaryNavActive } from "./navigation.ts";

const params = (type?: string) => ({
  get: (name: string) => (name === "type" ? (type ?? null) : null),
});

test("Home is active only on the homepage", () => {
  assert.equal(isPrimaryNavActive("/", "/", params()), true);
  assert.equal(isPrimaryNavActive("/", "/explore", params()), false);
  assert.equal(isPrimaryNavActive("/", "/resources/mecanum", params()), false);
});

test("Explore without a type is not active on a type-filtered explore URL", () => {
  assert.equal(isPrimaryNavActive("/explore", "/explore", params()), true);
  assert.equal(isPrimaryNavActive("/explore", "/explore", params("CAD")), false);
  assert.equal(isPrimaryNavActive("/explore?type=CAD", "/explore", params("CAD")), true);
});
