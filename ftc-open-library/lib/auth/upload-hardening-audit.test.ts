import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * Audits the STEP 5.1 SQL. These assertions are about the shape of the trusted
 * layer: which policies exist, what they require, and which checks the upload
 * functions perform. Live policy behaviour still needs a database.
 */
const sql = readFileSync(
  new URL("../../supabase/migrations/20260908190000_upload_abuse_hardening.sql", import.meta.url),
  "utf8",
);

const legacy = readFileSync(
  new URL("../../supabase/migrations/20260907080000_lock_published_resources.sql", import.meta.url),
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

test("the directory-wide storage write policy is replaced, not merely edited", () => {
  // What STEP 3.1 shipped: one FOR ALL policy over the whole resource folder.
  assert.match(legacy, /CREATE POLICY storage_resource_files_write[\s\S]*?FOR ALL TO authenticated/);
  assert.match(sql, /DROP POLICY IF EXISTS storage_resource_files_write ON storage\.objects;/);
  assert.doesNotMatch(sql, /CREATE POLICY storage_resource_files_write/);
});

test("owning an editable resource is no longer enough to write an object", () => {
  for (const name of ["storage_resource_files_insert", "storage_resource_files_update"]) {
    const body = policyBody(name);
    assert.match(body, /bucket_id = 'resource-files'/, name);
    assert.match(body, /public\.is_verified_user\(\)/, name);
    assert.match(body, /public\.can_edit_resource\(public\.storage_first_folder_uuid\(name\)\)/, name);
    // The part that makes it one-object rather than directory-wide.
    assert.match(body, /public\.has_open_upload_intent\(name\)/, name);
  }
});

test("insert and update are separate from delete, which keeps file removal working", () => {
  assert.match(policyBody("storage_resource_files_insert"), /FOR INSERT TO authenticated/);
  const remove = policyBody("storage_resource_files_delete");
  assert.match(remove, /FOR DELETE TO authenticated/);
  assert.doesNotMatch(remove, /has_open_upload_intent/);
  assert.match(remove, /public\.can_edit_resource/);
});

test("preview and thumbnail buckets are no longer contributor-writable", () => {
  const body = policyBody("storage_previews_write");
  assert.match(body, /public\.is_site_admin\(\)/);
  assert.doesNotMatch(body, /can_edit_resource/);
});

test("an authorization is one object, one user, and time-boxed", () => {
  const body = functionBody("public.has_open_upload_intent(p_object_name text)");
  assert.match(body, /i\.storage_path = p_object_name/);
  assert.match(body, /i\.user_id = auth\.uid\(\)/);
  assert.match(body, /i\.status = 'PENDING'/);
  assert.match(body, /i\.expires_at > now\(\)/);
  assert.match(body, /SECURITY DEFINER/);
  assert.match(body, /SET search_path = pg_catalog, public/);
});

test("intents are readable by their owner but never client-writable", () => {
  assert.match(sql, /CREATE POLICY resource_upload_intents_select[\s\S]*?FOR SELECT TO authenticated/);
  assert.match(sql, /USING \(user_id = auth\.uid\(\) OR public\.is_site_admin\(\)\)/);
  assert.match(sql, /GRANT SELECT ON public\.resource_upload_intents TO authenticated;/);
  // No insert/update/delete policy and no such grant.
  assert.doesNotMatch(sql, /CREATE POLICY resource_upload_intents_(insert|update|delete)/);
  assert.doesNotMatch(sql, /GRANT (INSERT|UPDATE|DELETE)[^;]*resource_upload_intents/);
});

test("the storage key is built by the database, never supplied by the caller", () => {
  const body = functionBody("public.create_upload_intent(");
  assert.match(body, /p_resource_id uuid,\s*\n\s*p_filename text,\s*\n\s*p_size_bytes bigint/);
  // No path parameter exists to be trusted.
  assert.doesNotMatch(body, /p_storage_path|p_bucket|p_version_id/);
  assert.match(body, /object_key := p_resource_id::text \|\| '\/' \|\| v_version_id::text/);
  assert.match(body, /gen_random_uuid\(\)::text \|\| '_' \|\| safe_name/);
  assert.match(body, /safe_name := public\.upload_safe_filename\(p_filename\)/);
});

test("reserving an upload checks identity, state, type, size, and every quota", () => {
  const body = functionBody("public.create_upload_intent(");
  assert.match(body, /SECURITY DEFINER/);
  assert.match(body, /SET search_path = pg_catalog, public/);
  for (const code of [
    "verification_required",
    "not_authorized",
    "not_editable",
    "no_version",
    "empty",
    "file_too_large",
    "name_invalid",
    "extension_blocked",
    "extension_not_allowed",
    "too_many_open_uploads",
    "too_many_files",
    "quota_exceeded",
    "storage_quota_exceeded",
  ]) {
    assert.match(body, new RegExp(`ftc:${code}`), code);
  }
});

test("open reservations occupy quota so parallel uploads cannot oversubscribe", () => {
  const body = functionBody("public.create_upload_intent(");
  assert.match(body, /registered_files \+ open_resource_intents >= public\.upload_limit\('max_files_per_resource'\)/);
  assert.match(body, /registered_bytes \+ reserved_bytes \+ p_size_bytes/);
  assert.match(body, /user_active_bytes \+ user_reserved_bytes \+ p_size_bytes/);
});

test("the per-user storage quota counts unpublished work only", () => {
  const body = functionBody("public.create_upload_intent(");
  const quota = body.slice(body.indexOf("INTO user_active_bytes"));
  assert.match(quota, /rr\.author_id = auth\.uid\(\)/);
  assert.match(quota, /rr\.status IN \('DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED'\)/);
  assert.doesNotMatch(quota.slice(0, quota.indexOf("user_reserved_bytes")), /'PUBLISHED'/);
});

test("finalization trusts the stored object, not the browser", () => {
  const body = functionBody("public.complete_upload_intent(");
  assert.match(body, /FROM storage\.objects o/);
  assert.match(body, /\(o\.metadata ->> 'size'\)::bigint INTO actual_size/);
  assert.match(body, /o\.bucket_id = 'resource-files' AND o\.name = p_storage_path/);
  assert.match(body, /actual_size > intent\.expected_size_bytes/);
  assert.match(body, /actual_size > public\.upload_limit\('max_file_bytes'\)/);
  assert.match(body, /ftc:upload_missing/);
  assert.match(body, /ftc:file_too_large/);
});

test("an arbitrary path cannot be registered and a used one cannot be replayed", () => {
  const body = functionBody("public.complete_upload_intent(");
  // Registration starts from a reservation, so a path with no intent is refused.
  assert.match(body, /SELECT \* INTO intent[\s\S]*?WHERE storage_path = p_storage_path/);
  assert.match(body, /IF NOT FOUND OR intent\.user_id <> auth\.uid\(\) THEN\s*\n\s*RAISE EXCEPTION 'ftc:upload_not_authorized'/);
  assert.match(body, /IF intent\.expires_at <= now\(\) THEN\s*\n\s*RAISE EXCEPTION 'ftc:upload_expired'/);
  assert.match(body, /FOR UPDATE/);
  assert.match(body, /UPDATE public\.resource_upload_intents\s*\n\s*SET status = 'COMPLETED'/);
});

test("a repeated finalize returns the existing file instead of a duplicate", () => {
  const body = functionBody("public.complete_upload_intent(");
  assert.match(body, /IF intent\.status = 'COMPLETED' THEN/);
  assert.match(body, /'alreadyRegistered', true/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS resource_files_storage_path_key/);
});

test("finalization re-checks the resource is still editable and still under quota", () => {
  const body = functionBody("public.complete_upload_intent(");
  assert.match(body, /NOT public\.can_manage_resource\(intent\.resource_id\)/);
  assert.match(body, /NOT public\.resource_is_editable\(intent\.resource_id\)/);
  assert.match(body, /ftc:too_many_files/);
  assert.match(body, /ftc:quota_exceeded/);
});

test("draft creation is capped and rate limited in the database", () => {
  const body = functionBody("public.resources_enforce_creation_quota()");
  assert.match(body, /IF auth\.uid\(\) IS NULL OR public\.is_site_admin\(\) THEN/);
  assert.match(body, /r\.status IN \('DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED'\)/);
  assert.match(body, /ftc:too_many_active_resources/);
  assert.match(body, /created_at > now\(\) - interval '1 hour'/);
  assert.match(body, /ftc:creation_rate_limited/);
  assert.match(sql, /CREATE TRIGGER resources_enforce_creation_quota\nBEFORE INSERT ON public\.resources/);
});

test("submitting for review closes any reservation that could still land", () => {
  const body = functionBody("public.submit_resource_for_review(");
  assert.match(
    body,
    /UPDATE public\.resource_upload_intents\s*\n\s*SET status = 'CANCELLED'\s*\n\s*WHERE resource_id = p_resource_id AND status = 'PENDING'/,
  );
  // STEP 5 behaviour is preserved.
  assert.match(body, /is_verified_user\(\)/);
  assert.match(body, /can_manage_resource/);
  assert.match(body, /ftc:rights_required/);
  assert.match(body, /current_status NOT IN \('DRAFT', 'CHANGES_REQUESTED'\)/);
});

test("orphan selection is narrow, aged, and never touches a referenced object", () => {
  const body = functionBody("public.orphan_upload_objects(");
  assert.match(body, /o\.bucket_id = 'resource-files'/);
  assert.match(body, /o\.created_at < now\(\) - make_interval\(hours => public\.upload_limit\('orphan_grace_hours'\)::int\)/);
  assert.match(body, /public\.storage_first_folder_uuid\(o\.name\) IS NOT NULL/);
  assert.match(body, /array_length\(string_to_array\(o\.name, '\/'\), 1\) = 3/);
  assert.match(body, /NOT EXISTS \(\s*\n\s*SELECT 1 FROM public\.resource_files f WHERE f\.storage_path = o\.name/);
  assert.match(body, /i\.status = 'PENDING'\s*\n\s*AND i\.expires_at > now\(\)/);
  assert.match(body, /public\.is_site_admin\(\) OR auth\.uid\(\) IS NULL/);
});

test("upload functions are locked down like the moderation ones", () => {
  for (const signature of [
    "public.create_upload_intent(uuid, text, bigint)",
    "public.complete_upload_intent(text, text, text)",
    "public.cancel_upload_intent(text)",
    "public.orphan_upload_objects(int)",
    "public.has_open_upload_intent(text)",
  ]) {
    assert.match(
      sql,
      new RegExp(String.raw`REVOKE ALL ON FUNCTION ${signature.replace(/[().]/g, "\\$&")} FROM PUBLIC;`),
      signature,
    );
  }
  assert.doesNotMatch(sql, /GRANT EXECUTE[^;]*TO anon/);
});

test("step 5 moderation and step 3.1 immutability are not touched", () => {
  // No new path to publishing, and no widening of the editable set.
  assert.doesNotMatch(sql, /status = 'PUBLISHED'/);
  assert.doesNotMatch(sql, /CREATE OR REPLACE FUNCTION public\.(can_edit_resource|resource_is_editable)/);
  assert.doesNotMatch(sql, /DROP POLICY IF EXISTS resources_(update|delete|select)/);
});
