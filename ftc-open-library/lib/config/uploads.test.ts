import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allowedExtensions,
  checkUpload,
  fileCategoryFor,
  formatBytes,
  mimeTypeFor,
  RESOURCE_FILES_BUCKET_LIMIT_BYTES,
  safeFilename,
  TUTORIAL_VIDEOS_BUCKET_LIMIT_BYTES,
  uploadBucketFor,
  uploadLimits,
  uploadTransportFor,
} from "./uploads.ts";

const base = {
  resourceType: "CAD" as const,
  existingFileCount: 0,
  existingTotalBytes: 0,
};

test("filenames are stripped of directories and traversal", () => {
  assert.equal(safeFilename("../../etc/passwd"), "passwd");
  assert.equal(safeFilename("C:\\Users\\me\\part.step"), "part.step");
  assert.equal(safeFilename("my part (v2).stl"), "my-part-v2-.stl");
  assert.equal(safeFilename(".."), null);
  assert.equal(safeFilename("   "), null);
  assert.equal(safeFilename(".hidden"), "hidden");
});

test("executable and browser-renderable formats are always rejected", () => {
  for (const name of [
    "setup.exe",
    "install.msi",
    "payload.sh",
    "script.ps1",
    "page.html",
    "vector.svg",
    "app.apk",
    "macro.docm",
  ]) {
    assert.equal(
      checkUpload({ ...base, filename: name, sizeBytes: 1024 }),
      "extension_blocked",
      name,
    );
  }
});

test("extensions are allowed per resource type", () => {
  assert.equal(checkUpload({ ...base, filename: "arm.step", sizeBytes: 1024 }), null);
  assert.equal(
    checkUpload({ ...base, filename: "OpMode.java", sizeBytes: 1024 }),
    "extension_not_allowed",
  );
  assert.equal(
    checkUpload({ ...base, resourceType: "CODE", filename: "OpMode.java", sizeBytes: 1024 }),
    null,
  );
  assert.equal(
    checkUpload({ ...base, resourceType: "CODE", filename: "arm.step", sizeBytes: 1024 }),
    "extension_not_allowed",
  );
  assert.equal(allowedExtensions("MODEL").includes("csv"), true);
  assert.equal(checkUpload({ ...base, filename: "arm.glb", sizeBytes: 1024 }), null);
  assert.equal(
    checkUpload({ ...base, resourceType: "MODEL", filename: "robot.glb", sizeBytes: 1024 }),
    null,
  );
  assert.equal(
    checkUpload({ ...base, resourceType: "MODEL", filename: "scene.blend", sizeBytes: 1024 }),
    "extension_not_allowed",
  );
});

test("files without an extension are rejected", () => {
  assert.equal(checkUpload({ ...base, filename: "README", sizeBytes: 10 }), "extension_blocked");
});

test("empty uploads are rejected", () => {
  assert.equal(checkUpload({ ...base, filename: "arm.step", sizeBytes: 0 }), "empty");
});

test("per-file, per-count, and per-type quotas are enforced", () => {
  assert.equal(
    checkUpload({ ...base, filename: "arm.step", sizeBytes: uploadLimits.maxFileBytes + 1 }),
    "file_too_large",
  );
  assert.equal(
    checkUpload({
      ...base,
      resourceType: "CODE",
      filename: "src.zip",
      sizeBytes: uploadLimits.maxFileBytesByType.CODE + 1,
    }),
    "file_too_large",
  );
  assert.equal(
    checkUpload({
      ...base,
      filename: "arm.step",
      sizeBytes: 1024,
      existingFileCount: uploadLimits.maxFilesPerResource,
    }),
    "too_many_files",
  );
  assert.equal(
    checkUpload({
      ...base,
      resourceType: "CODE",
      filename: "src.zip",
      sizeBytes: 1024,
      existingTotalBytes: uploadLimits.totalBytesByType.CODE,
    }),
    "quota_exceeded",
  );
});

