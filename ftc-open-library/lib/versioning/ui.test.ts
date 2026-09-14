import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync(
  new URL("../../app/(public)/resources/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const history = readFileSync(
  new URL("../../components/versioning/version-history.tsx", import.meta.url),
  "utf8",
);
const card = readFileSync(new URL("../../components/versioning/version-card.tsx", import.meta.url), "utf8");
const selector = readFileSync(
  new URL("../../components/versioning/version-selector.tsx", import.meta.url),
  "utf8",
);
const create = readFileSync(
  new URL("../../components/versioning/create-version-form.tsx", import.meta.url),
  "utf8",
);
const edit = readFileSync(
  new URL("../../app/my/resources/[id]/edit/page.tsx", import.meta.url),
  "utf8",
);
const review = readFileSync(
  new URL("../../app/admin/review/[resourceId]/page.tsx", import.meta.url),
  "utf8",
);
const queue = readFileSync(new URL("../../app/admin/review/page.tsx", import.meta.url), "utf8");
const versionsQueue = readFileSync(new URL("../../app/admin/versions/page.tsx", import.meta.url), "utf8");
const versionDetail = readFileSync(
  new URL("../../components/admin/versions/version-review-detail.tsx", import.meta.url),
  "utf8",
);

test("resource detail renders version history and defaults to the latest published version", () => {
  assert.match(page, /selectPublishedVersion/);
  assert.match(page, /<VersionSelector/);
  assert.match(page, /<VersionHistory/);
  assert.match(page, /<ResourcePreview/);
  assert.match(page, /selectedFiles/);
  assert.match(history, /id="versions"/);
  assert.match(history, /latest=\{version\.id === latestId\}/);
  assert.match(selector, /Latest/);
  assert.match(card, /Changes/);
  assert.doesNotMatch(page, /CAD geometry/);
  assert.doesNotMatch(history, /pull request/i);
});

test("contributors create versions on owned published resources, not immediately publish them", () => {
  assert.match(edit, /CreateVersionForm/);
  assert.match(edit, /SubmitRevisionForm/);
  assert.match(create, /Create new version/);
  assert.match(create, /startResourceRevision/);
  assert.match(create, /Submit version for review/);
  assert.doesNotMatch(create, /review_resource\(/);
});

test("admin queue distinguishes first publish from version review", () => {
  assert.match(queue, /redirect\("\/admin\/versions"\)/);
  assert.match(review, /\/admin\/versions\//);
  assert.match(versionsQueue, /listAdminModerationVersions/);
  assert.match(versionDetail, /ReviewRevisionForm|VersionModerationActions/);
  assert.match(versionDetail, /without\s+unpublishing the resource/);
});
