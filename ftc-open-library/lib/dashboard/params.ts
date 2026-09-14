import type { ResourceStatus } from "@/types/resources";

export const DASHBOARD_RESOURCE_FILTERS = [
  "all",
  "published",
  "drafts",
  "reviews",
  "archived",
] as const;

export type DashboardResourceFilter = (typeof DASHBOARD_RESOURCE_FILTERS)[number];

export const DASHBOARD_RESOURCE_FILTER_LABELS: Record<DashboardResourceFilter, string> = {
  all: "All",
  published: "Published",
  drafts: "Draft",
  reviews: "Pending review",
  archived: "Archived",
};

export const DASHBOARD_RESOURCE_FILTER_STATUSES: Record<
  DashboardResourceFilter,
  readonly ResourceStatus[] | null
> = {
  all: null,
  published: ["PUBLISHED"],
  drafts: ["DRAFT", "CHANGES_REQUESTED"],
  reviews: ["PENDING_REVIEW"],
  archived: ["ARCHIVED", "REJECTED"],
};

export function parseDashboardResourceFilter(
  input: Record<string, string | string[] | undefined>,
): DashboardResourceFilter {
  const raw = Array.isArray(input.status) ? input.status[0] : input.status;
  if (raw && (DASHBOARD_RESOURCE_FILTERS as readonly string[]).includes(raw)) {
    return raw as DashboardResourceFilter;
  }
  return "all";
}
