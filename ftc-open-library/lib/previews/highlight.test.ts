import assert from "node:assert/strict";
import { test } from "node:test";
import { highlightSource, looksBinary } from "./highlight.ts";

test("highlight escapes markup and does not emit a raw script tag", () => {
  const html = highlightSource(
    "Robot.java",
    'class X { String s = "<script>alert(1)</script>"; }',
  );
  assert.doesNotMatch(html, /<script>/i);
  assert.match(html, /&lt;script&gt;/);
});

test("binary buffers with NULs are rejected as source", () => {
  const bytes = new Uint8Array(32);
  bytes[4] = 0;
  bytes[8] = 0;
  bytes[12] = 0;
  bytes[16] = 0;
  bytes[20] = 0;
  bytes[24] = 0;
  bytes[28] = 0;
  bytes[30] = 0;
  bytes[31] = 0;
  assert.equal(looksBinary(bytes.buffer), true);
  assert.equal(looksBinary(new TextEncoder().encode("public class Robot {}").buffer), false);
});
