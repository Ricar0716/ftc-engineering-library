import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DISCUSSION_BODY_MAX,
  DISCUSSION_BODY_MIN,
  DISCUSSION_PAGE_SIZE,
  discussionPageHref,
  normalizeDiscussionBody,
  parseDiscussionPage,
} from "./validation.ts";

test("discussion body rejects empty and oversized payloads", () => {
  assert.equal(DISCUSSION_BODY_MIN, 1);
  assert.equal(DISCUSSION_BODY_MAX, 4000);
  assert.deepEqual(normalizeDiscussionBody("   "), { ok: false, error: "empty" });
  assert.deepEqual(normalizeDiscussionBody(""), { ok: false, error: "empty" });
  assert.deepEqual(normalizeDiscussionBody("Why this ratio?"), {
    ok: true,
    body: "Why this ratio?",
  });
  assert.equal(normalizeDiscussionBody("  note  ")?.ok, true);
  assert.equal(normalizeDiscussionBody("x".repeat(4000)).ok, true);
  assert.deepEqual(normalizeDiscussionBody("x".repeat(4001)), { ok: false, error: "too_long" });
});

test("discussion pagination is 20 threads and uses a dedicated query param", () => {
  assert.equal(DISCUSSION_PAGE_SIZE, 20);
  assert.equal(parseDiscussionPage({}), 1);
  assert.equal(parseDiscussionPage({ discussion: "2" }), 2);
  assert.equal(parseDiscussionPage({ discussion: ["3", "9"] }), 3);
  assert.equal(parseDiscussionPage({ discussion: "0" }), 1);
  assert.equal(discussionPageHref("intake", 1), "/resources/intake#discussion");
  assert.equal(discussionPageHref("intake", 2), "/resources/intake?discussion=2#discussion");
});
