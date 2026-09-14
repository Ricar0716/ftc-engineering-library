import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const community = readFileSync(
  new URL("../../supabase/migrations/20260902100003_community.sql", import.meta.url),
  "utf8",
);
const discussion = readFileSync(
  new URL("../../supabase/migrations/20260909190000_resource_discussion.sql", import.meta.url),
  "utf8",
);
const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const queries = readFileSync(new URL("./queries.ts", import.meta.url), "utf8");

test("discussions reuse comments with one-level replies and ownership", () => {
  assert.match(community, /CREATE TABLE public\.comments/);
  assert.match(community, /resource_id uuid NOT NULL REFERENCES public\.resources/);
  assert.match(community, /user_id uuid NOT NULL REFERENCES public\.profiles/);
  assert.match(discussion, /ADD COLUMN IF NOT EXISTS parent_id uuid/);
  assert.match(discussion, /FOREIGN KEY \(parent_id\) REFERENCES public\.comments \(id\)/);
  assert.match(discussion, /ftc:nested_reply/);
  assert.match(discussion, /parent_id IS NULL OR parent_id <> id/);
  assert.doesNotMatch(discussion, /CREATE TABLE public\.resource_comments/);
  assert.doesNotMatch(discussion, /CREATE TABLE public\.forums/);
});

test("guests cannot insert; unverified users cannot insert; owners cannot edit others", () => {
  assert.match(discussion, /CREATE POLICY comments_insert[\s\S]*TO authenticated/);
  assert.match(discussion, /is_verified_user\(\)/);
  assert.match(discussion, /user_id = auth\.uid\(\)/);
  assert.match(discussion, /CREATE POLICY comments_update_own[\s\S]*user_id = auth\.uid\(\)/);
  assert.doesNotMatch(discussion, /CREATE POLICY comments_insert[\s\S]*TO anon/);
  assert.doesNotMatch(discussion, /CREATE POLICY comments_delete/);
  assert.match(actions, /isDiscussionEnabled/);
  assert.match(actions, /DISCUSSION_ERRORS\.disabled/);
  assert.match(actions, /user_id: gate\.access\.userId/);
  assert.match(actions, /\.eq\("user_id", gate\.access\.userId\)/);
});

test("unpublished resources do not expose public discussion", () => {
  assert.match(discussion, /resource_is_published_public\(resource_id\)/);
  assert.match(discussion, /status = 'VISIBLE'/);
  assert.match(queries, /status !== "PUBLISHED"/);
  assert.match(queries, /visibility !== "PUBLIC"/);
  assert.match(actions, /DISCUSSION_ERRORS\.unpublished/);
  assert.match(queries, /listResourceDiscussions/);
});

test("site admins hide and restore without a separate dashboard", () => {
  assert.match(discussion, /CREATE POLICY comments_update_admin[\s\S]*is_site_admin\(\)/);
  assert.match(discussion, /CHECK \(status IN \('VISIBLE', 'HIDDEN', 'DELETED'\)\)/);
  assert.match(actions, /export async function hideDiscussion/);
  assert.match(actions, /export async function restoreDiscussion/);
  assert.match(actions, /canAccessAdmin\(access\)/);
  assert.match(discussion, /only a site admin can change comment status/);
  assert.match(discussion, /only the author can edit a visible comment/);
});
