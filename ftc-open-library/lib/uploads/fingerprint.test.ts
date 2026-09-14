import assert from "node:assert/strict";
import { test } from "node:test";
import { tusFingerprintMatchesTicket, tusResumeFingerprint } from "./fingerprint.ts";

const file = { filename: "lesson.mp4", sizeBytes: 800 * 1024 * 1024 };

test("fingerprints include the authenticated user and trusted destination, not secrets", () => {
  const fingerprint = tusResumeFingerprint({
    userId: "user-a",
    bucket: "tutorial-videos",
    path: "res/ver/file_lesson.mp4",
    ...file,
  });
  assert.match(fingerprint, /^ftc:user-a:tutorial-videos:res\/ver\/file_lesson\.mp4:/);
  assert.doesNotMatch(fingerprint, /Bearer|service.role|eyJ/i);
});

test("a different user or path cannot match the same resume record", () => {
  const fingerprint = tusResumeFingerprint({
    userId: "user-a",
    bucket: "tutorial-videos",
    path: "res/ver/file_lesson.mp4",
    ...file,
  });
  assert.equal(
    tusFingerprintMatchesTicket(fingerprint, {
      userId: "user-a",
      bucket: "tutorial-videos",
      path: "res/ver/file_lesson.mp4",
    }),
    true,
  );
  assert.equal(
    tusFingerprintMatchesTicket(fingerprint, {
      userId: "user-b",
      bucket: "tutorial-videos",
      path: "res/ver/file_lesson.mp4",
    }),
    false,
  );
  assert.equal(
    tusFingerprintMatchesTicket(fingerprint, {
      userId: "user-a",
      bucket: "resource-files",
      path: "res/ver/file_lesson.mp4",
    }),
    false,
  );
  assert.equal(
    tusFingerprintMatchesTicket(fingerprint, {
      userId: "user-a",
      bucket: "tutorial-videos",
      path: "other/ver/file_lesson.mp4",
    }),
    false,
  );
});
