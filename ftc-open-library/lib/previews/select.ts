import { fileExtension } from "../config/uploads.ts";
import type { ResourceFileSummary, ResourceType } from "../../types/resources.ts";

/**
 * Mesh formats the shared Three.js viewer can load. Priority when several
 * candidates exist: GLB → glTF → STL → OBJ → 3MF. STEP, IGES, Fusion, and
 * SolidWorks stay download-only — they need a conversion pipeline.
 */
export const MESH_PREVIEW_PRIORITY = ["glb", "gltf", "stl", "obj", "3mf"] as const;
export const MESH_PREVIEW_EXTENSIONS = new Set<string>(MESH_PREVIEW_PRIORITY);
/** Alias used by CAD preview selection. Same set as MODEL mesh files. */
export const CAD_PREVIEW_EXTENSIONS = MESH_PREVIEW_EXTENSIONS;

export const CODE_PREVIEW_EXTENSIONS = new Set([
  "java",
  "kt",
  "kts",
  "py",
  "c",
  "cc",
  "cpp",
  "h",
  "hpp",
  "gradle",
  "properties",
  "xml",
  "json",
  "yaml",
  "yml",
  "toml",
  "cfg",
  "md",
  "txt",
]);

export const IMAGE_PREVIEW_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
export const MARKDOWN_PREVIEW_EXTENSIONS = new Set(["md", "txt"]);
export const VIDEO_EXTENSIONS = new Set(["mp4", "webm"]);

/** Do not pull a whole FTC project into the tab. */
export const MAX_CODE_PREVIEW_BYTES = 400 * 1024;
/** Mesh files above this stay download-only. */
export const MAX_MESH_PREVIEW_BYTES = 25 * 1024 * 1024;
export const MAX_CAD_PREVIEW_BYTES = MAX_MESH_PREVIEW_BYTES;
export const MAX_IMAGE_PREVIEW_BYTES = 8 * 1024 * 1024;
export const MAX_MARKDOWN_PREVIEW_BYTES = 200 * 1024;

export type PreviewSurface = "CAD" | "CODE" | "TUTORIAL" | "MODEL";

export type PreviewComponentName =
  "CADPreview" | "CodePreview" | "TutorialPreview" | "ModelPreview";

const PREVIEW_COMPONENTS: Record<ResourceType, PreviewComponentName> = {
  CAD: "CADPreview",
  CODE: "CodePreview",
  TUTORIAL: "TutorialPreview",
  MODEL: "ModelPreview",
};

/** Central mapping used by ResourcePreview and by selection tests. */
export function previewComponentFor(resourceType: ResourceType): PreviewComponentName {
  return PREVIEW_COMPONENTS[resourceType];
}

export type FilePreviewKind = "cad" | "code" | "image" | "markdown" | "video-download" | "none";

export function previewSurfaceFor(resourceType: ResourceType): PreviewSurface {
  return resourceType;
}

export function filePreviewKind(
  resourceType: ResourceType,
  file: Pick<ResourceFileSummary, "filename" | "sizeBytes">,
): FilePreviewKind {
  const extension = fileExtension(file.filename);
  const size = file.sizeBytes ?? 0;

  if (
    (resourceType === "CAD" || resourceType === "MODEL") &&
    MESH_PREVIEW_EXTENSIONS.has(extension)
  ) {
    return size > 0 && size <= MAX_MESH_PREVIEW_BYTES ? "cad" : "none";
  }
  if (resourceType === "CODE" && CODE_PREVIEW_EXTENSIONS.has(extension)) {
    return size <= MAX_CODE_PREVIEW_BYTES ? "code" : "none";
  }
  if (resourceType === "TUTORIAL") {
    if (VIDEO_EXTENSIONS.has(extension)) {
      return "video-download";
    }
    if (IMAGE_PREVIEW_EXTENSIONS.has(extension) && size > 0 && size <= MAX_IMAGE_PREVIEW_BYTES) {
      return "image";
    }
    if (
      MARKDOWN_PREVIEW_EXTENSIONS.has(extension) &&
      size > 0 &&
      size <= MAX_MARKDOWN_PREVIEW_BYTES
    ) {
      return "markdown";
    }
  }
  if (resourceType === "MODEL" && IMAGE_PREVIEW_EXTENSIONS.has(extension)) {
    return size > 0 && size <= MAX_IMAGE_PREVIEW_BYTES ? "image" : "none";
  }
  return "none";
}

