import assert from "node:assert/strict";
import { test } from "node:test";
import { authoritativeExpiresAt, canResumeWithExpiry } from "./expiry.ts";

test("only a parseable server timestamp is kept", () => {
  assert.equal(authoritativeExpiresAt("2026-09-09T11:00:00.000Z"), "2026-09-09T11:00:00.000Z");
  assert.equal(authoritativeExpiresAt(" 2026-09-09T11:00:00.000Z "), "2026-09-09T11:00:00.000Z");
  assert.equal(authoritativeExpiresAt(null), null);
  assert.equal(authoritativeExpiresAt(""), null);
  assert.equal(authoritativeExpiresAt("not-a-date"), null);
  assert.equal(authoritativeExpiresAt(1_725_000_000_000), null);
});

test("resume uses the latest server expiry, not the original create time", () => {
  const createdAt = Date.parse("2026-09-09T10:00:00.000Z");
  const originalExpiry = "2026-09-09T10:15:00.000Z";
  const touchedExpiry = "2026-09-09T11:00:00.000Z";
  const afterOriginalWindow = createdAt + 20 * 60 * 1000;

  assert.equal(canResumeWithExpiry(originalExpiry, afterOriginalWindow), false);
  assert.equal(canResumeWithExpiry(touchedExpiry, afterOriginalWindow), true);
  assert.equal(canResumeWithExpiry(authoritativeExpiresAt(touchedExpiry), afterOriginalWindow), true);
});
