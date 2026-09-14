import assert from "node:assert/strict";
import { test } from "node:test";
import { loginPath, returnPathAfterAuth, safeInternalPath } from "./paths.ts";

test("allows internal paths and query strings", () => {
  assert.equal(safeInternalPath("/explore"), "/explore");
  assert.equal(safeInternalPath("/resources/example"), "/resources/example");
  assert.equal(safeInternalPath("/explore?type=CAD&category=abc"), "/explore?type=CAD&category=abc");
});

test("rejects empty, external, and protocol-relative values", () => {
  assert.equal(safeInternalPath(null), "/");
  assert.equal(safeInternalPath(""), "/");
  assert.equal(safeInternalPath("https://malicious.example.com"), "/");
  assert.equal(safeInternalPath("//malicious.example.com"), "/");
  assert.equal(safeInternalPath("/\\/malicious.example.com"), "/");
  assert.equal(safeInternalPath("///evil.example"), "/");
  assert.equal(safeInternalPath("/http://evil.example"), "/");
});

test("rejects encoded open redirects", () => {
  assert.equal(safeInternalPath("%2F%2Fevil.example"), "/");
  assert.equal(safeInternalPath(decodeURIComponent("%2Fexplore")), "/explore");
});

test("loginPath preserves a safe next parameter", () => {
  assert.equal(loginPath("/"), "/login");
  assert.equal(loginPath("/resources/demo"), "/login?next=%2Fresources%2Fdemo");
  assert.equal(loginPath("https://evil.example"), "/login");
});

test("returnPathAfterAuth ignores auth routes", () => {
  assert.equal(returnPathAfterAuth("/login"), "/");
  assert.equal(returnPathAfterAuth("/explore", "type=CAD"), "/explore?type=CAD");
});
