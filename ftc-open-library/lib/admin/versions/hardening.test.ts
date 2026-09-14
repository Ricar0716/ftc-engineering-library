import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sql = readFileSync(
  new URL("../../../supabase/migrations/20260910090000_version_review_hardening.sql", import.meta.url),
  "utf8",
);
const versioningSql = readFileSync(
  new URL("../../../supabase/migrations/20260909200000_resource_versioning.sql", import.meta.url),
  "utf8",
);
const queries = readFileSync(new URL("./queries.ts", import.meta.url), "utf8");
const detail = readFileSync(
  new URL("../../../components/admin/versions/version-review-detail.tsx", import.meta.url),
  "utf8",
);
const card = readFileSync(
  new URL("../../../components/admin/versions/version-review-card.tsx", import.meta.url),
  "utf8",
);
const mapper = readFileSync(new URL("../../db/mappers.ts", import.meta.url), "utf8");
const submissions = readFileSync(new URL("../../db/submissions.ts", import.meta.url), "utf8");
const versionActions = readFileSync(new URL("../../versioning/actions.ts", import.meta.url), "utf8");
const resourceActions = readFileSync(new URL("../../resources/actions.ts", import.meta.url), "utf8");
const dashboardQueries = readFileSync(new URL("../../dashboard/queries.ts", import.meta.url), "utf8");
const dashboardRow = readFileSync(
  new URL("../../../components/dashboard/dashboard-version-row.tsx", import.meta.url),
  "utf8",
);
const firstPublish = readFileSync(
  new URL("../../../supabase/migrations/20260908090000_resource_submission_moderation.sql", import.meta.url),
  "utf8",
);

function functionBody(source: string, signature: string): string {
  const start = source.indexOf(`FUNCTION ${signature}`);
  assert.notEqual(start, -1, `missing function ${signature}`);
  const end = source.indexOf("\n$$;", start);
  assert.notEqual(end, -1, `unterminated function ${signature}`);
  return source.slice(start, end);
}

const submit = functionBody(sql, "public.submit_resource_revision(p_version_id uuid)");
const protectSubmitted = functionBody(sql, "public.resource_versions_protect_submitted_at()");
const canDelete = functionBody(sql, "public.can_delete_version(p_version_id uuid)");
const protectReviewed = functionBody(sql, "public.resource_versions_protect_reviewed()");

test("version review attributes the version creator, not the resource author", () => {
  assert.match(queries, /creator:profiles!created_by \( username, display_name \)/);
  assert.match(queries, /author:profiles!author_id \( username, display_name \)/);
  assert.match(queries, /contributorName: creator \? \(creator\.display_name \?\? creator\.username\)/);
  assert.match(queries, /authorName: author \? \(author\.display_name \?\? author\.username\)/);
  assert.match(submissions, /creator:profiles!created_by \( username, display_name \)/);
  assert.match(mapper, /createdByUsername: row\.creator\?\.username/);
  assert.match(detail, /Submitted by/);
  assert.match(detail, /Original resource author/);
  assert.match(detail, /version\.createdByUsername/);
  assert.match(detail, /submission\.authorUsername/);
  assert.match(card, /Submitted by \{submittedBy\}/);
  assert.match(card, /const submittedBy = version.contributorName/);
  assert.doesNotMatch(card, /submittedBy = version.teamNumber/);
});

