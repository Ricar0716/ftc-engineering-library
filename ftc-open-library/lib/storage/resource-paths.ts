import { safeFilename } from "../config/uploads.ts";
import { isUuid } from "../utils/id.ts";

/**
 * Object keys inside the private `resource-files` bucket.
 *
 *   <resource-id>/<version-id>/<file-id>_<safe-filename>
 *
 * The first folder is what `public.storage_first_folder_uuid()` reads, so the
 * Storage RLS policies resolve the owning resource from the key itself. Keys are
 * always built here from server-generated UUIDs; a browser never supplies one.
 */
export function buildResourceObjectPath(input: {
  resourceId: string;
  versionId: string;
  fileId: string;
  filename: string;
}): string | null {
  if (!isUuid(input.resourceId) || !isUuid(input.versionId) || !isUuid(input.fileId)) {
    return null;
  }

  const safe = safeFilename(input.filename);
  if (!safe) {
    return null;
  }

  return `${input.resourceId}/${input.versionId}/${input.fileId}_${safe}`;
}

/**
 * Re-validates a key before it is written to `resource_files` or signed. Guards
 * against traversal, absolute keys, and objects filed under another resource.
 */
export function isResourceObjectPath(
  path: string,
  expected: { resourceId: string; versionId: string },
): boolean {
  if (typeof path !== "string" || path.length === 0 || path.length > 512) {
    return false;
  }
  if (path !== path.normalize("NFC")) {
    return false;
  }
  if (path.includes("..") || path.includes("\\") || path.includes("://") || path.startsWith("/")) {
    return false;
  }

  const segments = path.split("/");
  if (segments.length !== 3) {
    return false;
  }

  const [resourceId, versionId, objectName] = segments;
  if (resourceId !== expected.resourceId || versionId !== expected.versionId) {
    return false;
  }
  if (!objectName || objectName.startsWith(".")) {
    return false;
  }

  return /^[0-9a-fA-F-]{36}_[A-Za-z0-9._-]+$/.test(objectName);
}
