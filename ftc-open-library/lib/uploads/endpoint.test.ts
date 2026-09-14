import assert from "node:assert/strict";
import { test } from "node:test";
import { resumableUploadEndpoint } from "./endpoint.ts";

test("cloud projects use the dedicated storage hostname, not a hardcoded id", () => {
  assert.equal(
    resumableUploadEndpoint("https://abcdefgh.supabase.co"),
    "https://abcdefgh.storage.supabase.co/storage/v1/upload/resumable",
  );
});

test("local and already-storage hosts keep their origin", () => {
  assert.equal(
    resumableUploadEndpoint("http://127.0.0.1:54321"),
    "http://127.0.0.1:54321/storage/v1/upload/resumable",
  );
  assert.equal(
    resumableUploadEndpoint("https://abcdefgh.storage.supabase.co"),
    "https://abcdefgh.storage.supabase.co/storage/v1/upload/resumable",
  );
});