export function isPreviewable(
  resourceType: ResourceType,
  file: Pick<ResourceFileSummary, "filename" | "sizeBytes">,
): boolean {
  const kind = filePreviewKind(resourceType, file);
  return kind !== "none" && kind !== "video-download";
}

export function meshPreviewCandidates(
  resourceType: Extract<ResourceType, "CAD" | "MODEL">,
  files: ResourceFileSummary[],
): ResourceFileSummary[] {
  return files
    .filter((file) => filePreviewKind(resourceType, file) === "cad")
    .slice()
    .sort((a, b) => {
      const rankA = meshPreviewRank(a.filename);
      const rankB = meshPreviewRank(b.filename);
      return rankA - rankB || a.filename.localeCompare(b.filename);
    });
}

export function cadPreviewCandidates(files: ResourceFileSummary[]): ResourceFileSummary[] {
  return meshPreviewCandidates("CAD", files);
}

export function oversizedMeshFiles(
  resourceType: Extract<ResourceType, "CAD" | "MODEL">,
  files: ResourceFileSummary[],
): ResourceFileSummary[] {
  return files.filter((file) => tooLargeForPreview(resourceType, file));
}

export function meshFormatLabel(filename: string): string {
  const extension = fileExtension(filename);
  const labels: Record<string, string> = {
    glb: "GLB",
    gltf: "glTF",
    stl: "STL",
    obj: "OBJ",
    "3mf": "3MF",
  };
  return labels[extension] ?? (extension ? extension.toUpperCase() : "Unknown");
}

function meshPreviewRank(filename: string): number {
  const index = MESH_PREVIEW_PRIORITY.indexOf(
    fileExtension(filename) as (typeof MESH_PREVIEW_PRIORITY)[number],
  );
  return index === -1 ? MESH_PREVIEW_PRIORITY.length : index;
}

export function codePreviewCandidates(files: ResourceFileSummary[]): ResourceFileSummary[] {
  return files.filter((file) => filePreviewKind("CODE", file) === "code");
}

/** Source files shown in the CODE tree, including oversized "download to view" entries. */
export function codeListedFiles(files: ResourceFileSummary[]): ResourceFileSummary[] {
  return files
    .filter((file) => CODE_PREVIEW_EXTENSIONS.has(fileExtension(file.filename)))
    .slice()
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

export function languageLabelFor(filename: string): string {
  const extension = fileExtension(filename);
  const labels: Record<string, string> = {
    java: "Java",
    kt: "Kotlin",
    kts: "Kotlin",
    py: "Python",
    c: "C",
    cc: "C++",
    cpp: "C++",
    h: "C/C++ header",
    hpp: "C++ header",
    gradle: "Gradle",
    json: "JSON",
    xml: "XML",
    yaml: "YAML",
    yml: "YAML",
    md: "Markdown",
    txt: "Text",
  };
  return labels[extension] ?? extension.toUpperCase();
}

export function highlightLanguageFor(filename: string): string | null {
  const extension = fileExtension(filename);
  const map: Record<string, string> = {
    java: "java",
    kt: "kotlin",
    kts: "kotlin",
    py: "python",
    c: "c",
    h: "c",
    cc: "cpp",
    cpp: "cpp",
    hpp: "cpp",
    gradle: "gradle",
    json: "json",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    txt: "plaintext",
    properties: "properties",
    toml: "ini",
    cfg: "ini",
  };
  return map[extension] ?? null;
}

export function tooLargeForPreview(
  resourceType: ResourceType,
  file: Pick<ResourceFileSummary, "filename" | "sizeBytes">,
): boolean {
  const extension = fileExtension(file.filename);
  const size = file.sizeBytes ?? 0;
  if (
    (resourceType === "CAD" || resourceType === "MODEL") &&
    MESH_PREVIEW_EXTENSIONS.has(extension)
  ) {
    return size > MAX_MESH_PREVIEW_BYTES;
  }
  if (resourceType === "CODE" && CODE_PREVIEW_EXTENSIONS.has(extension)) {
    return size > MAX_CODE_PREVIEW_BYTES;
  }
  return false;
}
