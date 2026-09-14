import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidCategorySlug, suggestCategorySlug } from "./slug.ts";

test("suggests a url-safe slug from a name without overwriting later edits", () => {
  assert.equal(suggestCategorySlug("Dual Flywheel"), "dual-flywheel");
  assert.equal(suggestCategorySlug("  Adjustable Hood  "), "adjustable-hood");
  assert.equal(suggestCategorySlug("Vision / Limelight"), "vision-limelight");
});

test("rejects empty or invalid slugs", () => {
  assert.equal(isValidCategorySlug("dual-flywheel"), true);
  assert.equal(isValidCategorySlug(""), false);
  assert.equal(isValidCategorySlug("Dual-Flywheel"), false);
  assert.equal(isValidCategorySlug("-leading"), false);
  assert.equal(isValidCategorySlug("bad slug"), false);
});
