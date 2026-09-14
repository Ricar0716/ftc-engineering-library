/**
 * Single source of truth for resource file uploads.
 *
 * These numbers are mirrored by `public.upload_limit()` and the
 * `upload_*_extension` tables. Trusted enforcement happens in Postgres — a
 * client that skips this app still hits the same limits.
 * `lib/config/upload-policy.test.ts` parses the migrations and fails if the two
 * ever drift apart.
 *
 * Nothing here is a security boundary on its own. The browser reads it for hints
 * and preflight; the database decides.
 */
import type { ResourceFileCategory, ResourceType } from "@/types/resources";

export const RESOURCE_FILES_BUCKET = "resource-files";
export const TUTORIAL_VIDEOS_BUCKET = "tutorial-videos";

export type ResourceStorageBucket = typeof RESOURCE_FILES_BUCKET | typeof TUTORIAL_VIDEOS_BUCKET;

export const RESOURCE_STORAGE_BUCKETS: readonly ResourceStorageBucket[] = [
  RESOURCE_FILES_BUCKET,
  TUTORIAL_VIDEOS_BUCKET,
];

/** Bucket-level ceiling for ordinary attachments (CAD, CODE, MODEL, Tutorial files). */
export const RESOURCE_FILES_BUCKET_LIMIT_BYTES = 100 * 1024 * 1024;

/** Bucket-level ceiling for Tutorial instructional video only. */
export const TUTORIAL_VIDEOS_BUCKET_LIMIT_BYTES = 1024 * 1024 * 1024;

const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

export const uploadLimits = {
  /** Largest ordinary (non-video) object. Also the `resource-files` bucket ceiling. */
  maxFileBytes: 100 * MB,
  /** CODE attachments are smaller; a full FTC project still fits in a ZIP. */
  maxFileBytesByType: {
    CAD: 100 * MB,
    CODE: 50 * MB,
    TUTORIAL: 100 * MB,
    MODEL: 100 * MB,
  } satisfies Record<ResourceType, number>,
  /** Largest Tutorial video object. Also the `tutorial-videos` bucket ceiling. */
  maxVideoBytes: 1 * GB,
  /** Files per resource across every version, including reserved uploads. */
  maxFilesPerResource: 20,
  /** Combined size per resource type, including videos where applicable. */
  totalBytesByType: {
    CAD: 250 * MB,
    CODE: 100 * MB,
    TUTORIAL: Math.round(2.25 * GB),
    MODEL: 250 * MB,
  } satisfies Record<ResourceType, number>,
  /** Tutorial video bytes only; attachments still count toward `totalBytesByType.TUTORIAL`. */
  totalVideoBytesTutorial: 2 * GB,
  maxFilenameLength: 120,

  /**
   * Bytes one contributor may hold across DRAFT / PENDING_REVIEW /
   * CHANGES_REQUESTED resources. Counts registered files, leftover unregistered
   * objects, and live reservations (each object once). Published work does not.
   */
  activeStorageBytesPerUser: 3 * GB,
  /** Simultaneous unfinished submissions per contributor. */
  maxActiveResourcesPerUser: 10,
  /** Structural brake on scripted resource creation. */
  maxResourcesCreatedPerHour: 20,
  /** Open upload authorizations (PENDING and unexpired). */
  maxOpenUploadsPerUser: 5,
  maxOpenUploadsPerResource: 3,
  /** How long a single-object upload authorization stays usable. */
  uploadIntentTtlSeconds: 15 * 60,
  /** How long an unregistered object is left alone before it may be swept. */
  orphanGraceHours: 24,
} as const;

/**
 * Standard `.upload()` is used at or below this size. Larger files use TUS.
 * Tutorial videos always use TUS. This is a transport choice, not a bucket
 * choice — see `shouldUseResumableUpload` vs `uploadBucketFor`.
 *
 * 6 MiB matches the Supabase Storage TUS chunk size, so a single standard
 * request never exceeds one TUS chunk.
 */
