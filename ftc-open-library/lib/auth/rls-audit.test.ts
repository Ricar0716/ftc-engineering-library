import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sql = readFileSync(
  new URL("../../supabase/migrations/20260906220000_auth_authorization.sql", import.meta.url),
  "utf8",
);

test("site_admins cannot be self-promoted through RLS", () => {
  assert.match(sql, /ALTER TABLE public\.site_admins ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /CREATE POLICY site_admins_select/);
  assert.doesNotMatch(
    sql,
    /CREATE POLICY site_admins_insert[\s\S]*auth\.uid\(\)\s*=\s*user_id/,
  );
  assert.doesNotMatch(sql, /FOR INSERT[\s\S]*site_admins/);
});

test("original resource-files are not readable merely because they are published", () => {
  assert.match(sql, /DROP POLICY IF EXISTS storage_resource_files_select/);
  assert.match(sql, /can_manage_resource/);
  assert.doesNotMatch(
    sql,
    /CREATE POLICY storage_resource_files_select[\s\S]*resource_is_published_public/,
  );
});
