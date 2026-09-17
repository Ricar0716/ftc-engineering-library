import assert from "node:assert/strict";
import { test } from "node:test";
import { formatCompactCount, formatRatingAverage, hasPublicRating } from "./format-count.ts";

test("compact counts stay readable without fabricating precision", () => {
  assert.equal(formatCompactCount(0), "0");
  assert.equal(formatCompactCount(982), "982");
  assert.equal(formatCompactCount(1200), "1.2K");
  assert.equal(formatCompactCount(12400), "12.4K");
  assert.equal(formatRatingAverage(4.8), "4.8");
  assert.equal(formatRatingAverage(5), "5.0");
});

test("public ratings require both a positive average and at least one rating", () => {
  assert.equal(hasPublicRating({ ratingAverage: 4.8, ratingCount: 24 }), true);
  assert.equal(hasPublicRating({ ratingAverage: 0, ratingCount: 3 }), false);
  assert.equal(hasPublicRating({ ratingAverage: 4.8, ratingCount: 0 }), false);
  assert.equal(hasPublicRating({ ratingAverage: 4.8, ratingCount: null }), false);
  assert.equal(hasPublicRating({ ratingAverage: null, ratingCount: 12 }), false);
  assert.equal(hasPublicRating({}), false);
});
