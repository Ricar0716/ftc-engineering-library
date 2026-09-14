import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const composer = readFileSync(
  new URL("../../components/discussion/discussion-composer.tsx", import.meta.url),
  "utf8",
);
const item = readFileSync(
  new URL("../../components/discussion/discussion-item.tsx", import.meta.url),
  "utf8",
);
const reply = readFileSync(
  new URL("../../components/discussion/discussion-reply.tsx", import.meta.url),
  "utf8",
);
const section = readFileSync(
  new URL("../../components/discussion/resource-discussion.tsx", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../../app/(public)/resources/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const review = readFileSync(
  new URL("../../app/admin/review/[resourceId]/page.tsx", import.meta.url),
  "utf8",
);
const resourceReview = readFileSync(
  new URL("../../components/admin/resources/resource-review-detail.tsx", import.meta.url),
  "utf8",
);
const profilePage = readFileSync(
  new URL("../../app/(public)/profile/[username]/page.tsx", import.meta.url),
  "utf8",
);

test("the composer gates guests and unverified users and posts with loading and errors", () => {
  assert.match(composer, /Sign in to discuss/);
  assert.match(composer, /loginPath/);
  assert.match(composer, /verify\?reason=discuss/);
  assert.match(composer, /Write a question or comment/);
  assert.match(composer, /Posting\.\.\./);
  assert.match(composer, /createDiscussion/);
  assert.match(composer, /result\.error/);
  assert.match(composer, /DISCUSSION_BODY_MAX/);
});

test("threads show one-level replies and an empty state", () => {
  assert.match(section, /Existing discussions/);
  assert.match(section, /DETAIL_EMPTY\.discussion/);
  assert.match(section, /DiscussionComposer/);
  assert.match(section, /DiscussionItem/);
  assert.match(item, /Reply/);
  assert.match(item, /parentId=\{thread\.id\}/);
  assert.match(reply, /<DiscussionBadge>Author<\/DiscussionBadge>/);
  assert.match(reply, /<DiscussionBadge>Team Owner<\/DiscussionBadge>/);
  assert.match(reply, /DiscussionReply/);
  assert.doesNotMatch(item, /parentId=\{reply\.id\}/);
  assert.doesNotMatch(composer, /reaction/i);
  assert.doesNotMatch(item, /emoji/i);
});

test("resource detail hosts Discussion after files and before related resources", () => {
  const discussionAt = page.indexOf("<ResourceDiscussion");
  const relatedAt = page.indexOf("<ResourceRelated");
  const filesAt = page.indexOf('id="files"');
  const versionsAt = page.indexOf("<VersionHistory");
  assert.notEqual(discussionAt, -1);
  assert.ok(filesAt < versionsAt);
  assert.ok(versionsAt < discussionAt);
  assert.ok(discussionAt < relatedAt);
  assert.match(page, /isDiscussionEnabled/);
  assert.match(page, /discussionEnabled \?/);
  assert.match(section, /id="discussion"/);
  assert.doesNotMatch(page, /<h2[^>]*>Comments/);
});

test("admins hide discussion on the resource page, not a separate queue", () => {
  assert.match(item, /hideDiscussion/);
  assert.match(item, /restoreDiscussion/);
  assert.match(item, /Hide/);
  assert.match(item, /Restore/);
  assert.match(resourceReview, /Open public discussion/);
  assert.match(resourceReview, /isDiscussionEnabled/);
  assert.match(resourceReview, /There is no separate discussion/);
  assert.match(review, /redirect\(`\/admin\/resources\/\$\{resourceId\}/);
  assert.doesNotMatch(profilePage, /discussion count/i);
});
