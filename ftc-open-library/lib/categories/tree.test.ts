import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCategoryTree,
  compareCategories,
  findCategoryById,
  flattenCategoryTree,
  getCategoryAncestors,
  getCategoryBreadcrumb,
  getCategoryDescendants,
} from "./tree.ts";
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

test("zero categories yields an empty tree", () => {
  assert.deepEqual(buildCategoryTree([]), []);
});

test("one root category", () => {
  const tree = buildCategoryTree([cat({ id: "a", name: "Intake" })]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].id, "a");
  assert.equal(tree[0].children.length, 0);
});

test("multiple roots sort by sort_order then name", () => {
  const tree = buildCategoryTree([
    cat({ id: "b", name: "Transfer", sortOrder: 2 }),
    cat({ id: "a", name: "Intake", sortOrder: 2 }),
    cat({ id: "c", name: "Drivetrain", sortOrder: 1 }),
  ]);
  assert.deepEqual(
    tree.map((node) => node.id),
    ["c", "a", "b"],
  );
});

test("one child nests under its parent", () => {
  const tree = buildCategoryTree([
    cat({ id: "root", name: "Launching" }),
    cat({ id: "child", name: "Flywheel", parentId: "root" }),
  ]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].children.length, 1);
  assert.equal(tree[0].children[0].id, "child");
});

test("deep hierarchy is preserved", () => {
  const rows = [
    cat({ id: "1", name: "Launching" }),
    cat({ id: "2", name: "Flywheel", parentId: "1" }),
    cat({ id: "3", name: "Dual Flywheel", parentId: "2" }),
    cat({ id: "4", name: "Adjustable Hood", parentId: "3" }),
  ];
  const tree = buildCategoryTree(rows);
  assert.equal(tree[0].children[0].children[0].children[0].id, "4");
  assert.deepEqual(
    getCategoryBreadcrumb(rows, "4").map((item) => item.name),
    ["Launching", "Flywheel", "Dual Flywheel", "Adjustable Hood"],
  );
});

test("descendants include nested children and the selected node", () => {
  const rows = [
    cat({ id: "1", name: "Launching" }),
    cat({ id: "2", name: "Flywheel", parentId: "1" }),
    cat({ id: "3", name: "Dual", parentId: "2" }),
    cat({ id: "4", name: "Catapult", parentId: "1" }),
    cat({ id: "5", name: "Other" }),
  ];
  const ids = getCategoryDescendants(rows, "1");
  assert.deepEqual(new Set(ids), new Set(["1", "2", "3", "4"]));
  assert.ok(!ids.includes("5"));
});

test("missing parent becomes a root when activeOnly is false", () => {
  const tree = buildCategoryTree([
    cat({ id: "orphan", name: "Orphan", parentId: "missing" }),
  ]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].id, "orphan");
});

test("activeOnly hides inactive nodes and does not promote their children", () => {
  const tree = buildCategoryTree(
    [
      cat({ id: "root", name: "Launching", isActive: false }),
      cat({ id: "child", name: "Flywheel", parentId: "root" }),
      cat({ id: "visible", name: "Intake" }),
    ],
    { activeOnly: true },
  );
  assert.deepEqual(
    tree.map((node) => node.id),
    ["visible"],
  );
});

test("deterministic compare uses sort_order then name", () => {
  assert.ok(compareCategories({ sortOrder: 1, name: "B" }, { sortOrder: 2, name: "A" }) < 0);
  assert.ok(compareCategories({ sortOrder: 1, name: "A" }, { sortOrder: 1, name: "B" }) < 0);
});

test("cyclic input does not recurse forever", () => {
  const rows = [
    cat({ id: "a", name: "A", parentId: "b" }),
    cat({ id: "b", name: "B", parentId: "a" }),
  ];
  const tree = buildCategoryTree(rows);
  assert.ok(tree.length <= 2);
  const descendants = getCategoryDescendants(rows, "a");
  assert.ok(descendants.length <= 2);
  const ancestors = getCategoryAncestors(rows, "a");
  assert.ok(ancestors.length <= 2);
});

test("missing parent stops the ancestor chain without looping", () => {
  const rows = [cat({ id: "child", name: "Child", parentId: "missing" })];
  assert.deepEqual(
    getCategoryBreadcrumb(rows, "child").map((item) => item.name),
    ["Child"],
  );
});

test("findCategoryById and flattenCategoryTree", () => {
  const rows = [
    cat({ id: "1", name: "Launching" }),
    cat({ id: "2", name: "Flywheel", parentId: "1" }),
  ];
  assert.equal(findCategoryById(rows, "2")?.name, "Flywheel");
  assert.equal(findCategoryById(rows, null), null);
  const flat = flattenCategoryTree(buildCategoryTree(rows));
  assert.deepEqual(
    flat.map((item) => item.id),
    ["1", "2"],
  );
});
