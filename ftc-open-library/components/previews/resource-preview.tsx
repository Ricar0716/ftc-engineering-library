import { CADPreview } from "@/components/previews/cad-preview";
import { CodePreview } from "@/components/previews/code-preview";
import { ModelPreview } from "@/components/previews/model-preview";
import { PreviewFallback } from "@/components/previews/preview-fallback";
import { TutorialPreview } from "@/components/previews/tutorial-preview";
import type { AccessSnapshot } from "@/lib/auth/permissions";
import { previewComponentFor } from "@/lib/previews/select";
import type { ResourceFileSummary, ResourceType } from "@/types/resources";

export function ResourcePreview({
  resourceType,
  files,
  access,
  resourceSlug,
}: {
  resourceType: ResourceType;
  files: ResourceFileSummary[];
  access: AccessSnapshot;
  resourceSlug: string;
}) {
  const component = previewComponentFor(resourceType);
  const props = { files, access, resourceSlug };

  if (component === "CADPreview") {
    return <CADPreview {...props} />;
  }
  if (component === "CodePreview") {
    return <CodePreview {...props} />;
  }
  if (component === "TutorialPreview") {
    return <TutorialPreview {...props} />;
  }
  if (component === "ModelPreview") {
    return <ModelPreview {...props} />;
  }

  return <PreviewFallback />;
}
