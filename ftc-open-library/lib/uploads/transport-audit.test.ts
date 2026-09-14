import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const standard = readFileSync(new URL("./standard-upload.ts", import.meta.url), "utf8");
const resumable = readFileSync(new URL("./resumable-upload.ts", import.meta.url), "utf8");
const transport = readFileSync(new URL("./transport.ts", import.meta.url), "utf8");
const uploader = readFileSync(
  new URL("../../components/resources/file-uploader.tsx", import.meta.url),
  "utf8",
);
const actions = readFileSync(new URL("../resources/actions.ts", import.meta.url), "utf8");

test("large-file transport never base64-encodes or copies the whole Blob", () => {
  for (const [name, source] of [
    ["standard-upload.ts", standard],
    ["resumable-upload.ts", resumable],
    ["transport.ts", transport],
    ["file-uploader.tsx", uploader],
  ] as const) {
    assert.doesNotMatch(source, /readAsDataURL|readAsArrayBuffer|FileReader|btoa\(|Buffer\.from\(file\)/, name);
  }
  assert.match(resumable, /new tus\.Upload\(file,/);
  assert.match(standard, /upload\(ticket\.path, file,/);
});

test("TUS destination comes only from the trusted ticket", () => {
  assert.match(resumable, /bucketName: ticket\.bucket/);
  assert.match(resumable, /objectName: ticket\.path/);
  assert.doesNotMatch(resumable, /p_bucket|searchParams\.get\(['\"]bucket/);
  assert.match(transport, /ticket: TrustedUploadTicket/);
  assert.match(transport, /never invents a Storage destination/);
});

test("standard and TUS both finalize through complete_upload_intent", () => {
  assert.match(uploader, /uploadResourceFile\(/);
  assert.match(uploader, /registerResourceFile\(/);
  assert.match(actions, /rpc\("complete_upload_intent"/);
  assert.match(uploader, /Retry finish/);
  assert.match(actions, /complete_upload_intent is idempotent/);
  assert.doesNotMatch(actions, /The object exists but will never be referenced, so take it out now/);
});

test("cancel aborts TUS then uses the trusted abandon flow", () => {
  assert.match(uploader, /abortRef\.current\.abort\(true\)/);
  assert.match(uploader, /abandonResourceUpload\(\{ path: job\.path \}\)/);
});

test("TUS uses the configured 6 MiB chunk size and session refresh", () => {
  assert.match(resumable, /chunkSize: TUS_CHUNK_SIZE_BYTES/);
  assert.match(resumable, /refreshSession/);
  assert.match(resumable, /removeFingerprintOnSuccess: true/);
  assert.match(resumable, /x-upsert": "false"/);
});

test("touch returns the database expiresAt and the client stores that value", () => {
  assert.match(actions, /authoritativeExpiresAt\(data\)/);
  assert.match(actions, /return \{ ok: true, expiresAt \}/);
  assert.match(uploader, /rememberExpiry\(touched\.expiresAt\)/);
  assert.match(uploader, /live\.expiresAt/);
  assert.doesNotMatch(uploader, /uploadLimits\.uploadIntentTtlSeconds \* 1000/);
  assert.match(uploader, /jobsRef\.current\.find/);
});
