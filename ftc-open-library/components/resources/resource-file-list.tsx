import { ResourceFileExplorer } from "@/components/resources/resource-file-explorer";
import type { AccessSnapshot } from "@/lib/auth/permissions";
import type { ResourceFileSummary, ResourceType } from "@/types/resources";

/** @deprecated Prefer ResourceFileExplorer. Kept as a thin wrapper. */
export function ResourceFileList({
  files,
  access,
  resourceSlug,
  resourceType = "CAD",
}: {
  files: ResourceFileSummary[];
  access: AccessSnapshot;
  resourceSlug: string;
  resourceType?: ResourceType;
}) {
  return (
    <ResourceFileExplorer
      files={files}
      access={access}
      resourceSlug={resourceSlug}
      resourceType={resourceType}
    />
  );
}
