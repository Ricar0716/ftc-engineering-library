import assert from "node:assert/strict";
import { test } from "node:test";
import { publicCardImageUrl } from "./thumbnail.ts";

test("card images only accept same-origin public paths", () => {
  assert.equal(publicCardImageUrl("/images/chassis.png"), "/images/chassis.png");
  assert.equal(publicCardImageUrl(null), null);
  assert.equal(publicCardImageUrl(""), null);
});

test("card images reject storage hosts, signed URLs, and remote URLs", () => {
  assert.equal(publicCardImageUrl("https://example.supabase.co/storage/v1/object/sign/x"), null);
  assert.equal(publicCardImageUrl("/storage/v1/object/public/resource-files/a.stl"), null);
  assert.equal(publicCardImageUrl("/resource-files/secret.stl"), null);
  assert.equal(publicCardImageUrl("/thumb.png?token=abc"), null);
  assert.equal(publicCardImageUrl("//cdn.example/x.png"), null);
});
