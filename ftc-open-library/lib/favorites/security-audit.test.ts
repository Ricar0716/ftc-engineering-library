import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const community = readFileSync(
  new URL("../../supabase/migrations/20260902100003_community.sql", import.meta.url),
  "utf8",
);
const rls = readFileSync(
  new URL("../../supabase/migrations/20260902100004_rls.sql", import.meta.url),
  "utf8",
);
const verified = readFileSync(
  new URL("../../supabase/migrations/20260909180000_favorites_verified.sql", import.meta.url),
  "utf8",
);
const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const queries = readFileSync(new URL("./queries.ts", import.meta.url), "utf8");

test("favorites are unique per user and resource", () => {
  assert.match(community, /CREATE TABLE public\.favorites/);
  assert.match(community, /PRIMARY KEY \(user_id, resource_id\)/);
  assert.match(community, /REFERENCES public\.profiles \(id\) ON DELETE CASCADE/);
  assert.match(community, /REFERENCES public\.resources \(id\) ON DELETE CASCADE/);
});

test("guests cannot write favorites; owners cannot edit another user's rows", () => {
  assert.match(
    rls,
    /CREATE POLICY favorites_select[\s\S]*TO authenticated[\s\S]*user_id = auth\.uid\(\)/,
  );
  assert.match(
    rls,
    /CREATE POLICY favorites_delete[\s\S]*TO authenticated[\s\S]*user_id = auth\.uid\(\)/,
  );
  assert.doesNotMatch(rls, /CREATE POLICY favorites_update/);
  assert.doesNotMatch(verified, /CREATE POLICY favorites_update/);
  assert.doesNotMatch(rls, /GRANT SELECT, INSERT[\s\S]*favorites[\s\S]*TO anon/);
});

test("inserts require a verified user and a published public resource", () => {
  assert.match(verified, /DROP POLICY IF EXISTS favorites_insert/);
  assert.match(verified, /user_id = auth\.uid\(\)/);
  assert.match(verified, /is_verified_user\(\)/);
  assert.match(verified, /resource_is_published_public\(resource_id\)/);
});

test("saved lists only return published public resources", () => {
  assert.match(queries, /list_own_published_favorites/);
  assert.match(verified, /r\.status = 'PUBLISHED'/);
  assert.match(verified, /r\.visibility = 'PUBLIC'/);
  assert.match(actions, /status !== "PUBLISHED"/);
  assert.match(actions, /user_id: gate\.access\.userId/);
  assert.doesNotMatch(actions, /from\("favorites"\)[\s\S]*\.eq\("user_id", resourceId\)/);
});
