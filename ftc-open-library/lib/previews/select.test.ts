import assert from "node:assert/strict";
import { test } from "node:test";
import { groupResourceFiles } from "./groups.ts";
import {
  cadPreviewCandidates,
  codeListedFiles,
  codePreviewCandidates,
  filePreviewKind,
  isPreviewable,
  MAX_CAD_PREVIEW_BYTES,
  MAX_CODE_PREVIEW_BYTES,
  meshFormatLabel,
  meshPreviewCandidates,
  previewComponentFor,
  tooLargeForPreview,
} from "./select.ts";
import type { ResourceFileSummary } from "../../types/resources.ts";

function file(
  filename: string,
  sizeBytes: number,
  fileType: ResourceFileSummary["fileType"] = "OTHER",
): ResourceFileSummary {
  return {
    id: filename,
    versionId: "v1",
    filename,
    fileType,
    mimeType: null,
    sizeBytes,
  };
}

test("ResourcePreview selection is CAD, CODE, TUTORIAL, MODEL", () => {
  assert.equal(previewComponentFor("CAD"), "CADPreview");
  assert.equal(previewComponentFor("CODE"), "CodePreview");
  assert.equal(previewComponentFor("TUTORIAL"), "TutorialPreview");
  assert.equal(previewComponentFor("MODEL"), "ModelPreview");
});

test("CAD preview accepts GLB, glTF, STL, OBJ, and 3MF under the size cap", () => {
  assert.equal(filePreviewKind("CAD", file("chassis.stl", 1024)), "cad");
  assert.equal(filePreviewKind("CAD", file("wheel.obj", 2048)), "cad");
  assert.equal(filePreviewKind("CAD", file("plate.3mf", 4096)), "cad");
  assert.equal(filePreviewKind("CAD", file("assembly.glb", 1024)), "cad");
  assert.equal(filePreviewKind("CAD", file("assembly.gltf", 1024)), "cad");
  assert.equal(filePreviewKind("CAD", file("assembly.step", 1024)), "none");
  assert.equal(filePreviewKind("CAD", file("huge.stl", MAX_CAD_PREVIEW_BYTES + 1)), "none");
  assert.equal(tooLargeForPreview("CAD", file("huge.stl", MAX_CAD_PREVIEW_BYTES + 1)), true);
  assert.deepEqual(
    cadPreviewCandidates([file("a.step", 10, "CAD"), file("b.stl", 10, "CAD")]).map(
      (item) => item.filename,
    ),
    ["b.stl"],
  );
});

test("mesh preview prefers GLB, then glTF, then STL, then OBJ", () => {
  assert.deepEqual(
    meshPreviewCandidates("CAD", [
      file("part.obj", 10, "CAD"),
      file("part.stl", 10, "CAD"),
      file("part.gltf", 10, "CAD"),
      file("part.glb", 10, "CAD"),
      file("part.step", 10, "CAD"),
    ]).map((item) => item.filename),
    ["part.glb", "part.gltf", "part.stl", "part.obj"],
  );
  assert.equal(meshFormatLabel("robot.glb"), "GLB");
  assert.equal(meshFormatLabel("robot.gltf"), "glTF");
});

test("MODEL preview uses the same mesh viewer formats and never STEP", () => {
  assert.equal(filePreviewKind("MODEL", file("robot.glb", 2048)), "cad");
  assert.equal(filePreviewKind("MODEL", file("robot.stl", 2048)), "cad");
  assert.equal(filePreviewKind("MODEL", file("robot.obj", 2048)), "cad");
  assert.equal(filePreviewKind("MODEL", file("scene.blend", 2048)), "none");
  assert.equal(filePreviewKind("MODEL", file("notes.png", 2048)), "image");
  assert.equal(filePreviewKind("MODEL", file("huge.glb", MAX_CAD_PREVIEW_BYTES + 1)), "none");
  assert.equal(tooLargeForPreview("MODEL", file("huge.glb", MAX_CAD_PREVIEW_BYTES + 1)), true);
  assert.deepEqual(
    meshPreviewCandidates("MODEL", [file("weights.npy", 10), file("mesh.glb", 10)]).map(
      (item) => item.filename,
    ),
    ["mesh.glb"],
  );
});

test("CODE preview accepts FTC languages and rejects oversized files", () => {
  assert.equal(filePreviewKind("CODE", file("Robot.java", 100)), "code");
  assert.equal(filePreviewKind("CODE", file("Drive.kt", 100)), "code");
  assert.equal(filePreviewKind("CODE", file("main.cpp", 100)), "code");
  assert.equal(filePreviewKind("CODE", file("auto.py", 100)), "code");
  assert.equal(filePreviewKind("CODE", file("bundle.zip", 100)), "none");
  assert.equal(filePreviewKind("CODE", file("Huge.java", MAX_CODE_PREVIEW_BYTES + 1)), "none");
  assert.equal(isPreviewable("CODE", file("Robot.java", 100)), true);
  assert.equal(codePreviewCandidates([file("a.zip", 10), file("b.java", 10)]).length, 1);
  assert.deepEqual(
    codeListedFiles([file("Huge.java", MAX_CODE_PREVIEW_BYTES + 1), file("b.java", 10)]).map(
      (item) => item.filename,
    ),
    ["b.java", "Huge.java"],
  );
});

test("unsupported formats fail gracefully as not previewable", () => {
  assert.equal(filePreviewKind("CAD", file("part.f3d", 100)), "none");
  assert.equal(filePreviewKind("CAD", file("part.iges", 100)), "none");
  assert.equal(isPreviewable("CAD", file("part.step", 100)), false);
  assert.equal(isPreviewable("MODEL", file("weights.pkl", 100)), false);
});

test("tutorial videos are download-only, not streamed", () => {
  assert.equal(filePreviewKind("TUTORIAL", file("guide.mp4", 5_000_000)), "video-download");
  assert.equal(isPreviewable("TUTORIAL", file("guide.mp4", 5_000_000)), false);
  assert.equal(filePreviewKind("TUTORIAL", file("photo.png", 50_000)), "image");
});

test("file explorer groups by type rather than inventing folders", () => {
  const groups = groupResourceFiles([
    file("Robot.java", 10, "SOURCE"),
    file("Drive.java", 10, "SOURCE"),
    file("notes.md", 10, "DOCUMENT"),
  ]);
  assert.equal(groups[0]?.label, "Source");
  assert.equal(groups[1]?.label, "Documentation");
  assert.deepEqual(
    groups[0]?.files.map((item) => item.filename),
    ["Drive.java", "Robot.java"],
  );
});
