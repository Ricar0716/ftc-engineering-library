import assert from "node:assert/strict";
import { test } from "node:test";
import { GUEST_ACCESS } from "../auth/permissions.ts";
import {
  DETAIL_EMPTY,
  fileDownloadHref,
  fileDownloadKind,
  fileDownloadLabel,
  previewAvailabilityLabel,
  primaryDownloadAction,
} from "./detail-ui.ts";

const returnTo = "/resources/mecanum-drive";

test("guests cannot obtain a download action for protected files", () => {
  assert.equal(fileDownloadKind(GUEST_ACCESS), "signin");
  assert.equal(fileDownloadLabel("signin"), "Sign in to download");
  assert.equal(fileDownloadHref("signin", { fileId: "file-1", returnTo }), `/login?next=${encodeURIComponent(returnTo)}`);
  assert.doesNotMatch(fileDownloadHref("signin", { fileId: "file-1", returnTo }), /\/api\/downloads\//);
});

test("unverified accounts are sent to verify, not the signed download route", () => {
  assert.equal(fileDownloadKind({ level: "unverified" }), "verify");
  assert.equal(fileDownloadHref("verify", { fileId: "file-1", returnTo }), "/verify?reason=download");
});

test("verified users keep the existing signed download href", () => {
  assert.equal(fileDownloadKind({ level: "verified" }), "download");
  assert.equal(fileDownloadKind({ level: "admin" }), "download");
  assert.equal(
    fileDownloadHref("download", { fileId: "11111111-1111-4111-8111-111111111111", returnTo }),
    `/api/downloads/11111111-1111-4111-8111-111111111111?next=${encodeURIComponent(returnTo)}`,
  );
});

test("primary guest action is sign in, not a signed URL", () => {
  const action = primaryDownloadAction(GUEST_ACCESS, returnTo);
  assert.equal(action.kind, "signin");
  assert.equal(action.label, "Sign in to download");
  assert.doesNotMatch(action.href, /\/api\/downloads\//);
  assert.doesNotMatch(action.href, /storage/);
});

test("empty-state copy is explicit instead of a blank panel", () => {
  assert.equal(DETAIL_EMPTY.preview, "No preview available.");
  assert.equal(DETAIL_EMPTY.files, "No downloadable files available.");
  assert.equal(DETAIL_EMPTY.related, "No related resources yet.");
  assert.equal(
    DETAIL_EMPTY.discussion,
    "No discussion yet. Ask a technical question or share an improvement.",
  );
});

test("preview availability stays user-facing", () => {
  assert.equal(previewAvailabilityLabel("CAD", { filename: "part.stl", sizeBytes: 100 }), "Online preview");
  assert.equal(previewAvailabilityLabel("CAD", { filename: "part.glb", sizeBytes: 100 }), "Online preview");
  assert.equal(previewAvailabilityLabel("CAD", { filename: "part.step", sizeBytes: 100 }), "Download only");
  assert.equal(previewAvailabilityLabel("MODEL", { filename: "robot.glb", sizeBytes: 100 }), "Online preview");
  assert.equal(
    previewAvailabilityLabel("CAD", { filename: "huge.stl", sizeBytes: 26 * 1024 * 1024 }),
    "Download to view",
  );
});
