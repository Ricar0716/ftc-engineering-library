import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { GUEST_ACCESS } from "../auth/permissions.ts";
import { fileDownloadHref, fileDownloadKind } from "../resources/detail-ui.ts";

const downloadButton = readFileSync(
  new URL("../../components/resources/file-download-button.tsx", import.meta.url),
  "utf8",
);
const explorer = readFileSync(
  new URL("../../components/resources/resource-file-explorer.tsx", import.meta.url),
  "utf8",
);
const publicRoute = readFileSync(
  new URL("../../app/api/downloads/[fileId]/route.ts", import.meta.url),
  "utf8",
);
const detailUi = readFileSync(new URL("../resources/detail-ui.ts", import.meta.url), "utf8");

const publishedFileId = "11111111-1111-4111-8111-111111111111";
const returnTo = "/resources/mecanum-drive";

test("verified download uses a same-origin API href, not fetch with a manual redirect", () => {
  const href = fileDownloadHref("download", { fileId: publishedFileId, returnTo });
  assert.equal(href, `/api/downloads/${publishedFileId}?next=${encodeURIComponent(returnTo)}`);
  assert.match(downloadButton, /<a\s+href=\{href\}/);
  assert.doesNotMatch(downloadButton, /\bfetch\s*\(/);
  assert.doesNotMatch(downloadButton, /redirect:\s*["']manual["']/);
  assert.doesNotMatch(downloadButton, /headers\.get\(\s*["']Location["']\s*\)/);
  assert.doesNotMatch(downloadButton, /createObjectURL/);
  assert.doesNotMatch(downloadButton, /arrayBuffer/);
});

test("the client download request is only the trusted file id", () => {
  assert.match(detailUi, /\/api\/downloads\/\$\{input\.fileId\}/);
  assert.doesNotMatch(detailUi, /storage_bucket|storage_path|searchParams.*bucket/);
  assert.doesNotMatch(explorer, /storage_path|storage_bucket|\?bucket=/);
  const href = fileDownloadHref("download", { fileId: publishedFileId, returnTo });
  assert.doesNotMatch(href, /resource-files|tutorial-videos|storage\/v1|signed/);
});

test("the download API authorizes before signing and only redirects", () => {
  assert.match(publicRoute, /canDownload\(access\)/);
  assert.match(publicRoute, /publishedPublic/);
  assert.match(publicRoute, /version\.status !== "PUBLISHED"/);
  assert.match(publicRoute, /storagePathBelongsToResource/);
  assert.match(publicRoute, /createSignedUrl/);
  assert.match(publicRoute, /NextResponse\.redirect\(signed\.signedUrl\)/);
  assert.doesNotMatch(publicRoute, /searchParams\.get\(["']bucket["']\)/);
  assert.doesNotMatch(publicRoute, /searchParams\.get\(["']path["']\)/);
  assert.doesNotMatch(publicRoute, /\.download\(/);
  assert.doesNotMatch(publicRoute, /arrayBuffer|createObjectURL|new Blob/);
  const signIndex = publicRoute.indexOf("createSignedUrl");
  const redirectIndex = publicRoute.indexOf("NextResponse.redirect(signed.signedUrl)");
  const authGuest = publicRoute.indexOf('access.level === "guest"');
  assert.ok(authGuest !== -1 && authGuest < signIndex);
  assert.ok(signIndex !== -1 && redirectIndex > signIndex);
});

test("guests and unverified users never receive the signed download href", () => {
  assert.equal(fileDownloadKind(GUEST_ACCESS), "signin");
  assert.equal(fileDownloadKind({ level: "unverified" }), "verify");
  assert.doesNotMatch(fileDownloadHref("signin", { fileId: publishedFileId, returnTo }), /\/api\/downloads\//);
  assert.doesNotMatch(fileDownloadHref("verify", { fileId: publishedFileId, returnTo }), /\/api\/downloads\//);
  assert.match(publicRoute, /access\.level === "guest"/);
  assert.match(publicRoute, /loginPath/);
  assert.match(publicRoute, /access\.level === "unverified"/);
  assert.match(publicRoute, /\/verify\?reason=download/);
});

test("pending versions stay unpublished to the public download route", () => {
  assert.match(publicRoute, /!version \|\| version\.status !== "PUBLISHED"/);
  assert.doesNotMatch(publicRoute, /PENDING_REVIEW/);
  assert.doesNotMatch(publicRoute, /CHANGES_REQUESTED/);
});

test("any published version file can be downloaded after authorization", () => {
  assert.match(publicRoute, /\.eq\("id", file\.version_id\)/);
  assert.doesNotMatch(publicRoute, /latestPublished|is_latest|current_version/);
});