export const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 6 * 1024 * 1024;

/**
 * Supabase Storage's TUS implementation currently requires exactly 6 MiB
 * chunks. Other sizes stall. Do not change this without checking current
 * Storage docs.
 */
export const TUS_CHUNK_SIZE_BYTES = 6 * 1024 * 1024;

/** Conservative retry delays for tus-js-client. Not an infinite loop. */
export const TUS_RETRY_DELAYS_MS = [0, 1000, 3000, 5000, 10000] as const;

/** How often an in-progress TUS upload may slide the intent expiry forward. */
export const TUS_INTENT_TOUCH_INTERVAL_MS = 60_000;

export type UploadTransport = "standard" | "tus";

/**
 * Transport selection only. Bucket selection is `uploadBucketFor` / the
 * database, and the two must not be mixed.
 */
export function shouldUseResumableUpload(
  resourceType: ResourceType,
  filename: string,
  sizeBytes: number,
): boolean {
  if (isTutorialVideo(resourceType, filename)) {
    return true;
  }
  return sizeBytes > RESUMABLE_UPLOAD_THRESHOLD_BYTES;
}

export function uploadTransportFor(
  resourceType: ResourceType,
  filename: string,
  sizeBytes: number,
): UploadTransport {
  return shouldUseResumableUpload(resourceType, filename, sizeBytes) ? "tus" : "standard";
}

/**
 * Formats that are never useful to an FTC resource library and that a browser
 * or operating system may treat as runnable. Checked before the allowlist.
 */
const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "msi",
  "bat",
  "cmd",
  "com",
  "scr",
  "cpl",
  "pif",
  "dll",
  "so",
  "dylib",
  "sys",
  "drv",
  "apk",
  "app",
  "deb",
  "rpm",
  "dmg",
  "pkg",
  "appimage",
  "sh",
  "bash",
  "zsh",
  "ps1",
  "psm1",
  "vbs",
  "vbe",
  "wsf",
  "jse",
  "html",
  "htm",
  "xhtml",
  "svg",
  "swf",
  "jar",
  "war",
  "lnk",
  "reg",
  "docm",
  "xlsm",
  "pptm",
]);

const SHARED_EXTENSIONS = [
  "zip",
  "7z",
  "tar",
  "gz",
  "tgz",
  "pdf",
  "md",
  "txt",
  "png",
  "jpg",
  "jpeg",
  "webp",
];

const EXTENSIONS_BY_TYPE: Record<ResourceType, readonly string[]> = {
  CAD: [
    ...SHARED_EXTENSIONS,
    "step",
    "stp",
    "stl",
    "iges",
    "igs",
    "3mf",
    "obj",
    "glb",
    "gltf",
    "dxf",
    "dwg",
    "f3d",
    "f3z",
    "sldprt",
    "sldasm",
    "ipt",
    "iam",
    "prt",
    "asm",
    "x_t",
    "x_b",
    "scad",
    "gcode",
  ],
  CODE: [
    ...SHARED_EXTENSIONS,
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
  ],
  TUTORIAL: [...SHARED_EXTENSIONS, "docx", "pptx", "odt", "csv", "json", "mp4", "webm"],
  MODEL: [
    ...SHARED_EXTENSIONS,
    "csv",
    "json",
    "ipynb",
    "xlsx",
    "ods",
    "py",
    "m",
    "dat",
    "npy",
    "glb",
    "gltf",
    "stl",
    "obj",
    "3mf",
  ],
};

const TUTORIAL_VIDEO_EXTENSIONS = new Set(["mp4", "webm"]);

