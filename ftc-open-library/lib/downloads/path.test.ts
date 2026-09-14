import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveResourceStorageBucket, storagePathBelongsToResource } from "./path.ts";

const resourceId = "11111111-1111-4111-8111-111111111111";

test("accepts a path whose first folder is the resource id", () => {
  assert.equal(storagePathBelongsToResource(`${resourceId}/v1/intake.step`, resourceId), true);
});

test("rejects arbitrary or escaped paths", () => {
  assert.equal(storagePathBelongsToResource("other/file.step", resourceId), false);
  assert.equal(storagePathBelongsToResource(`${resourceId}/../secret.step`, resourceId), false);
  assert.equal(storagePathBelongsToResource(`/etc/passwd`, resourceId), false);
  assert.equal(
    storagePathBelongsToResource("22222222-2222-4222-8222-222222222222/file.step", resourceId),
    false,
  );
});

test("download bucket is resolved from trusted metadata, never from a client string", () => {
  assert.equal(resolveResourceStorageBucket("tutorial-videos"), "tutorial-videos");
  assert.equal(resolveResourceStorageBucket("resource-files"), "resource-files");
  assert.equal(resolveResourceStorageBucket("secret-bucket"), "resource-files");
  assert.equal(resolveResourceStorageBucket(null), "resource-files");
});
