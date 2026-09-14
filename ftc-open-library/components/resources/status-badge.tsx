import { Badge } from "@/components/ui/badge";
import { RESOURCE_STATUS_LABELS } from "@/lib/constants/resources";
import type { ResourceStatus } from "@/types/resources";

const tones: Record<ResourceStatus, "neutral" | "accent"> = {
  DRAFT: "neutral",
  PENDING_REVIEW: "accent",
  CHANGES_REQUESTED: "accent",
  PUBLISHED: "accent",
  REJECTED: "neutral",
  ARCHIVED: "neutral",
};

/**
 * Status is always spelled out. Tone is decoration only, never the sole carrier
 * of meaning.
 */
export function StatusBadge({ status }: { status: ResourceStatus }) {
  return <Badge tone={tones[status]}>{RESOURCE_STATUS_LABELS[status]}</Badge>;
}
