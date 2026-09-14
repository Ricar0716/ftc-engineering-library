import type { ResourceFileSummary } from "../../types/resources.ts";

export type SourceTreeFile = {
  kind: "file";
  name: string;
  file: ResourceFileSummary;
};

export type SourceTreeFolder = {
  kind: "folder";
  name: string;
  children: SourceTreeNode[];
};

export type SourceTreeNode = SourceTreeFile | SourceTreeFolder;

/**
 * Build a source tree for CODE preview.
 *
 * Upload sanitizing strips folders, so most resources are a single `Source/`
 * root. Nested names are still honored if a `/` survives in the filename.
 */
export function buildSourceFileTree(
  files: ResourceFileSummary[],
  rootName = "Source",
): SourceTreeFolder {
  const root: SourceTreeFolder = { kind: "folder", name: rootName, children: [] };
  const sorted = [...files].sort((a, b) => a.filename.localeCompare(b.filename));

  for (const file of sorted) {
    const parts = file.filename.split("/").filter((part) => part.length > 0);
    if (parts.length === 0) {
      continue;
    }

    let current = root;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index]!;
      let folder = current.children.find(
        (child): child is SourceTreeFolder => child.kind === "folder" && child.name === part,
      );
      if (!folder) {
        folder = { kind: "folder", name: part, children: [] };
        current.children.push(folder);
      }
      current = folder;
    }

    current.children.push({ kind: "file", name: parts[parts.length - 1]!, file });
  }

  return root;
}
