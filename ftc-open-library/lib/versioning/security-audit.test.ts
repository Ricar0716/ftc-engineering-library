import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sql = readFileSync(
  new URL("../../supabase/migrations/20260909200000_resource_versioning.sql", import.meta.url),
  "utf8",
);
const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const downloads = readFileSync(
  new URL("../../app/api/downloads/[fileId]/route.ts", import.meta.url),
  "utf8",
);
const previews = readFileSync(
  new URL("../../app/api/previews/[fileId]/route.ts", import.meta.url),
  "utf8",
);
const publicLoad = readFileSync(new URL("../db/resources.ts", import.meta.url), "utf8");
const seed = readFileSync(
  new URL("../../supabase/seed/03_resources.sql", import.meta.url),
  "utf8",
);

function functionBody(signature: string): string {
  const start = sql.indexOf(`FUNCTION ${signature}`);
  assert.notEqual(start, -1, `missing function ${signature}`);
  const end = sql.indexOf("\n$$;", start);
  assert.notEqual(end, -1, `unterminated function ${signature}`);
  return sql.slice(start, end);
}

test("existing resources keep one version row and backfill 1.0 as published when the resource is public", () => {
  assert.match(sql, /ALTER TABLE public\.resource_versions/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS status text/);
  assert.match(sql, /WHEN r\.status IN \('PUBLISHED', 'ARCHIVED'\) THEN 'PUBLISHED'/);
  assert.match(sql, /released_at = CASE/);
  assert.match(sql, /CHECK \(status IN \('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED'\)\)/);
  assert.doesNotMatch(sql, /CREATE TABLE public\.resource_versions/);
  assert.match(seed, /WHEN r\.status IN \('PUBLISHED', 'ARCHIVED'\) THEN 'PUBLISHED'/);
});

test("files stay attached to versions; storage keys are not duplicated", () => {
  const start = functionBody("public.start_resource_revision");
  assert.match(sql, /Files stay on their version_id/);
  assert.match(sql, /object_key := p_resource_id::text \|\| '\/' \|\| v_version_id::text/);
  assert.doesNotMatch(start, /resource_files/);
});

test("owners start revisions; others cannot; resource stays published", () => {
  const start = functionBody("public.start_resource_revision");
  assert.match(start, /is_verified_user\(\)/);
  assert.match(start, /can_manage_resource\(p_resource_id\)/);
  assert.match(start, /r\.status <> 'PUBLISHED'/);
  assert.match(start, /ftc:revision_open/);
  assert.match(start, /status IN \('DRAFT', 'PENDING_REVIEW'\)/);
  assert.match(actions, /can_manage_resource/);
  assert.match(actions, /VERSION_ERRORS\.unauthorized/);
  assert.match(actions, /start_resource_revision/);
  assert.doesNotMatch(start, /UPDATE public\.resources SET status/);
});

test("unpublished versions are hidden from public select, downloads, and catalog previews", () => {
  assert.match(
    sql,
    /CREATE POLICY resource_versions_select[\s\S]*status = 'PUBLISHED'[\s\S]*resource_is_published_public/,
  );
  assert.match(
    sql,
    /CREATE POLICY resource_files_select[\s\S]*version_is_published_public\(version_id\)/,
  );
  assert.match(publicLoad, /filter\(\(version\) => version\.status === "PUBLISHED"\)/);
  assert.match(publicLoad, /publishedVersionIds\.has\(file\.versionId\)/);
  assert.match(downloads, /version\.status !== "PUBLISHED"/);
  assert.match(previews, /unpublishedVersion/);
  assert.match(previews, /catalogPreview/);
  assert.doesNotMatch(downloads, /searchParams\.get\(["']bucket["']\)/);
});

test("version approval uses review_resource_revision and does not call review_resource", () => {
  const reviewRevision = functionBody("public.review_resource_revision");
  const reviewResource = functionBody("public.review_resource");
  assert.match(reviewRevision, /is_site_admin\(\)/);
  assert.match(reviewRevision, /r\.status <> 'PUBLISHED'/);
  assert.match(reviewRevision, /SET status = 'PUBLISHED'/);
  assert.match(reviewRevision, /SET status = 'ARCHIVED'/);
  assert.match(reviewRevision, /INSERT INTO public\.resource_reviews \(resource_id, version_id/);
  assert.match(reviewResource, /r\.status <> 'PENDING_REVIEW'/);
  assert.match(actions, /review_resource_revision/);
  assert.doesNotMatch(actions, /rpc\("review_resource"\)/);
  assert.match(sql, /GRANT UPDATE \(version_label, changelog\) ON public\.resource_versions/);
});

test("storage writes for a revision require the draft version, not a published resource edit", () => {
  assert.match(sql, /can_write_storage_object\(name\)/);
  assert.match(sql, /can_edit_version\(public\.storage_second_folder_uuid/);
  assert.match(sql, /has_open_upload_intent\('resource-files', name\)/);
  const canEditVersion = functionBody("public.can_edit_version(p_version_id uuid)");
  assert.match(canEditVersion, /v\.status = 'DRAFT'/);
  assert.match(canEditVersion, /can_manage_resource\(v\.resource_id\)/);
  assert.match(
    sql,
    /CREATE POLICY resource_files_write[\s\S]*can_edit_version\(version_id\)/,
  );
});
