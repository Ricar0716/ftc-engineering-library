import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const previewRoute = readFileSync(
  new URL("../../app/api/previews/[fileId]/route.ts", import.meta.url),
  "utf8",
);
const downloadRoute = readFileSync(
  new URL("../../app/api/downloads/[fileId]/route.ts", import.meta.url),
  "utf8",
);
const modelViewer = readFileSync(
  new URL("../../components/viewer/model-viewer.tsx", import.meta.url),
  "utf8",
);
const modelLoader = readFileSync(
  new URL("../../components/viewer/model-loader.ts", import.meta.url),
  "utf8",
);
const meshPreview = readFileSync(
  new URL("../../components/previews/mesh-preview.tsx", import.meta.url),
  "utf8",
);
const cadPreview = readFileSync(
  new URL("../../components/previews/cad-preview.tsx", import.meta.url),
  "utf8",
);
const codePreview = readFileSync(
  new URL("../../components/previews/code-preview.tsx", import.meta.url),
  "utf8",
);
const highlight = readFileSync(new URL("./highlight.ts", import.meta.url), "utf8");
const tutorialPreview = readFileSync(
  new URL("../../components/previews/tutorial-preview.tsx", import.meta.url),
  "utf8",
);
const modelPreview = readFileSync(
  new URL("../../components/previews/model-preview.tsx", import.meta.url),
  "utf8",
);
const resourcePreview = readFileSync(
  new URL("../../components/previews/resource-preview.tsx", import.meta.url),
  "utf8",
);
const resourcePage = readFileSync(
  new URL("../../app/(public)/resources/[slug]/page.tsx", import.meta.url),
  "utf8",
);

test("ResourcePreview instantiates the type-specific viewers", () => {
  assert.match(resourcePreview, /previewComponentFor\(resourceType\)/);
  assert.match(resourcePreview, /CADPreview/);
  assert.match(resourcePreview, /CodePreview/);
  assert.match(resourcePreview, /TutorialPreview/);
  assert.match(resourcePreview, /ModelPreview/);
});

test("the resource page uses ResourcePreview instead of a placeholder", () => {
  assert.match(resourcePage, /<ResourcePreview/);
  assert.match(resourcePage, /<ResourcePreviewCard>/);
  assert.match(resourcePage, /<ResourceHero/);
  assert.doesNotMatch(resourcePage, /Preview comes in a later phase/);
});

test("preview signed URLs require a verified session and never accept a bucket param", () => {
  assert.match(previewRoute, /access\.level === "guest"/);
  assert.match(previewRoute, /status: 401/);
  assert.match(previewRoute, /access\.level === "unverified"/);
  assert.match(previewRoute, /canDownload\(access\)/);
  assert.match(previewRoute, /publishedPublic/);
  assert.match(previewRoute, /version\.status !== "PUBLISHED"/);
  assert.match(previewRoute, /can_manage_resource/);
  assert.match(previewRoute, /reviewPreview/);
  assert.match(previewRoute, /access\.isSiteAdmin/);
  assert.match(previewRoute, /storagePathBelongsToResource/);
  assert.match(previewRoute, /resolveResourceStorageBucket/);
  assert.match(previewRoute, /createSignedUrl/);
  assert.doesNotMatch(previewRoute, /searchParams\.get\(["']bucket["']\)/);
  assert.doesNotMatch(previewRoute, /from\("downloads"\)/);
});

test("preview guests receive JSON, not a login redirect, so fetch cannot follow HTML", () => {
  assert.match(
    previewRoute,
    /NextResponse\.json\(\{ error: "Sign in to preview\." \}, \{ status: 401 \}\)/,
  );
  assert.doesNotMatch(previewRoute, /NextResponse\.redirect/);
});

test("CAD and MODEL previews load bytes through the shared authorized viewer", () => {
  assert.match(modelViewer, /fetchPreviewBytes/);
  assert.match(modelViewer, /OrbitControls/);
  assert.match(modelViewer, /ssr: false|dynamic import|await import\("three"\)/);
  assert.match(meshPreview, /ssr: false/);
  assert.match(cadPreview, /MeshPreview/);
  assert.match(modelPreview, /MeshPreview/);
  assert.doesNotMatch(modelViewer, /resource-files/);
  assert.doesNotMatch(meshPreview, /createSignedUrl/);
  assert.doesNotMatch(cadPreview, /createSignedUrl/);
  assert.doesNotMatch(modelLoader, /eval\s*\(/);
  assert.doesNotMatch(modelLoader, /new Function/);
});

test("code preview highlights text and never evaluates it", () => {
  assert.match(highlight, /hljs\.highlight/);
  assert.match(highlight, /Never evaluates the file/);
  assert.match(codePreview, /buildSourceFileTree/);
  assert.match(codePreview, /Download file to view/);
  assert.doesNotMatch(highlight, /\beval\s*\(/);
  assert.doesNotMatch(highlight, /new Function/);
  assert.doesNotMatch(codePreview, /\beval\s*\(/);
  assert.doesNotMatch(codePreview, /new Function/);
  assert.doesNotMatch(codePreview, /<script/);
});

test("tutorial video is a private download, not a public player or bucket URL", () => {
  assert.match(tutorialPreview, /Download video/);
  assert.doesNotMatch(tutorialPreview, /<video/);
  assert.doesNotMatch(tutorialPreview, /tutorial-videos/);
});

test("model preview visualizes meshes and does not execute uploaded models", () => {
  assert.match(modelPreview, /not executed in the browser/);
  assert.match(modelPreview, /MeshPreview/);
  assert.doesNotMatch(modelPreview, /\beval\s*\(/);
  assert.doesNotMatch(modelPreview, /new Function/);
});

test("the download route is unchanged by preview: guests still redirect, attachments still signed", () => {
  assert.match(downloadRoute, /access\.level === "guest"/);
  assert.match(downloadRoute, /loginPath/);
  assert.match(downloadRoute, /download: file\.filename/);
  assert.match(downloadRoute, /from\("downloads"\)/);
});
