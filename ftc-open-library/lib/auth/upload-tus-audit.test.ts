import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sql = readFileSync(
  new URL("../../supabase/migrations/20260908220000_upload_intent_touch.sql", import.meta.url),
  "utf8",
);

test("touch_upload_intent slides expiry without changing path or bucket", () => {
  assert.match(sql, /FUNCTION public\.touch_upload_intent\(p_storage_path text\)/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /status <> 'PENDING'/);
  assert.match(sql, /ftc:upload_expired/);
  assert.match(sql, /resource_is_editable/);
  assert.match(sql, /SET expires_at = next_expiry/);
  assert.doesNotMatch(sql, /p_bucket|storage_path = p_new|SET storage_bucket/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.touch_upload_intent\(text\) FROM PUBLIC/);
  assert.match(sql, /SET search_path = pg_catalog, public/);
});

test("global intent TTL is not widened to hours", () => {
  assert.doesNotMatch(sql, /upload_limit\('upload_intent_ttl_seconds'\) THEN 8/);
  assert.match(sql, /upload_limit\('upload_intent_ttl_seconds'\)/);
  assert.doesNotMatch(sql, /SET expires_at = now\(\) \+ interval '24/);
});

test("local Storage file_size_limit allows the 1 GB Tutorial video ceiling", () => {
  const config = readFileSync(new URL("../../supabase/config.toml", import.meta.url), "utf8");
  assert.match(config, /\[storage\][\s\S]*file_size_limit = "1GiB"/);
  assert.doesNotMatch(config, /file_size_limit = "50MiB"/);
});

test("docs distinguish application video limits from Storage global/bucket ceilings", () => {
  const architecture = readFileSync(new URL("../../ARCHITECTURE.md", import.meta.url), "utf8");
  const security = readFileSync(new URL("../../SECURITY.md", import.meta.url), "utf8");
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  for (const doc of [architecture, security, readme]) {
    assert.match(doc, /Global File Size Limit/);
  }
  assert.match(architecture, /Closing the tab, a full page refresh, or switching accounts is \*\*not\*\* guaranteed/);
});
