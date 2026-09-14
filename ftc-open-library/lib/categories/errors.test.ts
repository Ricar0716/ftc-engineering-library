import assert from "node:assert/strict";
import { test } from "node:test";
import { publicCategoryError } from "./errors.ts";

test("maps hierarchy and uniqueness failures to admin copy", () => {
  assert.equal(
    publicCategoryError("duplicate key value violates unique constraint categories_sibling_slug_unique"),
    "A category with this slug already exists under the selected parent.",
  );
  assert.equal(publicCategoryError("category cannot be its own parent"), "A category cannot be its own parent.");
  assert.equal(
    publicCategoryError("category parent would create a cycle"),
    "This move would create a category cycle.",
  );
  assert.equal(
    publicCategoryError("child category resource_type must match parent"),
    "The parent category belongs to a different Resource Type.",
  );
  assert.equal(
    publicCategoryError("category has child categories"),
    "This category cannot be deleted because it has child categories.",
  );
  assert.equal(
    publicCategoryError("category is referenced by resources"),
    "This category cannot be deleted because Resources reference it.",
  );
});

test("does not forward raw database dumps", () => {
  assert.equal(publicCategoryError("syntax error at or near \"SELECT\""), "Unable to save that category. Try again.");
});
