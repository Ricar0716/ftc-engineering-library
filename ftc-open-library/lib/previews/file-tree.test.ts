import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSourceFileTree } from "./file-tree.ts";
import type { ResourceFileSummary } from "../../types/resources.ts";

function file(filename: string): ResourceFileSummary {
  return {
    id: filename,
    versionId: "v1",
    filename,
    fileType: "SOURCE",
    mimeType: null,
    sizeBytes: 10,
  };
}

test("flat source files sit under a single Source root", () => {
  const tree = buildSourceFileTree([file("Robot.java"), file("Drive.java"), file("Constants.java")]);
  assert.equal(tree.name, "Source");
  assert.deepEqual(
    tree.children.map((child) => (child.kind === "file" ? child.name : child.name)),
    ["Constants.java", "Drive.java", "Robot.java"],
  );
});

test("slash-separated names nest folders when present", () => {
  const tree = buildSourceFileTree([file("TeamCode/Robot.java"), file("TeamCode/Drive.java")]);
  const folder = tree.children[0];
  assert.equal(folder?.kind, "folder");
  if (folder?.kind !== "folder") {
    return;
  }
  assert.equal(folder.name, "TeamCode");
  assert.deepEqual(
    folder.children.map((child) => (child.kind === "file" ? child.name : "")),
    ["Drive.java", "Robot.java"],
  );
});
