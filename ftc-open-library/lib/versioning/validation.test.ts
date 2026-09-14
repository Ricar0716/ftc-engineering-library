import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filesForVersion,
  latestPublishedVersion,
  nextVersionLabel,
  openRevision,
  revisionSubmitBlockers,
  selectPublishedVersion,
} from "./queries.ts";
import {
  displayVersionName,
  normalizeChangelog,
  parseVersionNumber,
  versionHref,
} from "./validation.ts";
import type { ResourceVersionSummary } from "../../types/resources.ts";

function version(
  partial: Partial<ResourceVersionSummary> & Pick<ResourceVersionSummary, "id" | "versionNumber">,
): ResourceVersionSummary {
  return {
    versionLabel: null,
    changelog: null,
    status: "PUBLISHED",
    releasedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

const v2 = version({
  id: "v2",
  versionNumber: 2,
  versionLabel: "v2.0",
  changelog: "Worlds version",
});
const v1 = version({
  id: "v1",
  versionNumber: 1,
  versionLabel: "v1.0",
  changelog: "Initial release",
});
const draft = version({
  id: "draft",
  versionNumber: 3,
  status: "DRAFT",
  versionLabel: "v3.0",
  releasedAt: null,
});

test("parseVersionNumber accepts v-prefixed query values", () => {
  assert.equal(parseVersionNumber({ version: "2" }), 2);
  assert.equal(parseVersionNumber({ version: "v1.0" }), 1);
  assert.equal(parseVersionNumber({ version: "0" }), null);
  assert.equal(parseVersionNumber({}), null);
});

test("selectPublishedVersion defaults to the latest published release", () => {
  const versions = [v2, v1];
  assert.equal(selectPublishedVersion(versions, null)?.id, "v2");
  assert.equal(selectPublishedVersion(versions, 1)?.id, "v1");
  assert.equal(selectPublishedVersion(versions, 99)?.id, "v2");
  assert.equal(latestPublishedVersion([draft, v2, v1])?.id, "v2");
  assert.equal(selectPublishedVersion([draft], null), null);
});

test("unpublished versions are not selected for public display", () => {
  const selected = selectPublishedVersion([draft, v2], 3);
  assert.equal(selected?.id, "v2");
  assert.deepEqual(
    filesForVersion(
      [
        { versionId: "v2", filename: "chassis_v2.stl" },
        { versionId: "draft", filename: "secret.stl" },
      ],
      selected?.id ?? null,
    ).map((file) => file.filename),
    ["chassis_v2.stl"],
  );
});

test("open revisions and next labels follow release numbering", () => {
  assert.equal(openRevision([v2, draft, v1])?.id, "draft");
  assert.equal(openRevision([v2, v1]), null);
  assert.equal(nextVersionLabel([v2, v1]), "v3");
  assert.equal(displayVersionName(v2), "v2.0");
  assert.equal(displayVersionName({ versionNumber: 4, versionLabel: null }), "v4");
  assert.equal(versionHref("mecanum-drive", 1), "/resources/mecanum-drive?version=1");
});

test("revision submit requires changelog and at least one file", () => {
  assert.deepEqual(revisionSubmitBlockers({ changelog: "Updated intake", fileCount: 1 }), []);
  assert.ok(revisionSubmitBlockers({ changelog: "  ", fileCount: 0 }).length === 2);
});

test("changelog stays within the 4000-character notebook field", () => {
  assert.equal(normalizeChangelog("").ok, true);
  assert.equal(normalizeChangelog("x".repeat(4001)).ok, false);
});
