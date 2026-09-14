import {
  isResourceStorageBucket,
  RESOURCE_FILES_BUCKET,
  TUTORIAL_VIDEOS_BUCKET,
  type ResourceStorageBucket,
} from "../config/uploads.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function storagePathBelongsToResource(storagePath: string, resourceId: string): boolean {
  if (!storagePath || !UUID_RE.test(resourceId)) {
    return false;
  }
  const normalized = storagePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || normalized.includes("://")) {
    return false;
  }
  const folder = normalized.split("/")[0];
  return folder.toLowerCase() === resourceId.toLowerCase();
}

export function resourceFilesBucket(): string {
  return RESOURCE_FILES_BUCKET;
}

export function tutorialVideosBucket(): string {
  return TUTORIAL_VIDEOS_BUCKET;
}

/**
 * Resolves the Storage bucket from trusted `resource_files` metadata.
 * Unknown values fall back to the original attachments bucket rather than
 * accepting a client-supplied name.
 */
export function resolveResourceStorageBucket(value: string | null | undefined): ResourceStorageBucket {
  if (value && isResourceStorageBucket(value)) {
    return value;
  }
  return RESOURCE_FILES_BUCKET;
}

export const SIGNED_DOWNLOAD_TTL_SECONDS = 60;
