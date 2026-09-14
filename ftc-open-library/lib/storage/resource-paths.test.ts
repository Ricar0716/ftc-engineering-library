import assert from "node:assert/strict";
import { test } from "node:test";
import { buildResourceObjectPath, isResourceObjectPath } from "./resource-paths.ts";

const RESOURCE = "11111111-1111-4111-8111-111111111111";
const VERSION = "22222222-2222-4222-8222-222222222222";
const FILE = "33333333-3333-4333-8333-333333333333";
const OTHER_RESOURCE = "44444444-4444-4444-8444-444444444444";

test("object keys start with the resource id so storage RLS can resolve them", () => {
  const path = buildResourceObjectPath({
    resourceId: RESOURCE,
    versionId: VERSION,
    fileId: FILE,
    filename: "arm.step",
  });
  assert.equal(path, `${RESOURCE}/${VERSION}/${FILE}_arm.step`);
  assert.equal(isResourceObjectPath(path!, { resourceId: RESOURCE, versionId: VERSION }), true);
});

test("traversal attempts in the filename cannot escape the resource folder", () => {
  const path = buildResourceObjectPath({
    resourceId: RESOURCE,
    versionId: VERSION,
    fileId: FILE,
    filename: "../../other/arm.step",
  });
  assert.equal(path, `${RESOURCE}/${VERSION}/${FILE}_arm.step`);
});

test("non-uuid identifiers are refused", () => {
  assert.equal(
    buildResourceObjectPath({
      resourceId: "not-a-uuid",
      versionId: VERSION,
      fileId: FILE,
      filename: "arm.step",
    }),
    null,
  );
});

test("a filename with nothing usable left is refused", () => {
  assert.equal(
    buildResourceObjectPath({
      resourceId: RESOURCE,
      versionId: VERSION,
      fileId: FILE,
      filename: "...",
    }),
    null,
  );
});

test("keys belonging to another resource or version are rejected", () => {
  assert.equal(
    isResourceObjectPath(`${OTHER_RESOURCE}/${VERSION}/${FILE}_arm.step`, {
      resourceId: RESOURCE,
      versionId: VERSION,
    }),
    false,
  );
  assert.equal(
    isResourceObjectPath(`${RESOURCE}/${FILE}/${FILE}_arm.step`, {
      resourceId: RESOURCE,
      versionId: VERSION,
    }),
    false,
  );
});

test("malformed keys are rejected", () => {
  const expected = { resourceId: RESOURCE, versionId: VERSION };
  for (const path of [
    "",
    `/${RESOURCE}/${VERSION}/${FILE}_arm.step`,
    `${RESOURCE}/${VERSION}/../${FILE}_arm.step`,
    `${RESOURCE}/${VERSION}/${FILE}_arm.step/extra`,
    `${RESOURCE}/${VERSION}`,
    `${RESOURCE}\\${VERSION}\\${FILE}_arm.step`,
    `https://evil.example/${RESOURCE}/${VERSION}/x`,
    `${RESOURCE}/${VERSION}/.hidden`,
    `${RESOURCE}/${VERSION}/arm.step`,
  ]) {
    assert.equal(isResourceObjectPath(path, expected), false, path);
  }
});