const FILE_CATEGORY_BY_EXTENSION: Record<string, ResourceFileCategory> = {
  step: "CAD",
  stp: "CAD",
  stl: "CAD",
  iges: "CAD",
  igs: "CAD",
  "3mf": "CAD",
  obj: "CAD",
  glb: "CAD",
  gltf: "CAD",
  dxf: "CAD",
  dwg: "CAD",
  f3d: "CAD",
  f3z: "CAD",
  sldprt: "CAD",
  sldasm: "CAD",
  ipt: "CAD",
  iam: "CAD",
  prt: "CAD",
  asm: "CAD",
  x_t: "CAD",
  x_b: "CAD",
  scad: "CAD",
  gcode: "CAD",
  java: "SOURCE",
  kt: "SOURCE",
  kts: "SOURCE",
  py: "SOURCE",
  c: "SOURCE",
  cc: "SOURCE",
  cpp: "SOURCE",
  h: "SOURCE",
  hpp: "SOURCE",
  gradle: "SOURCE",
  properties: "SOURCE",
  xml: "SOURCE",
  json: "SOURCE",
  yaml: "SOURCE",
  yml: "SOURCE",
  toml: "SOURCE",
  cfg: "SOURCE",
  ipynb: "SOURCE",
  m: "SOURCE",
  pdf: "DOCUMENT",
  md: "DOCUMENT",
  txt: "DOCUMENT",
  docx: "DOCUMENT",
  pptx: "DOCUMENT",
  odt: "DOCUMENT",
  csv: "DOCUMENT",
  xlsx: "DOCUMENT",
  ods: "DOCUMENT",
  dat: "DOCUMENT",
  npy: "DOCUMENT",
  png: "IMAGE",
  jpg: "IMAGE",
  jpeg: "IMAGE",
  webp: "IMAGE",
  mp4: "VIDEO",
  webm: "VIDEO",
};

const MIME_BY_EXTENSION: Record<string, string> = {
  zip: "application/zip",
  "7z": "application/x-7z-compressed",
  tar: "application/x-tar",
  gz: "application/gzip",
  tgz: "application/gzip",
  pdf: "application/pdf",
  md: "text/markdown",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  stl: "model/stl",
  obj: "model/obj",
  "3mf": "model/3mf",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  step: "model/step",
  stp: "model/step",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const DEFAULT_MIME = "application/octet-stream";

export const UPLOAD_GUIDANCE: Record<ResourceType, string> = {
  CAD: "STEP, STL, GLB, native CAD source, or a ZIP archive of the assembly. Interactive preview uses GLB, glTF, STL, OBJ, and 3MF.",
  CODE: "Source files or a ZIP export of the OpMode / library.",
  TUTORIAL:
    "A PDF or Markdown write-up, supporting images, and optional MP4/WebM video (stored privately, not streamed).",
  MODEL:
    "The model package, mesh files for visualization (GLB, glTF, STL, OBJ), and any data files. Uploads are stored as data only and are never executed.",
};

export function fileExtension(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) {
    return "";
  }
  return base.slice(dot + 1).toLowerCase();
}

export function allowedExtensions(resourceType: ResourceType): readonly string[] {
  return EXTENSIONS_BY_TYPE[resourceType];
}

export function isTutorialVideo(resourceType: ResourceType, filename: string): boolean {
  return resourceType === "TUTORIAL" && TUTORIAL_VIDEO_EXTENSIONS.has(fileExtension(filename));
}

/**
 * The server, not the browser, chooses the bucket. CAD/CODE/MODEL never land
 * in `tutorial-videos`, even if the filename looks like a video.
 */
export function uploadBucketFor(
  resourceType: ResourceType,
  filename: string,
): ResourceStorageBucket {
  return isTutorialVideo(resourceType, filename) ? TUTORIAL_VIDEOS_BUCKET : RESOURCE_FILES_BUCKET;
}

export function isResourceStorageBucket(value: string): value is ResourceStorageBucket {
  return value === RESOURCE_FILES_BUCKET || value === TUTORIAL_VIDEOS_BUCKET;
}

