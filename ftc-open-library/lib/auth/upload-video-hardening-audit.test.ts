import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * Audits STEP 5.1.1 SQL: leftover-object quota, cancel/expiry semantics,
 * concurrency locks, and the private tutorial-videos bucket.
 */
const sql = readFileSync(
  new URL("../../supabase/migrations/20260908210000_upload_hardening_videos.sql", import.meta.url),
  "utf8",
);

function policyBody(name: string): string {
  const match = sql.match(
    new RegExp(
      String.raw`CREATE POLICY ${name}[\s\S]*?(?=\nDROP POLICY|\nCREATE POLICY|\nCREATE OR REPLACE|\nCREATE TABLE|\nGRANT|\nREVOKE|\n-- ---|$)`,
    ),
  );
  assert.ok(match, `missing policy ${name}`);
  return match[0];
}

function functionBody(signature: string): string {
  const start = sql.indexOf(`FUNCTION ${signature}`);
  assert.notEqual(start, -1, `missing function ${signature}`);
  const end = sql.indexOf("\n$$;", start);
  assert.notEqual(end, -1, `unterminated function ${signature}`);
  return sql.slice(start, end);
}

test("tutorial-videos is a private 1 GB bucket", () => {
  assert.match(sql, /INSERT INTO storage\.buckets[\s\S]*?'tutorial-videos'/);
  assert.match(sql, /false,\n  public\.upload_limit\('max_video_bytes'\)/);
  assert.match(sql, /ON CONFLICT \(id\) DO UPDATE\nSET public = false/);
});

test("tutorial video writes require an exact-path reservation, not a directory grant", () => {
  const insert = policyBody("storage_tutorial_videos_insert");
  assert.match(insert, /bucket_id = 'tutorial-videos'/);
  assert.match(insert, /public\.is_verified_user\(\)/);
  assert.match(insert, /public\.can_edit_resource\(public\.storage_first_folder_uuid\(name\)\)/);
  assert.match(insert, /public\.has_open_upload_intent\('tutorial-videos', name\)/);
  assert.doesNotMatch(insert, /FOR ALL/);

  const update = policyBody("storage_tutorial_videos_update");
  assert.match(update, /has_open_upload_intent\('tutorial-videos', name\)/);

  const remove = policyBody("storage_tutorial_videos_delete");
  assert.match(remove, /FOR DELETE TO authenticated/);
  assert.doesNotMatch(remove, /has_open_upload_intent/);
});

test("resource-files writes also bind the reservation to that bucket", () => {
  assert.match(policyBody("storage_resource_files_insert"), /has_open_upload_intent\('resource-files', name\)/);
  assert.match(policyBody("storage_resource_files_update"), /has_open_upload_intent\('resource-files', name\)/);
});

test("an open intent is one user, one bucket, one key, and unexpired", () => {
  const body = functionBody("public.has_open_upload_intent(p_bucket text, p_object_name text)");
  assert.match(body, /i\.storage_bucket = p_bucket/);
  assert.match(body, /i\.storage_path = p_object_name/);
  assert.match(body, /i\.user_id = auth\.uid\(\)/);
  assert.match(body, /i\.status = 'PENDING'/);
  assert.match(body, /i\.expires_at > now\(\)/);
});

test("cancel refuses if the Storage object still exists", () => {
  const body = functionBody("public.cancel_upload_intent(p_storage_path text)");
  assert.match(body, /FOR UPDATE/);
  assert.match(body, /public\.upload_lock_quota\(intent\.resource_id\)/);
  assert.match(body, /storage_object_bytes\(intent\.storage_bucket, intent\.storage_path\)/);
  assert.match(body, /ftc:object_still_present/);
  assert.match(body, /SET status = 'CANCELLED'/);
  assert.match(body, /AND status = 'PENDING'/);
  assert.doesNotMatch(body, /DELETE FROM storage\.objects/);
});

test("held bytes count an existing object even after cancel or expiry", () => {
  const body = functionBody("public.upload_intent_held_bytes(");
  assert.match(body, /IF p_status = 'COMPLETED' THEN\s*\n\s*RETURN 0/);
  assert.match(body, /actual := public\.storage_object_bytes\(p_bucket, p_path\)/);
  assert.match(body, /IF actual IS NOT NULL AND actual > 0 THEN\s*\n\s*RETURN actual/);
  assert.match(body, /IF p_status = 'PENDING' AND p_expires_at > now\(\)/);
  assert.match(body, /RETURN 0/);
});

