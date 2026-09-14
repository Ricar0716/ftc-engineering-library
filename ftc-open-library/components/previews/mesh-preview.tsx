"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { PreviewAuthGate } from "@/components/previews/preview-auth-gate";
import { PreviewFallback } from "@/components/previews/preview-fallback";
import { Select } from "@/components/ui/select";
import { formatBytes } from "@/lib/config/uploads";
import type { AccessSnapshot } from "@/lib/auth/permissions";
import { meshFormatLabel, meshPreviewCandidates, oversizedMeshFiles } from "@/lib/previews/select";
import type { ResourceFileSummary, ResourceType } from "@/types/resources";

const ModelViewer = dynamic(
  () => import("@/components/viewer/model-viewer").then((module) => module.ModelViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(28rem,70vh)] items-center justify-center rounded-lg border border-line bg-[#1c1915] text-sm text-[#fffcf8]">
        Loading 3D viewer…
      </div>
    ),
  },
);

const EMPTY_COPY: Record<
  Extract<ResourceType, "CAD" | "MODEL">,
  { none: string; large: string }
> = {
  CAD: {
    none: "GLB, glTF, STL, OBJ, and 3MF can be previewed here. STEP, IGES, and native CAD files remain download-only.",
    large: "The mesh is over 25 MB, so it is not loaded in the browser.",
  },
  MODEL: {
    none: "GLB, glTF, STL, and OBJ can be previewed here. Packages, notebooks, and Blender files are not executed.",
    large: "The mesh is over 25 MB, so it is not loaded in the browser.",
  },
};

export function MeshPreview({
  resourceType,
  files,
  access,
  resourceSlug,
}: {
  resourceType: Extract<ResourceType, "CAD" | "MODEL">;
  files: ResourceFileSummary[];
  access: AccessSnapshot;
  resourceSlug: string;
}) {
  const candidates = useMemo(
    () => meshPreviewCandidates(resourceType, files),
    [files, resourceType],
  );
  const oversized = useMemo(() => oversizedMeshFiles(resourceType, files), [files, resourceType]);
  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? "");
  const selected = candidates.find((file) => file.id === selectedId) ?? candidates[0] ?? null;

  if (candidates.length === 0) {
    const large = oversized.length > 0;
    return (
      <PreviewFallback
        title={
          large
            ? "Large model. Download file for full resolution."
            : "No interactive preview available."
        }
        description={large ? EMPTY_COPY[resourceType].large : EMPTY_COPY[resourceType].none}
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {candidates.length > 1 ? (
        <Select
          id={`${resourceType.toLowerCase()}-preview-file`}
          name={`${resourceType.toLowerCase()}-preview-file`}
          label="Preview file"
          value={selected?.id}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {candidates.map((file) => (
            <option key={file.id} value={file.id}>
              {file.filename}
              {file.sizeBytes != null ? ` · ${formatBytes(file.sizeBytes)}` : ""}
            </option>
          ))}
        </Select>
      ) : null}
      {selected ? <MeshFileMeta file={selected} /> : null}
      <PreviewAuthGate access={access} resourceSlug={resourceSlug}>
        {selected ? <VisibleModelViewer fileId={selected.id} filename={selected.filename} /> : null}
      </PreviewAuthGate>
      <p className="font-mono text-[11px] text-ink-muted">
        Rotate, zoom, and pan the model. The viewer loads a short-lived authorized file, not a
        public Storage URL.
      </p>
    </div>
  );
}

function MeshFileMeta({ file }: { file: ResourceFileSummary }) {
  return (
    <dl className="grid gap-1 font-mono text-xs text-ink-muted sm:grid-cols-3">
      <div className="min-w-0">
        <dt className="text-[10px] uppercase tracking-wide">File</dt>
        <dd className="truncate text-ink">{file.filename}</dd>
      </div>
      <div>
        <dt className="text-[10px] uppercase tracking-wide">Format</dt>
        <dd className="text-ink">{meshFormatLabel(file.filename)}</dd>
      </div>
      <div>
        <dt className="text-[10px] uppercase tracking-wide">Size</dt>
        <dd className="text-ink">{formatBytes(file.sizeBytes)}</dd>
      </div>
    </dl>
  );
}

function VisibleModelViewer({ fileId, filename }: { fileId: string; filename: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="min-w-0">
      {visible ? (
        <ModelViewer fileId={fileId} filename={filename} />
      ) : (
        <div className="flex h-[min(28rem,70vh)] items-center justify-center rounded-lg border border-line bg-[#1c1915] text-sm text-[#fffcf8]">
          3D preview loads when this section is visible.
        </div>
      )}
    </div>
  );
}
