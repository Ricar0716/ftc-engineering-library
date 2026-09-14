import assert from "node:assert/strict";
import { test } from "node:test";
import { dashboardPagePath, isDashboardNavActive, visibleDashboardNav } from "./nav.ts";
import { parseDashboardResourceFilter } from "./params.ts";

test("overview is not marked active on nested dashboard routes", () => {
  assert.equal(isDashboardNavActive("/dashboard", "/dashboard", true), true);
  assert.equal(isDashboardNavActive("/dashboard", "/dashboard/resources", true), false);
  assert.equal(isDashboardNavActive("/dashboard/resources", "/dashboard/resources", true), true);
  assert.equal(isDashboardNavActive("/dashboard/drafts", "/dashboard/resources", true), false);
});

test("dashboard pagination keeps extra filters", () => {
  assert.equal(dashboardPagePath("/dashboard/resources", 1), "/dashboard/resources");
  assert.equal(
    dashboardPagePath("/dashboard/resources", 2, { status: "drafts" }),
    "/dashboard/resources?status=drafts&page=2",
  );
});

test("resource filters stay on the documented status groups", () => {
  assert.equal(parseDashboardResourceFilter({}), "all");
  assert.equal(parseDashboardResourceFilter({ status: "published" }), "published");
  assert.equal(parseDashboardResourceFilter({ status: "secret" }), "all");
});

test("discussion stays in the nav catalog but is hidden while Beta discussion is off", () => {
  assert.equal(
    visibleDashboardNav().some((item) => item.href === "/dashboard/discussions"),
    false,
  );
});
