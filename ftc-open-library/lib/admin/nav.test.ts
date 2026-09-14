import assert from "node:assert/strict";
import { test } from "node:test";
import { isAdminNavActive } from "./nav.ts";

test("admin overview is not marked active on nested admin routes", () => {
  assert.equal(isAdminNavActive("/admin", "/admin", true), true);
  assert.equal(isAdminNavActive("/admin", "/admin/review", true), false);
  assert.equal(isAdminNavActive("/admin/versions", "/admin/versions", false), true);
  assert.equal(isAdminNavActive("/admin/versions", "/admin/versions/abc", false), true);
  assert.equal(isAdminNavActive("/admin/versions", "/admin/resources", false), false);
  assert.equal(isAdminNavActive("/admin/categories", "/admin/review", false), false);
  assert.equal(isAdminNavActive("/admin/resources", "/admin/resources", false), true);
  assert.equal(isAdminNavActive("/admin/resources", "/admin/resources/abc", false), true);
  assert.equal(isAdminNavActive("/admin/resources", "/admin/review", false), false);
});
