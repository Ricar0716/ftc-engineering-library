import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sql = readFileSync(
  new URL("../../supabase/migrations/20260907080000_lock_published_resources.sql", import.meta.url),
  "utf8",
);

function policyBody(name: string): string {
  const re = new RegExp(
    String.raw`CREATE POLICY ${name}[\s\S]*?(?=DROP POLICY|CREATE POLICY|CREATE OR REPLACE|$)`,
  );
  const match = sql.match(re);
  assert.ok(match, `missing policy ${name}`);
  return match[0];
}

test("is_site_admin requires a verified email, not only a site_admins row", () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.is_site_admin\(\)/);
  assert.match(sql, /public\.is_verified_user\(\)/);
  assert.match(sql, /FROM public\.site_admins sa/);
});

test("can_edit_resource is verified draft-owner or verified site admin", () => {
  const body = sql.slice(sql.indexOf("FUNCTION public.can_edit_resource"));
  assert.match(body, /is_verified_user\(\)/);
  assert.match(body, /is_site_admin\(\)/);
  assert.match(body, /can_manage_resource/);
  assert.match(body, /resource_is_draft/);
});

test("normal users cannot update a published resource", () => {
  const body = policyBody("resources_update");
  assert.match(body, /status = 'DRAFT'/);
  assert.match(body, /is_site_admin\(\)/);
  assert.match(body, /is_verified_user\(\)/);
  assert.doesNotMatch(body, /status = 'PUBLISHED'/);
});

test("draft owners can still manage draft resources", () => {
  const body = policyBody("resources_update");
  assert.match(body, /author_id = auth\.uid\(\)/);
  assert.match(body, /is_team_admin\(team_id\)/);
  assert.match(body, /status = 'DRAFT'/);
});

test("published child rows are not writable by normal users", () => {
  for (const name of [
    "resource_versions_write",
    "resource_files_write",
    "resource_tags_write",
    "resource_hardware_write",
    "resource_relations_write",
  ]) {
    const body = policyBody(name);
    assert.match(body, /can_edit_resource/, name);
    assert.doesNotMatch(body, /USING \(public\.can_manage_resource/, name);
  }
});

test("storage writes for published resources are locked", () => {
  const files = policyBody("storage_resource_files_write");
  const previews = policyBody("storage_previews_write");
  assert.match(files, /can_edit_resource/);
  assert.match(previews, /can_edit_resource/);
  assert.match(previews, /resource-previews/);
  assert.match(previews, /resource-thumbnails/);
  assert.doesNotMatch(files, /can_manage_resource\(public\.storage_first_folder_uuid/);
});

test("site admin update is not limited to drafts", () => {
  const body = policyBody("resources_update");
  assert.match(
    body,
    /is_site_admin\(\)\s*OR\s*\(\s*status = 'DRAFT'/,
  );
});

test("download signed-url architecture is not redefined here", () => {
  assert.doesNotMatch(sql, /createSignedUrl/);
  assert.doesNotMatch(sql, /SIGNED_DOWNLOAD/);
  assert.doesNotMatch(sql, /api\/downloads/);
  assert.doesNotMatch(sql, /storage_resource_files_select/);
});

test("verified download route still issues short-lived signed URLs", () => {
  const route = readFileSync(
    new URL("../../app/api/downloads/[fileId]/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /getCurrentAccess/);
  assert.match(route, /canDownload/);
  assert.match(route, /createSignedUrl/);
  assert.match(route, /SIGNED_DOWNLOAD_TTL_SECONDS/);
  assert.match(route, /storagePathBelongsToResource/);
});
