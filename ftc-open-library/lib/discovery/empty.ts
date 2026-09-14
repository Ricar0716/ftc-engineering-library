import { RESOURCE_TYPE_LABELS } from "../constants/resources.ts";
import type { ResourceType } from "../../types/resources.ts";
import type { ExploreSearchParams } from "../search/params.ts";

export const DISCOVERY_EMPTY = {
  library: "No published resources yet.",
  search: "No resources found",
  filter:
    "Try removing some filters, using a broader search, or browsing another resource type.",
  launch: "Resources will appear here as the community starts sharing.",
} as const;

export function exploreEmptyCopy(filters: ExploreSearchParams): { title: string; description: string } {
  if (filters.q || filters.type || filters.category || filters.tag || filters.season) {
    return {
      title: DISCOVERY_EMPTY.search,
      description: DISCOVERY_EMPTY.filter,
    };
  }

  return {
    title: DISCOVERY_EMPTY.library,
    description: DISCOVERY_EMPTY.launch,
  };
}

export function typeSectionEmptyTitle(type: ResourceType): string {
  return `No published ${RESOURCE_TYPE_LABELS[type]} resources yet.`;
}
