"use client";

import { useMemo } from "react";
import { AuthorizedImage } from "@/components/previews/authorized-image";
import { MeshPreview } from "@/components/previews/mesh-preview";
import { PreviewAuthGate } from "@/components/previews/preview-auth-gate";
import { PreviewFallback } from "@/components/previews/preview-fallback";
import { formatBytes } from "@/lib/config/uploads";
import type { AccessSnapshot } from "@/lib/auth/permissions";
import { filePreviewKind, meshPreviewCandidates, oversizedMeshFiles } from "@/lib/previews/select";
import type { ResourceFileSummary } from "@/types/resources";

export function ModelPreview({
  files,
  access,
  resourceSlug,
}: {
  files: ResourceFileSummary[];
  access: AccessSnapshot;
  resourceSlug: string;
}) {
  const images = useMemo(
    () => files.filter((file) => filePreviewKind("MODEL", file) === "image"),
    [files],
  );
  const meshes = useMemo(() => meshPreviewCandidates("MODEL", files), [files]);
  const oversized = useMemo(() => oversizedMeshFiles("MODEL", files), [files]);
  const showMeshPanel = meshes.length > 0 || oversized.length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="rounded-lg border border-line bg-surface p-4">
        <h3 className="text-sm font-medium text-ink">Model package</h3>
        <p className="mt-1 text-sm leading-6 text-ink-muted">
          Models are not executed in the browser. There is no inference, calculator runtime, or
          uploaded-script evaluation here. Mesh files can be inspected in the 3D viewer; everything
          else stays download-only.
        </p>
        {files.length > 0 ? (
          <ul className="mt-3 space-y-1 font-mono text-xs text-ink-muted">
            {files.slice(0, 8).map((file) => (
              <li key={file.id} className="truncate">
                {file.filename}
                {file.sizeBytes != null ? ` · ${formatBytes(file.sizeBytes)}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {showMeshPanel ? (
        <MeshPreview
          resourceType="MODEL"
          files={files}
          access={access}
          resourceSlug={resourceSlug}
        />
      ) : images.length === 0 ? (
        <PreviewFallback
          title="No interactive preview available."
          description="GLB, glTF, STL, and OBJ can be previewed here. Packages, notebooks, and Blender files are not executed."
        />
      ) : null}
      {images.length > 0 ? (
        <PreviewAuthGate access={access} resourceSlug={resourceSlug}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {images.map((file) => (
              <li key={file.id}>
                <AuthorizedImage file={file} />
              </li>
            ))}
          </ul>
        </PreviewAuthGate>
      ) : null}
    </div>
  );
}
