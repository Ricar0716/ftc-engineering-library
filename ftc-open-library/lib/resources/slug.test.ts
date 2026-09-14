import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidResourceSlug, suggestResourceSlug, uniqueResourceSlug } from "./slug.ts";

test("slugs are lowercase, hyphenated, and url safe", () => {
  assert.equal(suggestResourceSlug("Dual Flywheel Shooter v2!"), "dual-flywheel-shooter-v2");
  assert.equal(suggestResourceSlug("  Odometry   Pods  "), "odometry-pods");
  assert.equal(suggestResourceSlug("Café Intake"), "cafe-intake");
  assert.equal(suggestResourceSlug("***"), "");
});

test("generated slugs pass validation", () => {
  assert.equal(isValidResourceSlug(suggestResourceSlug("Linear Slide Guide")), true);
  assert.equal(isValidResourceSlug("Bad Slug"), false);
  assert.equal(isValidResourceSlug("-leading"), false);
  assert.equal(isValidResourceSlug(""), false);
});

test("a free slug is used as-is", async () => {
  const slug = await uniqueResourceSlug("Intake Roller", async () => false);
  assert.equal(slug, "intake-roller");
});

test("duplicate titles get a numeric suffix instead of colliding", async () => {
  const taken = new Set(["intake-roller", "intake-roller-2"]);
  const slug = await uniqueResourceSlug("Intake Roller", async (candidate) => taken.has(candidate));
  assert.equal(slug, "intake-roller-3");
});

test("an exhausted numeric range falls back to a random suffix", async () => {
  const slug = await uniqueResourceSlug("Intake Roller", async () => true, () => "ab12cd");
  assert.equal(slug, "intake-roller-ab12cd");
  assert.equal(isValidResourceSlug(slug), true);
});

test("a title with no usable characters still produces a valid slug", async () => {
  const slug = await uniqueResourceSlug("###", async () => false);
  assert.equal(slug, "resource");
  assert.equal(isValidResourceSlug(slug), true);
});
