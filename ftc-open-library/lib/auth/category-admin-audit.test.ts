import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sql = readFileSync(
  new URL("../../supabase/migrations/20260907180000_category_admin.sql", import.meta.url),
  "utf8",
);

const publishedLock = readFileSync(
  new URL("../../supabase/migrations/20260907080000_lock_published_resources.sql", import.meta.url),
  "utf8",
);

test("category writes require is_site_admin and stay off the public roles", () => {
  assert.match(sql, /CREATE POLICY categories_insert[\s\S]*WITH CHECK \(public\.is_site_admin\(\)\)/);
  assert.match(sql, /CREATE POLICY categories_update[\s\S]*USING \(public\.is_site_admin\(\)\)/);
  assert.match(sql, /CREATE POLICY categories_delete[\s\S]*USING \(public\.is_site_admin\(\)\)/);
  assert.doesNotMatch(sql, /FOR INSERT TO anon/);
  assert.doesNotMatch(sql, /FOR UPDATE TO anon/);
  assert.doesNotMatch(
    sql,
    /CREATE POLICY categories_insert[\s\S]*WITH CHECK \(true\)/,
  );
});

test("resource_type cannot be changed after insert", () => {
  assert.match(sql, /category resource_type cannot be changed/);
});

test("hard delete is blocked for children and resource references", () => {
  assert.match(sql, /category has child categories/);
  assert.match(sql, /category is referenced by resources/);
  assert.match(sql, /CREATE TRIGGER categories_prevent_unsafe_delete/);
});

test("site admin resource counts do not leak to non-admins", () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.category_resource_count/);
  assert.match(sql, /NOT public\.is_site_admin\(\)/);
});

test("step 4 does not loosen published resource write policies", () => {
  assert.doesNotMatch(sql, /DROP POLICY IF EXISTS resources_update/);
  assert.doesNotMatch(sql, /can_edit_resource/);
  assert.match(publishedLock, /status = 'DRAFT'/);
});
