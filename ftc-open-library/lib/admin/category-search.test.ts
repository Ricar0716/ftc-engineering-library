import assert from "node:assert/strict";
import { test } from "node:test";
import { adminCategoriesPath, parseAdminCategorySearch } from "./category-search.ts";

test("admin category search defaults to CAD and ignores bad ids", () => {
  const parsed = parseAdminCategorySearch({
    type: "NOPE",
    id: "not-a-uuid",
    mode: "create",
    notice: "created",
  });
  assert.equal(parsed.resourceType, "CAD");
  assert.equal(parsed.selectedId, null);
  assert.equal(parsed.mode, "create");
  assert.equal(parsed.notice, "created");
});

test("admin category path uses stable ids not slugs", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.equal(
    adminCategoriesPath({ type: "CODE", id, notice: "updated" }),
    `/admin/categories?type=CODE&id=${id}&notice=updated`,
  );
});
