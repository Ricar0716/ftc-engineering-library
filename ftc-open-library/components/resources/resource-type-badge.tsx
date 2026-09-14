import { Badge } from "@/components/ui/badge";
import { RESOURCE_TYPE_LABELS } from "@/lib/constants/resources";
import type { ResourceType } from "@/types/resources";

const tones: Record<ResourceType, "cad" | "code" | "tutorial" | "model"> = {
  CAD: "cad",
  CODE: "code",
  TUTORIAL: "tutorial",
  MODEL: "model",
};

export function ResourceTypeBadge({ type }: { type: ResourceType }) {
  return <Badge tone={tones[type]}>{RESOURCE_TYPE_LABELS[type]}</Badge>;
}
