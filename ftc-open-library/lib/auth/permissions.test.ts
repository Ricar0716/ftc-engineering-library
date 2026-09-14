import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accessLevel,
  adminGate,
  canAccessAdmin,
  canBrowsePublic,
  canDownload,
  canDiscuss,
  canExport,
  canFavorite,
  canSubmitResource,
  GUEST_ACCESS,
} from "./permissions.ts";

test("guest: browse only", () => {
  assert.equal(GUEST_ACCESS.level, "guest");
  assert.equal(canBrowsePublic(GUEST_ACCESS), true);
  assert.equal(canDownload(GUEST_ACCESS), false);
  assert.equal(canFavorite(GUEST_ACCESS), false);
  assert.equal(canDiscuss(GUEST_ACCESS), false);
  assert.equal(canExport(GUEST_ACCESS), false);
  assert.equal(canSubmitResource(GUEST_ACCESS), false);
  assert.equal(canAccessAdmin(GUEST_ACCESS), false);
});

test("unverified: browse only, no download or admin", () => {
  const access = { level: "unverified" as const };
  assert.equal(canBrowsePublic(access), true);
  assert.equal(canDownload(access), false);
  assert.equal(canFavorite(access), false);
  assert.equal(canDiscuss(access), false);
  assert.equal(canAccessAdmin(access), false);
  assert.equal(canSubmitResource(access), false);
});

test("verified: download and future submit, not admin", () => {
  const access = { level: "verified" as const };
  assert.equal(canDownload(access), true);
  assert.equal(canFavorite(access), true);
  assert.equal(canDiscuss(access), true);
  assert.equal(canExport(access), true);
  assert.equal(canSubmitResource(access), true);
  assert.equal(canAccessAdmin(access), false);
});

test("site admin: download plus admin", () => {
  const access = { level: "admin" as const };
  assert.equal(canDownload(access), true);
  assert.equal(canFavorite(access), true);
  assert.equal(canDiscuss(access), true);
  assert.equal(canAccessAdmin(access), true);
});

test("admin requires verified email", () => {
  assert.equal(
    accessLevel({ authenticated: true, emailVerified: false, isSiteAdmin: true }),
    "unverified",
  );
  assert.equal(
    accessLevel({ authenticated: true, emailVerified: true, isSiteAdmin: true }),
    "admin",
  );
});

test("admin pages reject guests, unverified users, and verified non-admins", () => {
  assert.equal(adminGate("guest"), "login");
  assert.equal(adminGate("unverified"), "forbidden");
  assert.equal(adminGate("verified"), "forbidden");
  assert.equal(adminGate("admin"), "ok");
  assert.equal(canAccessAdmin({ level: "verified" }), false);
  assert.equal(canAccessAdmin({ level: "admin" }), true);
});
