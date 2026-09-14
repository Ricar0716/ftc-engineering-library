import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADMIN_RESOURCE_FILTER_STATUS,
  adminResourcesPath,
  parseAdminResourceFilter,
  parseAdminResourcePage,
} from "./params.ts";

test("admin resource filters map to existing resource statuses", () => {
  assert.equal(ADMIN_RESOURCE_FILTER_STATUS.pending, "PENDING_REVIEW");
  assert.equal(ADMIN_RESOURCE_FILTER_STATUS.published, "PUBLISHED");
  assert.equal(ADMIN_RESOURCE_FILTER_STATUS.rejected, "REJECTED");
  assert.equal(ADMIN_RESOURCE_FILTER_STATUS.changes, "CHANGES_REQUESTED");
});

test("the default resource review tab is pending", () => {
  assert.equal(parseAdminResourceFilter({}), "pending");
  assert.equal(parseAdminResourceFilter({ status: "published" }), "published");
  assert.equal(parseAdminResourceFilter({ status: "nope" }), "pending");
  assert.equal(parseAdminResourceFilter({ status: ["rejected"] }), "rejected");
});

test("resource review pagination ignores invalid pages", () => {
  assert.equal(parseAdminResourcePage({}), 1);
  assert.equal(parseAdminResourcePage({ page: "3" }), 3);
  assert.equal(parseAdminResourcePage({ page: "0" }), 1);
  assert.equal(adminResourcesPath(1, { status: "pending" }), "/admin/resources?status=pending");
  assert.equal(adminResourcesPath(2, { status: "rejected" }), "/admin/resources?status=rejected&page=2");
});
