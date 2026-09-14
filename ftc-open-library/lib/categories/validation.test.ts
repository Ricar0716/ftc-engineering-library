import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parentOptions,
  parentValidationError,
  parseCategoryInput,
  siblingSlugConflict,
} from "./validation.ts";
import type { Category } from "@/types/categories";

function cat(
  partial: Pick<Category, "id" | "name"> & Partial<Category>,
): Category {
  return {
    slug: partial.slug ?? partial.name.toLowerCase().replace(/\s+/g, "-"),
    resourceType: "CAD",
    parentId: null,
    description: null,
    sortOrder: 0,
    isActive: true,
    ...partial,
  };
}

const CAD_INTAKE = "11111111-1111-4111-8111-111111111111";
const CAD_INDEXER = "22222222-2222-4222-8222-222222222222";
const CAD_TRANSFER = "33333333-3333-4333-8333-333333333333";
const CODE_CONTROL = "44444444-4444-4444-8444-444444444444";

const tree = [
  cat({ id: CAD_INTAKE, name: "Intake" }),
  cat({ id: CAD_INDEXER, name: "Indexer", parentId: CAD_INTAKE }),
  cat({ id: CAD_TRANSFER, name: "Transfer" }),
  cat({ id: CODE_CONTROL, name: "Control", resourceType: "CODE" }),
];

test("zero categories can still create a root", () => {
  const parsed = parseCategoryInput({
    name: "Launching",
    slug: "launching",
    resourceType: "CAD",
    parentId: "none",
    sortOrder: "0",
    isActive: true,
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.parentId, null);
    assert.equal(parentValidationError([], parsed.value), null);
  }
});

test("create child requires a same-type parent", () => {
  const parsed = parseCategoryInput({
    name: "Flywheel",
    slug: "flywheel",
    resourceType: "CAD",
    parentId: CAD_INTAKE,
    isActive: true,
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parentValidationError(tree, parsed.value), null);
  }
});

test("self-parent is rejected", () => {
  assert.equal(
    parentValidationError(tree, { resourceType: "CAD", parentId: CAD_INTAKE }, CAD_INTAKE),
    "A category cannot be its own parent.",
  );
});

test("moving a category under a descendant is rejected", () => {
  assert.equal(
    parentValidationError(tree, { resourceType: "CAD", parentId: CAD_INDEXER }, CAD_INTAKE),
    "This move would create a category cycle.",
  );
});

test("cross-resource-type parent is rejected", () => {
  assert.equal(
    parentValidationError(tree, { resourceType: "CAD", parentId: CODE_CONTROL }),
    "The parent category belongs to a different Resource Type.",
  );
});

test("parent options omit self and descendants", () => {
  const options = parentOptions(tree, "CAD", CAD_INTAKE).map((item) => item.id);
  assert.deepEqual(options, [CAD_TRANSFER]);
});

test("sibling slug conflict respects parent and resource type", () => {
  assert.equal(
    siblingSlugConflict(tree, { slug: "indexer", resourceType: "CAD", parentId: CAD_INTAKE }),
    true,
  );
  assert.equal(
    siblingSlugConflict(tree, { slug: "indexer", resourceType: "CAD", parentId: CAD_TRANSFER }),
    false,
  );
  assert.equal(
    siblingSlugConflict(tree, { slug: "control", resourceType: "CAD", parentId: null }),
    false,
  );
});

test("malformed input never becomes a category payload", () => {
  assert.equal(parseCategoryInput({ name: " ", slug: "ok", resourceType: "CAD" }).ok, false);
  assert.equal(parseCategoryInput({ name: "Ok", slug: "Not Valid", resourceType: "CAD" }).ok, false);
  assert.equal(parseCategoryInput({ name: "Ok", slug: "ok", resourceType: "TOOL" }).ok, false);
  assert.equal(
    parseCategoryInput({ name: "Ok", slug: "ok", resourceType: "CAD", parentId: "not-a-uuid" }).ok,
    false,
  );
  assert.equal(
    parseCategoryInput({ name: "Ok", slug: "ok", resourceType: "CAD", sortOrder: "1.5" }).ok,
    false,
  );
  assert.equal(
    parseCategoryInput({ name: "Ok", slug: "ok", resourceType: "CAD", sortOrder: "NaN" }).ok,
    false,
  );
});

test("arbitrary-depth parent chain is allowed when it is not a cycle", () => {
  const deep = [
    cat({ id: "1", name: "Launching" }),
    cat({ id: "2", name: "Flywheel", parentId: "1" }),
    cat({ id: "3", name: "Dual Flywheel", parentId: "2" }),
    cat({ id: "4", name: "Adjustable Hood", parentId: "3" }),
  ];
  assert.equal(parentValidationError(deep, { resourceType: "CAD", parentId: "3" }), null);
  assert.equal(
    parentValidationError(deep, { resourceType: "CAD", parentId: "4" }, "1"),
    "This move would create a category cycle.",
  );
});