test("version creator lookup does not select private auth or profile fields", () => {
  assert.doesNotMatch(queries, /select\("email/i);
  assert.doesNotMatch(queries, /profiles!created_by \(.*email/i);
  assert.doesNotMatch(submissions, /creator:profiles!created_by \(.*email/i);
  assert.doesNotMatch(queries, /raw_user_meta_data/);
  assert.doesNotMatch(queries, /encrypted_password/);
  assert.doesNotMatch(mapper, /email/);
  assert.match(queries, /profiles!created_by \( username, display_name \)/);
});

test("submitted_at is a new nullable column with a conservative backfill", () => {
  assert.match(sql, /ADD COLUMN IF NOT EXISTS submitted_at timestamptz/);
  assert.match(sql, /SELECT min\(rr\.created_at\)/);
  assert.match(sql, /WHEN v\.status IN \('PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED'\) THEN v\.created_at/);
  assert.match(sql, /ELSE NULL/);
  assert.match(sql, /WHERE v\.submitted_at IS NULL/);
  assert.match(sql, /resource_versions_review_queue_idx/);
  const backfill = sql.slice(
    sql.indexOf("UPDATE public.resource_versions v"),
    sql.indexOf("CREATE INDEX IF NOT EXISTS resource_versions_review_queue_idx"),
  );
  assert.doesNotMatch(backfill, /SET status/);
  assert.doesNotMatch(sql, /UPDATE public\.resources SET status/);
  assert.doesNotMatch(sql, /DELETE FROM public\.resource_reviews/);
  assert.doesNotMatch(sql, /DELETE FROM public\.resource_files/);
});

test("submit_resource_revision writes PENDING_REVIEW so the trigger stamps submitted_at as now()", () => {
  assert.match(submit, /SET status = 'PENDING_REVIEW'/);
  assert.match(protectSubmitted, /NEW\.status = 'PENDING_REVIEW' AND OLD\.status = 'DRAFT'/);
  assert.match(protectSubmitted, /NEW\.submitted_at := now\(\)/);
  assert.match(protectSubmitted, /NEW\.submitted_at := OLD\.submitted_at/);
  assert.match(protectSubmitted, /TG_OP = 'INSERT'/);
  assert.match(protectSubmitted, /NEW\.submitted_at := NULL/);
  assert.match(sql, /GRANT UPDATE \(version_label, changelog\) ON public\.resource_versions/);
  assert.doesNotMatch(sql, /GRANT UPDATE \(.*submitted_at/);
  assert.doesNotMatch(versionActions, /submitted_at/);
  assert.doesNotMatch(submit, /p_submitted/);
});

test("admin queue orders and labels by submitted_at, not created_at", () => {
  assert.match(queries, /submitted_at,/);
  assert.match(queries, /\.order\("submitted_at"/);
  assert.match(queries, /submittedAt: row\.submitted_at/);
  assert.doesNotMatch(queries, /submittedAt: row\.created_at/);
  assert.match(detail, /Created/);
  assert.match(detail, /formatDisplayDate\(version\.createdAt\)/);
  assert.match(detail, /formatDisplayDate\(version\.submittedAt\)/);
  const submittedField = detail.slice(detail.lastIndexOf('text-ink-muted">Submitted<'));
  assert.match(submittedField, /version\.submittedAt/);
  assert.doesNotMatch(submittedField.slice(0, 280), /version\.createdAt/);
});

test("contributor pending versions describe submission time, not draft creation", () => {
  assert.match(dashboardQueries, /submitted_at,/);
  assert.match(dashboardQueries, /submittedAt: row\.submitted_at/);
  assert.match(dashboardRow, /PENDING_REVIEW/);
  assert.match(dashboardRow, /Submitted \$\{formatDisplayDate\(version\.submittedAt\)/);
  assert.match(dashboardRow, /Created \$\{formatDisplayDate\(version\.createdAt\)/);
});

test("never-reviewed draft versions remain deletable; reviewed versions are not", () => {
  assert.match(canDelete, /can_edit_version\(p_version_id\)/);
  assert.match(canDelete, /v\.version_number > 1/);
  assert.match(canDelete, /NOT EXISTS/);
  assert.match(canDelete, /resource_reviews rr/);
  assert.match(canDelete, /rr\.version_id = v\.id/);
  assert.match(sql, /USING \(public\.can_delete_version\(id\)\)/);
  assert.match(versioningSql, /can_edit_version\(id\) AND version_number > 1/);
  assert.match(protectReviewed, /ftc:version_has_reviews/);
  assert.match(protectReviewed, /FROM public\.resource_reviews WHERE version_id = OLD\.id/);
  assert.match(protectReviewed, /FROM public\.resources WHERE id = OLD\.resource_id/);
  assert.doesNotMatch(versionActions, /from\("resource_versions"\)[\s\S]{0,80}\.delete\(/);
  assert.doesNotMatch(versionActions, /storage\.from\(/);
});

test("failed version deletion cannot reach storage cleanup of version files", () => {
  assert.doesNotMatch(canDelete, /storage/);
  assert.doesNotMatch(protectReviewed, /storage/);
  assert.doesNotMatch(sql, /storage\.from/);
  const versionDelete = resourceActions.slice(
    resourceActions.indexOf("export async function deleteResourceDraft"),
    resourceActions.indexOf("export type UploadTicket"),
  );
  assert.doesNotMatch(versionDelete, /resource_versions/);
});

test("first-publish review history and ON DELETE SET NULL stay in place", () => {
  assert.match(versioningSql, /version_id uuid REFERENCES public\.resource_versions \(id\) ON DELETE SET NULL/);
  assert.match(firstPublish, /FUNCTION public\.review_resource\(/);
  assert.match(firstPublish, /INSERT INTO public\.resource_reviews \(resource_id, reviewer_id, decision, message\)/);
  assert.doesNotMatch(sql, /DROP TABLE public\.resource_reviews/);
  assert.doesNotMatch(sql, /ON DELETE CASCADE/);
  assert.doesNotMatch(sql, /FUNCTION public\.review_resource\(/);
});
