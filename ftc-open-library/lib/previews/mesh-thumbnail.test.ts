import assert from "node:assert/strict";
import { test } from "node:test";
import { MESH_THUMBNAIL_STATUS } from "./mesh-thumbnail.ts";
import { MESH_PREVIEW_EXTENSIONS, meshFormatLabel } from "./select.ts";

test("mesh card thumbnails stay deferred — no render farm in this step", () => {
  assert.equal(MESH_THUMBNAIL_STATUS, "deferred");
});

test("interactive preview formats are GLB, glTF, STL, OBJ, and 3MF", () => {
  for (const extension of ["glb", "gltf", "stl", "obj", "3mf"]) {
    assert.equal(MESH_PREVIEW_EXTENSIONS.has(extension), true, extension);
  }
  assert.equal(MESH_PREVIEW_EXTENSIONS.has("step"), false);
  assert.equal(MESH_PREVIEW_EXTENSIONS.has("blend"), false);
  assert.equal(meshFormatLabel("arm.glb"), "GLB");
});
