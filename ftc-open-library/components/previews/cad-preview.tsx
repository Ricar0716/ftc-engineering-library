"use client";

import { MeshPreview } from "@/components/previews/mesh-preview";
import type { AccessSnapshot } from "@/lib/auth/permissions";
import type { ResourceFileSummary } from "@/types/resources";

export function CADPreview({
  files,
  access,
  resourceSlug,
}: {
  files: ResourceFileSummary[];
  access: AccessSnapshot;
  resourceSlug: string;
}) {
  return (
    <MeshPreview resourceType="CAD" files={files} access={access} resourceSlug={resourceSlug} />
  );
}