export function videoMimeMatches(filename: string, mimeType: string | null | undefined): boolean {
  const extension = fileExtension(filename);
  const mime = (mimeType ?? "").trim().toLowerCase();
  if (!mime || mime === "application/octet-stream") {
    return true;
  }
  if (extension === "mp4") {
    return mime === "video/mp4";
  }
  if (extension === "webm") {
    return mime === "video/webm";
  }
  return true;
}

export function fileCategoryFor(filename: string): ResourceFileCategory {
  return FILE_CATEGORY_BY_EXTENSION[fileExtension(filename)] ?? "OTHER";
}

export function mimeTypeFor(filename: string): string {
  return MIME_BY_EXTENSION[fileExtension(filename)] ?? DEFAULT_MIME;
}

/**
 * Strips directories and anything that could escape the resource folder.
 * Returns null when nothing usable is left.
 */
export function safeFilename(filename: string): string | null {
  const base = (filename.split(/[\\/]/).pop() ?? "").trim();
  if (!base || base === "." || base === "..") {
    return null;
  }

  const cleaned = base
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[.-]+/, "")
    .slice(0, uploadLimits.maxFilenameLength);

  return cleaned.length > 0 ? cleaned : null;
}

export type UploadRejection =
  | "empty"
  | "name_invalid"
  | "extension_blocked"
  | "extension_not_allowed"
  | "file_too_large"
  | "too_many_files"
  | "quota_exceeded"
  | "video_quota_exceeded"
  | "mime_mismatch";

export const UPLOAD_REJECTION_MESSAGES: Record<UploadRejection, string> = {
  empty: "Choose a file to upload.",
  name_invalid: "That filename cannot be used. Rename the file and try again.",
  extension_blocked: "That file type is not accepted by FTC Open Library.",
  extension_not_allowed: "That file type is not accepted for this resource type.",
  file_too_large: "That file is larger than the per-file limit.",
  too_many_files: "This resource already has the maximum number of files.",
  quota_exceeded: "This resource would go over its total size limit.",
  video_quota_exceeded: "This tutorial already has the maximum amount of video.",
  mime_mismatch: "That file type does not match its contents. Use MP4 or WebM for tutorial video.",
};

/** Blocked extensions, exposed so the SQL/TS parity test can compare sets. */
export function blockedExtensions(): readonly string[] {
  return [...BLOCKED_EXTENSIONS].sort();
}

export type UploadCheckInput = {
  filename: string;
  sizeBytes: number;
  resourceType: ResourceType;
  existingFileCount: number;
  existingTotalBytes: number;
  existingVideoBytes?: number;
  mimeType?: string | null;
};

export function checkUpload(input: UploadCheckInput): UploadRejection | null {
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return "empty";
  }

  const safe = safeFilename(input.filename);
  if (!safe) {
    return "name_invalid";
  }

  const extension = fileExtension(safe);
  if (!extension || BLOCKED_EXTENSIONS.has(extension)) {
    return "extension_blocked";
  }
  if (!allowedExtensions(input.resourceType).includes(extension)) {
    return "extension_not_allowed";
  }

  const video = isTutorialVideo(input.resourceType, safe);
  if (video && !videoMimeMatches(safe, input.mimeType)) {
    return "mime_mismatch";
  }

  const perFile = video
    ? uploadLimits.maxVideoBytes
    : uploadLimits.maxFileBytesByType[input.resourceType];
  if (input.sizeBytes > perFile) {
    return "file_too_large";
  }
  if (input.existingFileCount >= uploadLimits.maxFilesPerResource) {
    return "too_many_files";
  }
  if (
    input.existingTotalBytes + input.sizeBytes >
    uploadLimits.totalBytesByType[input.resourceType]
  ) {
    return "quota_exceeded";
  }
  if (video) {
    const existingVideo = input.existingVideoBytes ?? 0;
    if (existingVideo + input.sizeBytes > uploadLimits.totalVideoBytesTutorial) {
      return "video_quota_exceeded";
    }
  }

  return null;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
