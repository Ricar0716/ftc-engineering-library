import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const layout = readFileSync(new URL("../../app/admin/layout.tsx", import.meta.url), "utf8");
const overview = readFileSync(new URL("../../app/admin/page.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(
  new URL("../../components/admin/admin-sidebar.tsx", import.meta.url),
  "utf8",
);
const nav = readFileSync(new URL("./nav.ts", import.meta.url), "utf8");
const statCard = readFileSync(
  new URL("../../components/admin/admin-stat-card.tsx", import.meta.url),
  "utf8",
);

test("admin layout hosts a collapsible overview sidebar", () => {
  assert.match(layout, /AdminSidebar/);
  assert.match(sidebar, /<details/);
  assert.match(sidebar, /lg:hidden/);
  assert.match(sidebar, /Admin Dashboard/);
  assert.match(nav, /label: "Overview"/);
  assert.match(nav, /"Resources"/);
  assert.match(nav, /"Users"/);
  assert.match(nav, /"Settings"/);
  assert.match(sidebar, /Later/);
});

test("later admin sections are not linked as working pages", () => {
  assert.doesNotMatch(nav, /href: "\/admin\/users"/);
  assert.doesNotMatch(nav, /href: "\/admin\/settings"/);
  assert.doesNotMatch(nav, /href: "\/admin\/discussions"/);
  const later = nav.slice(nav.indexOf("adminNavLater"));
  assert.doesNotMatch(later, /"Resources"/);
  assert.doesNotMatch(later, /"Versions"/);
  assert.match(nav, /href: "\/admin\/resources"/);
  assert.match(nav, /href: "\/admin\/versions"/);
  assert.match(overview, /User management is not in this step/);
  assert.match(overview, /Open version review/);
  assert.match(overview, /Open resource review/);
  assert.match(overview, /\/admin\/resources\?status=pending/);
  assert.match(overview, /\/admin\/versions\?status=pending/);
  assert.doesNotMatch(overview, /Open review queue/);
});

test("stat cards can omit a link and still show a numeric count", () => {
  assert.match(statCard, /href\?: string/);
  assert.match(statCard, /value: number/);
  assert.match(overview, /value=\{stats\.users\}/);
  assert.doesNotMatch(overview, /href="\/admin\/users"/);
});
