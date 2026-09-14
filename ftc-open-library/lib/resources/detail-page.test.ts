import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync(
  new URL("../../app/(public)/resources/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const hero = readFileSync(
  new URL("../../components/resources/resource-hero.tsx", import.meta.url),
  "utf8",
);
const explorer = readFileSync(
  new URL("../../components/resources/resource-file-explorer.tsx", import.meta.url),
  "utf8",
);
const actions = readFileSync(
  new URL("../../components/resources/resource-actions.tsx", import.meta.url),
  "utf8",
);
const related = readFileSync(
  new URL("../../components/resources/resource-related.tsx", import.meta.url),
  "utf8",
);
const previewCard = readFileSync(
  new URL("../../components/resources/resource-preview-card.tsx", import.meta.url),
  "utf8",
);
const authorCard = readFileSync(
  new URL("../../components/resources/resource-author-card.tsx", import.meta.url),
  "utf8",
);

test("the resource page renders title, type, author, preview, versions, and discussion", () => {
  assert.match(page, /<ResourceHero resource=\{resource\}/);
  assert.match(page, /<ResourcePreview/);
  assert.match(page, /<ResourcePreviewCard>/);
  assert.match(page, /<ResourceAuthorCard resource=\{resource\}/);
  assert.match(page, /<VersionHistory/);
  assert.match(page, /<ResourceDiscussion/);
  assert.match(page, /isDiscussionEnabled/);
  assert.match(hero, /\{resource\.title\}/);
  assert.match(hero, /ResourceTypeBadge/);
  assert.match(hero, /Created by/);
  assert.match(hero, /authorDisplayName/);
});

test("the file explorer lists files and never exposes storage internals", () => {
  assert.match(explorer, /file\.filename/);
  assert.match(explorer, /formatBytes/);
  assert.match(explorer, /previewAvailabilityLabel/);
  assert.match(explorer, /DETAIL_EMPTY\.files/);
  assert.doesNotMatch(explorer, /resource-files/);
  assert.doesNotMatch(explorer, /tutorial-videos/);
  assert.doesNotMatch(explorer, /storage_path/);
  assert.doesNotMatch(explorer, /storagePath/);
  assert.doesNotMatch(explorer, /createSignedUrl/);
  assert.doesNotMatch(explorer, /signedUrl/);
});

test("guest download actions stay on login or verify, not a signed URL fetch", () => {
  assert.match(explorer, /FileDownloadButton/);
  assert.match(explorer, /fileDownloadKind/);
  assert.match(actions, /primaryDownloadAction/);
  assert.match(actions, /FavoriteButton/);
  assert.doesNotMatch(actions, /createSignedUrl/);
  assert.doesNotMatch(actions, /resource-files/);
});

test("empty related and missing files have explicit copy", () => {
  assert.match(related, /resources\.length === 0/);
  assert.match(explorer, /DETAIL_EMPTY\.files/);
  assert.match(previewCard, /id="preview"/);
});

test("author card is a contributor summary, not a social network", () => {
  assert.match(authorCard, /Contributor/);
  assert.match(authorCard, /authorPublishedCount/);
  assert.doesNotMatch(authorCard, /Follow/);
  assert.doesNotMatch(authorCard, /Message/);
});