test("create and complete serialize on the user and the resource", () => {
  const lock = functionBody("public.upload_lock_quota(p_resource_id uuid)");
  assert.match(lock, /pg_advisory_xact_lock\(872011/);
  assert.match(lock, /pg_advisory_xact_lock\(872012/);
  assert.match(lock, /FROM public\.profiles WHERE id = auth\.uid\(\) FOR UPDATE/);
  assert.match(lock, /FROM public\.resources WHERE id = p_resource_id FOR UPDATE/);

  const create = functionBody("public.create_upload_intent(");
  assert.match(create, /PERFORM public\.upload_lock_quota\(p_resource_id\)/);
  assert.match(create, /PERFORM public\.expire_stale_upload_intents\(\)/);

  const complete = functionBody("public.complete_upload_intent(");
  assert.match(complete, /FOR UPDATE/);
  assert.match(complete, /PERFORM public\.upload_lock_quota\(intent\.resource_id\)/);
  assert.match(complete, /AND status = 'PENDING'/);
});

test("stale pending intents become EXPIRED without dropping leftover bytes from quota", () => {
  const body = functionBody("public.expire_stale_upload_intents()");
  assert.match(body, /SET status = 'EXPIRED'/);
  assert.match(body, /status = 'PENDING'/);
  assert.match(body, /expires_at <= now\(\)/);
  assert.match(sql, /status IN \('PENDING', 'COMPLETED', 'CANCELLED', 'EXPIRED'\)/);
});

test("the server chooses the bucket; create_upload_intent has no bucket or path argument", () => {
  const body = functionBody("public.create_upload_intent(");
  assert.doesNotMatch(body, /p_bucket |p_storage_path |p_version_id /);
  assert.match(body, /is_video := \(r\.resource_type = 'TUTORIAL' AND v_extension IN \('mp4', 'webm'\)\)/);
  assert.match(body, /v_bucket := CASE WHEN is_video THEN 'tutorial-videos' ELSE 'resource-files' END/);
  assert.match(body, /'bucket', v_bucket/);
});

test("CAD CODE and MODEL cannot obtain a tutorial-videos reservation", () => {
  const body = functionBody("public.create_upload_intent(");
  assert.match(body, /r\.resource_type = 'TUTORIAL' AND v_extension IN \('mp4', 'webm'\)/);
  assert.match(body, /ELSE 'resource-files'/);
});

test("finalize verifies the exact intent bucket, not whichever bucket happens to contain the key", () => {
  const body = functionBody("public.complete_upload_intent(");
  assert.match(body, /o\.bucket_id = intent\.storage_bucket AND o\.name = p_storage_path/);
  assert.match(body, /intent\.storage_bucket/);
  assert.doesNotMatch(body, /bucket_id = 'resource-files' AND o\.name = p_storage_path/);
});

test("tutorial video totals are enforced separately from overall tutorial storage", () => {
  const create = functionBody("public.create_upload_intent(");
  assert.match(create, /ftc:video_quota_exceeded/);
  assert.match(create, /total_video_bytes_TUTORIAL/);
  assert.match(create, /max_video_bytes/);
  assert.match(create, /max_file_bytes_CODE/);
});

test("user quota includes leftover unregistered objects", () => {
  const create = functionBody("public.create_upload_intent(");
  assert.match(create, /user_held_bytes := public\.user_held_upload_bytes\(auth\.uid\(\)\)/);
  assert.match(create, /user_registered_bytes \+ user_held_bytes \+ p_size_bytes/);
  const complete = functionBody("public.complete_upload_intent(");
  assert.match(complete, /user_held_upload_bytes\(auth\.uid\(\)\)/);
});

test("submitting for review refuses in-flight uploads instead of hiding them", () => {
  const body = functionBody("public.submit_resource_for_review(");
  assert.match(body, /ftc:upload_in_progress/);
  assert.doesNotMatch(body, /SET status = 'CANCELLED'/);
  assert.match(body, /is_verified_user\(\)/);
  assert.match(body, /can_manage_resource/);
});

test("orphan detection covers both private upload buckets and never a live reservation", () => {
  const body = functionBody("public.orphan_upload_objects(");
  assert.match(body, /o\.bucket_id IN \('resource-files', 'tutorial-videos'\)/);
  assert.match(body, /f\.storage_path = o\.name AND f\.storage_bucket = o\.bucket_id/);
  assert.match(body, /i\.storage_bucket = o\.bucket_id/);
  assert.match(body, /i\.status = 'PENDING'/);
  assert.match(body, /i\.expires_at > now\(\)/);
});

test("resource_files and intents are constrained to the two known buckets", () => {
  assert.match(sql, /storage_bucket IN \('resource-files', 'tutorial-videos'\)/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS resource_files_bucket_path_key/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS storage_bucket text NOT NULL DEFAULT 'resource-files'/);
});

test("upload functions stay locked down", () => {
  for (const signature of [
    "public.has_open_upload_intent(text, text)",
    "public.create_upload_intent(uuid, text, bigint, text)",
    "public.complete_upload_intent(text, text, text)",
    "public.cancel_upload_intent(text)",
    "public.orphan_upload_objects(int)",
  ]) {
    assert.match(
      sql,
      new RegExp(String.raw`REVOKE ALL ON FUNCTION ${signature.replace(/[().]/g, "\\$&")} FROM PUBLIC;`),
      signature,
    );
  }
});
