import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sql = readFileSync(
  new URL(
    "../../supabase/migrations/20260908090000_resource_submission_moderation.sql",
    import.meta.url,
  ),
  "utf8",
);

function policyBody(name: string): string {
  const match = sql.match(
    new RegExp(
      String.raw`CREATE POLICY ${name}[\s\S]*?(?=DROP POLICY|CREATE POLICY|CREATE OR REPLACE|CREATE TABLE|GRANT|REVOKE|-- ---|$)`,
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

test("the status constraint covers exactly the six moderation states", () => {
  const constraint = sql.slice(
    sql.indexOf("ADD CONSTRAINT resources_status_check"),
    sql.indexOf("ALTER TABLE public.resources\n  ADD COLUMN"),
  );
  for (const status of [
    "DRAFT",
    "PENDING_REVIEW",
    "CHANGES_REQUESTED",
    "PUBLISHED",
    "REJECTED",
    "ARCHIVED",
  ]) {
    assert.match(constraint, new RegExp(`'${status}'`), status);
  }
  assert.doesNotMatch(constraint, /'ALGORITHM'|'TOOLS'/);
});

test("moderation timestamps are added rather than reused from the client", () => {
  assert.match(sql, /ADD COLUMN IF NOT EXISTS submitted_at timestamptz/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS reviewed_at timestamptz/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS rights_acknowledged_at timestamptz/);

  const trigger = functionBody("public.resources_enforce_status_transition()");
  assert.match(trigger, /NEW\.submitted_at := OLD\.submitted_at;/);
  assert.match(trigger, /NEW\.reviewed_at := OLD\.reviewed_at;/);
  assert.match(trigger, /NEW\.published_at := OLD\.published_at;/);
});

test("review history is append-only from the client's point of view", () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.resource_reviews/);
  assert.match(sql, /decision IN \('APPROVED', 'CHANGES_REQUESTED', 'REJECTED'\)/);
  assert.match(sql, /ALTER TABLE public\.resource_reviews ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /GRANT SELECT ON public\.resource_reviews TO authenticated;/);
  assert.doesNotMatch(sql, /GRANT[^;]*INSERT[^;]*ON public\.resource_reviews/);
  assert.doesNotMatch(sql, /GRANT[^;]*UPDATE[^;]*ON public\.resource_reviews/);
  assert.doesNotMatch(sql, /GRANT[^;]*DELETE[^;]*ON public\.resource_reviews/);
});

test("the trigger blocks contributor edits in every frozen state", () => {
  const trigger = functionBody("public.resources_enforce_status_transition()");
  assert.match(trigger, /OLD\.status IN \('PUBLISHED', 'REJECTED', 'ARCHIVED'\)/);
  assert.match(trigger, /ftc:not_editable/);
  assert.match(trigger, /ftc:pending_frozen/);
});

test("the trigger allows contributors only submit and withdraw", () => {
  const trigger = functionBody("public.resources_enforce_status_transition()");
  const branchStart = trigger.lastIndexOf("ELSE");
  const contributorBranch = trigger.slice(
    branchStart,
    trigger.indexOf("END IF;\n    END IF;", branchStart),
  );
  assert.match(
    contributorBranch,
    /OLD\.status IN \('DRAFT', 'CHANGES_REQUESTED'\) AND NEW\.status = 'PENDING_REVIEW'/,
  );
  assert.match(contributorBranch, /OLD\.status = 'PENDING_REVIEW' AND NEW\.status = 'DRAFT'/);
  assert.doesNotMatch(contributorBranch, /NEW\.status = 'PUBLISHED'/);
});

test("new resources must start as DRAFT for non-admins", () => {
  const trigger = functionBody("public.resources_enforce_status_transition()");
  assert.match(trigger, /NOT acting_admin AND NEW\.status <> 'DRAFT'/);
  assert.match(trigger, /ftc:draft_required/);
});

test("can_edit_resource widens to CHANGES_REQUESTED without dropping its guards", () => {
  const editable = functionBody("public.resource_is_editable(p_resource_id uuid)");
  assert.match(editable, /r\.status IN \('DRAFT', 'CHANGES_REQUESTED'\)/);

  const canEdit = functionBody("public.can_edit_resource(p_resource_id uuid)");
  assert.match(canEdit, /is_verified_user\(\)/);
  assert.match(canEdit, /is_site_admin\(\)/);
  assert.match(canEdit, /can_manage_resource/);
  assert.match(canEdit, /resource_is_editable/);
  assert.doesNotMatch(canEdit, /'PUBLISHED'/);
});

test("contributors cannot update or delete published resources", () => {
  const update = policyBody("resources_update");
  assert.match(update, /status IN \('DRAFT', 'CHANGES_REQUESTED', 'PENDING_REVIEW'\)/);
  assert.match(update, /is_verified_user\(\)/);
  assert.doesNotMatch(update, /status IN \([^)]*'PUBLISHED'/);

  const del = policyBody("resources_delete");
  assert.match(del, /is_site_admin\(\) AND status <> 'PUBLISHED'/);
  assert.match(del, /status IN \('DRAFT', 'CHANGES_REQUESTED'\)/);
});

test("guests still only read published public resources", () => {
  const select = policyBody("resources_select");
  assert.match(select, /status = 'PUBLISHED' AND visibility = 'PUBLIC'/);
  assert.match(select, /is_site_admin\(\)/);
  assert.match(select, /author_id = auth\.uid\(\)/);
});

test("original files stay private and writes stay limited to editable resources", () => {
  const select = policyBody("storage_resource_files_select");
  assert.match(select, /bucket_id = 'resource-files'/);
  assert.match(select, /is_verified_user\(\)/);
  assert.match(select, /is_site_admin\(\)/);
  assert.match(select, /can_manage_resource/);
  assert.doesNotMatch(select, /TO anon/);

  // STEP 3.1 owns the write policy; STEP 5 must not loosen it.
  assert.doesNotMatch(sql, /CREATE POLICY storage_resource_files_write/);
  assert.doesNotMatch(sql, /storage\.buckets[\s\S]*public['"]?\s*=\s*true/);
  assert.doesNotMatch(sql, /UPDATE storage\.buckets/);
});

test("publication readiness has a single definition", () => {
  const readiness = functionBody("public.resource_submission_error(");
  assert.match(readiness, /SECURITY DEFINER/);
  assert.match(readiness, /SET search_path = pg_catalog, public/);
  for (const code of [
    "title_too_short",
    "description_too_short",
    "license_required",
    "rights_required",
    "category_required",
    "category_invalid",
    "files_required",
  ]) {
    assert.match(readiness, new RegExp(`'${code}'`), code);
  }
});

test("nothing incomplete can reach the review queue, however it was submitted", () => {
  const trigger = functionBody("public.resources_enforce_status_transition()");
  assert.match(
    trigger,
    /NEW\.status = 'PENDING_REVIEW' AND OLD\.status IS DISTINCT FROM 'PENDING_REVIEW'/,
  );
  assert.match(trigger, /public\.resource_submission_error\(/);
  assert.match(trigger, /RAISE EXCEPTION 'ftc:%', submission_error;/);
});

test("submission requires a verified manager, an editable state, and a rights acknowledgement", () => {
  const submit = functionBody(
    "public.submit_resource_for_review(\n  p_resource_id uuid,\n  p_rights_acknowledged boolean\n)",
  );
  assert.match(submit, /SECURITY DEFINER/);
  assert.match(submit, /SET search_path = pg_catalog, public/);
  assert.match(submit, /is_verified_user\(\)/);
  assert.match(submit, /can_manage_resource/);
  assert.match(submit, /ftc:rights_required/);
  assert.match(submit, /current_status NOT IN \('DRAFT', 'CHANGES_REQUESTED'\)/);
});

test("review decisions require a Site Admin and a pending submission", () => {
  const review = functionBody(
    "public.review_resource(\n  p_resource_id uuid,\n  p_decision text,\n  p_message text\n)",
  );
  assert.match(review, /SECURITY DEFINER/);
  assert.match(review, /SET search_path = pg_catalog, public/);
  assert.match(review, /IF NOT public\.is_site_admin\(\) THEN\s*\n\s*RAISE EXCEPTION 'ftc:not_authorized'/);
  assert.match(review, /r\.status <> 'PENDING_REVIEW'/);
  assert.match(review, /ftc:message_required/);
  // Status change and history row share one transaction.
  assert.match(review, /UPDATE public\.resources SET status = next_status[\s\S]*INSERT INTO public\.resource_reviews/);
  // reviewer_id comes from the session.
  assert.match(review, /VALUES \(p_resource_id, auth\.uid\(\), p_decision, clean_message\)/);
});

test("approval re-validates the submission before publishing", () => {
  const review = functionBody(
    "public.review_resource(\n  p_resource_id uuid,\n  p_decision text,\n  p_message text\n)",
  );
  const approval = review.slice(review.indexOf("IF p_decision = 'APPROVED' THEN"));
  assert.match(approval, /public\.resource_submission_error\(/);
  assert.match(approval, /RAISE EXCEPTION 'ftc:%', submission_error;/);
  assert.match(approval, /next_status := 'PUBLISHED'/);
});

test("moderation functions are not executable by anonymous callers", () => {
  for (const signature of [
    "public.submit_resource_for_review(uuid, boolean)",
    "public.withdraw_resource_submission(uuid)",
    "public.review_resource(uuid, text, text)",
    "public.set_resource_archived(uuid, boolean)",
  ]) {
    const escaped = signature.replace(/[().]/g, (character) => `\\${character}`);
    assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION ${escaped} FROM PUBLIC;`), signature);
    assert.match(
      sql,
      new RegExp(`GRANT EXECUTE ON FUNCTION ${escaped} TO authenticated;`),
      signature,
    );
    assert.doesNotMatch(
      sql,
      new RegExp(`GRANT EXECUTE ON FUNCTION ${escaped} TO anon`),
      signature,
    );
  }
});

test("the download architecture is not redefined by this migration", () => {
  assert.doesNotMatch(sql, /createSignedUrl/);
  assert.doesNotMatch(sql, /api\/downloads/);
  assert.doesNotMatch(sql, /DROP POLICY IF EXISTS downloads_insert/);
});

test("RLS is never disabled and no destructive data statements are added", () => {
  assert.doesNotMatch(sql, /DISABLE ROW LEVEL SECURITY/);
  assert.doesNotMatch(sql, /\bDROP TABLE\b/);
  assert.doesNotMatch(sql, /\bDROP COLUMN\b/);
  assert.doesNotMatch(sql, /\bTRUNCATE\b/);
  assert.doesNotMatch(sql, /DELETE FROM public\.resources/);
});
