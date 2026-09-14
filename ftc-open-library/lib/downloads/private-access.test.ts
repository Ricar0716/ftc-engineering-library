import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const privateRoute = readFileSync(
  new URL("../../app/api/resource-files/[fileId]/route.ts", import.meta.url),
  "utf8",
);

const publicRoute = readFileSync(
  new URL("../../app/api/downloads/[fileId]/route.ts", import.meta.url),
  "utf8",
);

const previewRoute = readFileSync(
  new URL("../../app/api/previews/[fileId]/route.ts", import.meta.url),
  "utf8",
);

test("the published download route still refuses guests and unverified accounts", () => {
  assert.match(publicRoute, /access\.level === "guest"/);
  assert.match(publicRoute, /access\.level === "unverified"/);
  assert.match(publicRoute, /canDownload\(access\)/);
  assert.match(publicRoute, /publishedPublic/);
  assert.match(publicRoute, /version\.status !== "PUBLISHED"/);
  assert.match(publicRoute, /SIGNED_DOWNLOAD_TTL_SECONDS/);
  assert.match(publicRoute, /resolveResourceStorageBucket/);
  assert.match(publicRoute, /storage_bucket/);
  assert.doesNotMatch(publicRoute, /searchParams\.get\(["']bucket["']\)/);
});

test("private file access requires a verified session", () => {
  assert.match(privateRoute, /getCurrentAccess/);
  assert.match(privateRoute, /access\.level === "guest"/);
  assert.match(privateRoute, /access\.level === "unverified"/);
});

test("private file access is limited to the resource manager or a Site Admin", () => {
  assert.match(privateRoute, /can_manage_resource/);
  assert.match(privateRoute, /!manageable && !access\.isSiteAdmin/);
});

test("private file access validates the storage path and signs short-lived urls", () => {
  assert.match(privateRoute, /storagePathBelongsToResource/);
  assert.match(privateRoute, /createSignedUrl/);
  assert.match(privateRoute, /SIGNED_DOWNLOAD_TTL_SECONDS/);
  assert.match(privateRoute, /resolveResourceStorageBucket/);
  assert.match(privateRoute, /storage_bucket/);
  assert.doesNotMatch(privateRoute, /searchParams\.get\(["']bucket["']\)/);
});

test("private file access does not record public download events", () => {
  assert.doesNotMatch(privateRoute, /from\("downloads"\)/);
});

test("neither route exposes the service-role key to the client", () => {
  for (const route of [privateRoute, publicRoute, previewRoute]) {
    assert.doesNotMatch(route, /NEXT_PUBLIC_[A-Z_]*SERVICE/);
    assert.doesNotMatch(route, /serviceRoleKey/);
  }
});

test("the preview route still refuses guests and unverified accounts", () => {
  assert.match(previewRoute, /access\.level === "guest"/);
  assert.match(previewRoute, /access\.level === "unverified"/);
  assert.match(previewRoute, /canDownload\(access\)/);
  assert.match(previewRoute, /publishedPublic/);
  assert.match(previewRoute, /version\.status !== "PUBLISHED"/);
  assert.match(previewRoute, /resolveResourceStorageBucket/);
  assert.doesNotMatch(previewRoute, /searchParams\.get\(["']bucket["']\)/);
});
