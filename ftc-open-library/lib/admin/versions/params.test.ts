import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADMIN_VERSION_FILTER_STATUS,
  adminVersionStatusLabel,
  adminVersionsPath,
  changelogSummary,
  parseAdminVersionFilter,
  parseAdminVersionPage,
} from "./params.ts";

test("admin version filters map onto version statuses, not resource statuses", () => {
  assert.equal(ADMIN_VERSION_FILTER_STATUS.pending, "PENDING_REVIEW");
  assert.equal(ADMIN_VERSION_FILTER_STATUS.published, "PUBLISHED");
  assert.equal(ADMIN_VERSION_FILTER_STATUS.rejected, "ARCHIVED");
  assert.equal(ADMIN_VERSION_FILTER_STATUS.changes, "DRAFT");
  assert.equal(adminVersionStatusLabel("ARCHIVED"), "Rejected");
  assert.equal(adminVersionStatusLabel("DRAFT"), "Changes requested");
});

test("the default version review tab is pending", () => {
  assert.equal(parseAdminVersionFilter({}), "pending");
  assert.equal(parseAdminVersionFilter({ status: "published" }), "published");
  assert.equal(parseAdminVersionFilter({ status: "nope" }), "pending");
  assert.equal(parseAdminVersionPage({ page: "2" }), 2);
  assert.equal(adminVersionsPath(1, { status: "pending" }), "/admin/versions?status=pending");
});

test("changelog summaries stay short and do not invent empty copy", () => {
  assert.equal(changelogSummary(null), null);
  assert.equal(changelogSummary("  Improved mounts  "), "Improved mounts");
  assert.ok((changelogSummary("x".repeat(200)) ?? "").endsWith("…"));
});
