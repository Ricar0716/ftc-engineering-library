/**
 * Planned ResourceCard thumbnail from a 3D snapshot. Not implemented.
 *
 * A later job would load one authorized mesh (same preview permission as
 * `/api/previews/[fileId]`), render an offscreen frame, and store a
 * same-origin public PNG. Never a Storage signed URL, never a public
 * `resource-files` object.
 *
 * Do not add a `preview_asset` table until that pipeline exists.
 */
export type MeshThumbnailRequest = {
  fileId: string;
  resourceId: string;
  width: number;
  height: number;
};

export const MESH_THUMBNAIL_STATUS = "deferred" as const;
