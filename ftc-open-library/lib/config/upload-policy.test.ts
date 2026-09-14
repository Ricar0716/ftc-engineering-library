import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  allowedExtensions,
  blockedExtensions,
  RESOURCE_FILES_BUCKET_LIMIT_BYTES,
  TUTORIAL_VIDEOS_BUCKET_LIMIT_BYTES,
  uploadLimits,
} from "./uploads.ts";
import type { ResourceType } from "../../types/resources.ts";

/**
 * The database is the trusted layer, so its copy of the upload policy is the one
 * that actually stops abuse. This test exists to prove the TypeScript config the
 * UI reads has not drifted away from it.
 */
const sql51 = readFileSync(
  new URL("../../supabase/migrations/20260908190000_upload_abuse_hardening.sql", import.meta.url),
  "utf8",
);
const sql511 = readFileSync(
  new URL("../../supabase/migrations/20260908210000_upload_hardening_videos.sql", import.meta.url),
  "utf8",
);
const sql65 = readFileSync(
  new URL("../../supabase/migrations/20260909160000_preview_mesh_formats.sql", import.meta.url),
  "utf8",
);
const sql = sql51 + "\n" + sql511 + "\n" + sql65;

function sqlLimit(key: string): number {
  const matches = [...sql.matchAll(new RegExp(String.raw`WHEN '${key}'\s*THEN\s*(\d+)`, "g"))];
  assert.ok(matches.length > 0, `upload_limit() is missing '${key}'`);
  return Number(matches[matches.length - 1][1]);
}

test("numeric limits match between lib/config/uploads.ts and upload_limit()", () => {
  assert.equal(sqlLimit("max_file_bytes"), uploadLimits.maxFileBytes);
  assert.equal(sqlLimit("max_file_bytes_CODE"), uploadLimits.maxFileBytesByType.CODE);
  assert.equal(sqlLimit("max_video_bytes"), uploadLimits.maxVideoBytes);
  assert.equal(sqlLimit("max_files_per_resource"), uploadLimits.maxFilesPerResource);
  assert.equal(sqlLimit("max_filename_length"), uploadLimits.maxFilenameLength);
  assert.equal(sqlLimit("active_storage_bytes_per_user"), uploadLimits.activeStorageBytesPerUser);
  assert.equal(sqlLimit("max_active_resources_per_user"), uploadLimits.maxActiveResourcesPerUser);
  assert.equal(sqlLimit("max_resources_created_per_hour"), uploadLimits.maxResourcesCreatedPerHour);
  assert.equal(sqlLimit("max_open_uploads_per_user"), uploadLimits.maxOpenUploadsPerUser);
  assert.equal(sqlLimit("max_open_uploads_per_resource"), uploadLimits.maxOpenUploadsPerResource);
  assert.equal(sqlLimit("upload_intent_ttl_seconds"), uploadLimits.uploadIntentTtlSeconds);
  assert.equal(sqlLimit("orphan_grace_hours"), uploadLimits.orphanGraceHours);
  assert.equal(sqlLimit("total_video_bytes_TUTORIAL"), uploadLimits.totalVideoBytesTutorial);

  for (const type of ["CAD", "CODE", "TUTORIAL", "MODEL"] as const) {
    assert.equal(sqlLimit(`total_bytes_${type}`), uploadLimits.totalBytesByType[type], type);
  }
});

test("bucket ceilings match the per-class file limits", () => {
  assert.equal(RESOURCE_FILES_BUCKET_LIMIT_BYTES, uploadLimits.maxFileBytes);
  assert.equal(TUTORIAL_VIDEOS_BUCKET_LIMIT_BYTES, uploadLimits.maxVideoBytes);
  assert.match(sql511, /file_size_limit = public\.upload_limit\('max_video_bytes'\)/);
  assert.match(sql511, /WHERE id = 'resource-files'/);
});

test("the intent size constraint allows a 1 GB tutorial video and nothing larger", () => {
  const matches = [
    ...sql.matchAll(/expected_size_bytes > 0\s*\n\s*AND expected_size_bytes <= (\d+)/g),
  ];
  const latest = matches.length
    ? matches[matches.length - 1]
    : sql.match(/expected_size_bytes > 0 AND expected_size_bytes <= (\d+)/);
  assert.ok(latest, "missing size constraint on resource_upload_intents");
  assert.equal(Number(latest[1]), uploadLimits.maxVideoBytes);
});

function seededBlocked(): string[] {
  const start = sql51.indexOf("INSERT INTO public.upload_blocked_extension");
  const end = sql51.indexOf("ON CONFLICT DO NOTHING", start);
  assert.ok(start !== -1 && end !== -1, "missing blocked extension seed");
  return [...sql51.slice(start, end).matchAll(/\('([a-z0-9_]+)'\)/g)].map((m) => m[1]).sort();
}

function seededAllowed(type: ResourceType): string[] {
  const shared = sql51.slice(
    sql51.indexOf("-- Shared across every resource type."),
    sql51.indexOf("INSERT INTO public.upload_allowed_extension (resource_type, extension) VALUES"),
  );
  const sharedExtensions = [...shared.matchAll(/\('([a-z0-9_]+)'\)/g)]
    .map((m) => m[1])
    .filter((value) => !["CAD", "CODE", "TUTORIAL", "MODEL"].includes(value.toUpperCase()));

  const perType51 = sql51.slice(
    sql51.indexOf("INSERT INTO public.upload_allowed_extension (resource_type, extension) VALUES"),
  );
  const perType511 = sql511;
  const perType65 = sql65;
  const specific = [
    ...perType51.matchAll(/\('(CAD|CODE|TUTORIAL|MODEL)', '([a-z0-9_]+)'\)/g),
    ...perType511.matchAll(/\('(CAD|CODE|TUTORIAL|MODEL)', '([a-z0-9_]+)'\)/g),
    ...perType65.matchAll(/\('(CAD|CODE|TUTORIAL|MODEL)', '([a-z0-9_]+)'\)/g),
  ]
    .filter((m) => m[1] === type)
    .map((m) => m[2]);

  return [...new Set([...sharedExtensions, ...specific])].sort();
}

test("the blocked list matches, and keeps browser-executable formats out", () => {
  assert.deepEqual(seededBlocked(), blockedExtensions());
  for (const dangerous of [
    "exe",
    "msi",
    "apk",
    "dmg",
    "bat",
    "cmd",
    "scr",
    "com",
    "ps1",
    "html",
    "svg",
    "jar",
  ]) {
    assert.ok(seededBlocked().includes(dangerous), `${dangerous} must stay blocked`);
  }
});

test("per-type allowlists match, including tutorial mp4/webm and ordinary FTC source", () => {
  for (const type of ["CAD", "CODE", "TUTORIAL", "MODEL"] as const) {
    assert.deepEqual(seededAllowed(type), [...allowedExtensions(type)].sort(), type);
  }
  assert.ok(allowedExtensions("TUTORIAL").includes("mp4"));
  assert.ok(allowedExtensions("TUTORIAL").includes("webm"));
  assert.ok(!allowedExtensions("CAD").includes("mp4"));
  assert.ok(allowedExtensions("CODE").includes("java"));
});

test("nothing blocked is also allowed for a resource type", () => {
  const blocked = new Set(blockedExtensions());
  for (const type of ["CAD", "CODE", "TUTORIAL", "MODEL"] as const) {
    for (const extension of allowedExtensions(type)) {
      assert.ok(!blocked.has(extension), `${extension} is both blocked and allowed for ${type}`);
    }
  }
});