test("tutorial videos are allowed only on TUTORIAL and only as mp4/webm", () => {
  assert.equal(
    checkUpload({ ...base, resourceType: "TUTORIAL", filename: "lesson.mp4", sizeBytes: 700 * 1024 * 1024 }),
    null,
  );
  assert.equal(
    checkUpload({ ...base, resourceType: "TUTORIAL", filename: "lesson.webm", sizeBytes: 1024 }),
    null,
  );
  assert.equal(
    checkUpload({ ...base, resourceType: "CAD", filename: "clip.mp4", sizeBytes: 1024 }),
    "extension_not_allowed",
  );
  assert.equal(
    checkUpload({ ...base, resourceType: "CODE", filename: "clip.mp4", sizeBytes: 1024 }),
    "extension_not_allowed",
  );
  assert.equal(
    checkUpload({ ...base, resourceType: "MODEL", filename: "clip.webm", sizeBytes: 1024 }),
    "extension_not_allowed",
  );
  assert.equal(
    checkUpload({
      ...base,
      resourceType: "TUTORIAL",
      filename: "lesson.mp4",
      sizeBytes: uploadLimits.maxVideoBytes + 1,
    }),
    "file_too_large",
  );
  assert.equal(
    checkUpload({
      ...base,
      resourceType: "TUTORIAL",
      filename: "lesson.mp4",
      sizeBytes: 1024,
      existingVideoBytes: uploadLimits.totalVideoBytesTutorial,
    }),
    "video_quota_exceeded",
  );
  assert.equal(
    checkUpload({
      ...base,
      resourceType: "TUTORIAL",
      filename: "lesson.mp4",
      sizeBytes: 1024,
      mimeType: "application/x-msdownload",
    }),
    "mime_mismatch",
  );
});

test("ordinary tutorial attachments stay on the 100 MB class", () => {
  assert.equal(
    checkUpload({ ...base, resourceType: "TUTORIAL", filename: "guide.pdf", sizeBytes: 1024 }),
    null,
  );
  assert.equal(
    checkUpload({ ...base, resourceType: "TUTORIAL", filename: "pack.zip", sizeBytes: 1024 }),
    null,
  );
  assert.equal(
    checkUpload({
      ...base,
      resourceType: "TUTORIAL",
      filename: "guide.pdf",
      sizeBytes: uploadLimits.maxFileBytesByType.TUTORIAL + 1,
    }),
    "file_too_large",
  );
});

test("ordinary attachments stay inside the resource-files bucket ceiling", () => {
  assert.ok(uploadLimits.maxFileBytes <= RESOURCE_FILES_BUCKET_LIMIT_BYTES);
  for (const type of ["CAD", "CODE", "MODEL"] as const) {
    assert.ok(uploadLimits.maxFileBytesByType[type] <= RESOURCE_FILES_BUCKET_LIMIT_BYTES, type);
    assert.ok(uploadLimits.totalBytesByType[type] <= 250 * 1024 * 1024, type);
  }
  assert.ok(uploadLimits.maxVideoBytes <= TUTORIAL_VIDEOS_BUCKET_LIMIT_BYTES);
  assert.ok(uploadLimits.totalVideoBytesTutorial + 100 * 1024 * 1024 <= uploadLimits.totalBytesByType.TUTORIAL);
});

test("file category and mime type are derived from the extension", () => {
  assert.equal(fileCategoryFor("arm.step"), "CAD");
  assert.equal(fileCategoryFor("OpMode.java"), "SOURCE");
  assert.equal(fileCategoryFor("guide.pdf"), "DOCUMENT");
  assert.equal(fileCategoryFor("photo.png"), "IMAGE");
  assert.equal(fileCategoryFor("lesson.mp4"), "VIDEO");
  assert.equal(mimeTypeFor("lesson.webm"), "video/webm");
  assert.equal(uploadBucketFor("TUTORIAL", "lesson.mp4"), "tutorial-videos");
  assert.equal(uploadBucketFor("TUTORIAL", "guide.pdf"), "resource-files");
  assert.equal(uploadBucketFor("CAD", "clip.mp4"), "resource-files");
  assert.equal(mimeTypeFor("bundle.zip"), "application/zip");
  assert.equal(mimeTypeFor("mystery.dat"), "application/octet-stream");
});

test("byte formatting is readable", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(2048), "2.0 KB");
  assert.equal(formatBytes(null), "—");
});

test("transport selection is independent of bucket selection", () => {
  const mb = 1024 * 1024;
  assert.equal(uploadTransportFor("TUTORIAL", "guide.pdf", 2 * mb), "standard");
  assert.equal(uploadBucketFor("TUTORIAL", "guide.pdf"), "resource-files");

  assert.equal(uploadTransportFor("TUTORIAL", "pack.zip", 20 * mb), "tus");
  assert.equal(uploadBucketFor("TUTORIAL", "pack.zip"), "resource-files");

  assert.equal(uploadTransportFor("TUTORIAL", "clip.mp4", 2 * mb), "tus");
  assert.equal(uploadBucketFor("TUTORIAL", "clip.mp4"), "tutorial-videos");

  assert.equal(uploadTransportFor("CAD", "arm.step", 80 * mb), "tus");
  assert.equal(uploadBucketFor("CAD", "arm.step"), "resource-files");

  assert.equal(uploadTransportFor("TUTORIAL", "lesson.mp4", 500 * mb), "tus");
  assert.equal(uploadBucketFor("TUTORIAL", "lesson.mp4"), "tutorial-videos");
});
