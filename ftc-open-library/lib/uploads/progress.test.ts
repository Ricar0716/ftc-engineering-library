import assert from "node:assert/strict";
import { test } from "node:test";
import { uploadProgressPercent } from "./progress.ts";

test("progress is clamped between 0 and 100", () => {
  assert.equal(uploadProgressPercent(0, 100), 0);
  assert.equal(uploadProgressPercent(50, 100), 50);
  assert.equal(uploadProgressPercent(100, 100), 100);
  assert.equal(uploadProgressPercent(150, 100), 100);
  assert.equal(uploadProgressPercent(-10, 100), 0);
});

test("unknown or zero totals do not produce NaN", () => {
  assert.equal(uploadProgressPercent(10, 0), 0);
  assert.equal(uploadProgressPercent(10, Number.NaN), 0);
  assert.equal(uploadProgressPercent(Number.NaN, 100), 0);
  assert.equal(uploadProgressPercent(10, Number.POSITIVE_INFINITY), 0);
});
