import type {
  ResourceStatus,
  ResourceType,
  ResourceVisibility,
  ReviewDecision,
} from "@/types/resources";

export const RESOURCE_TYPES = [
  "CAD",
  "CODE",
  "TUTORIAL",
  "MODEL",
] as const satisfies readonly ResourceType[];

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  CAD: "CAD",
  CODE: "Code",
  TUTORIAL: "Tutorial",
  MODEL: "Model",
};

export const RESOURCE_TYPE_PURPOSE: Record<ResourceType, string> = {
  CAD: "Build it",
  CODE: "Program it",
  TUTORIAL: "Learn it",
  MODEL: "Analyze it",
};

export const RESOURCE_TYPE_BLURBS: Record<ResourceType, string> = {
  CAD: "Mechanisms, assemblies, and printable parts.",
  CODE: "TeleOp, autonomous, and control examples.",
  TUTORIAL: "Guides for building, CAD, and programming.",
  MODEL: "Calculators, simulators, and engineering visualizers.",
};

export const RESOURCE_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "CHANGES_REQUESTED",
  "PUBLISHED",
  "REJECTED",
  "ARCHIVED",
] as const satisfies readonly ResourceStatus[];

/** States a contributor may still edit. Mirrors `public.resource_is_editable()`. */
export const EDITABLE_RESOURCE_STATUSES = [
  "DRAFT",
  "CHANGES_REQUESTED",
] as const satisfies readonly ResourceStatus[];

export const RESOURCE_STATUS_LABELS: Record<ResourceStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending review",
  CHANGES_REQUESTED: "Changes requested",
  PUBLISHED: "Published",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
};

export const RESOURCE_STATUS_HELP: Record<ResourceStatus, string> = {
  DRAFT: "Only you can see this. Edit it and submit it when it is ready.",
  PENDING_REVIEW: "A Site Admin is reviewing this. Editing is locked until they respond.",
  CHANGES_REQUESTED: "A reviewer asked for changes. Update it and submit again.",
  PUBLISHED:
    "This is public. Create a new version to update files; the live page stays published until a reviewer approves the revision.",
  REJECTED: "A reviewer declined this submission. It stays private.",
  ARCHIVED: "A Site Admin removed this from public browsing. Files are preserved.",
};

export const REVIEW_DECISIONS = [
  "APPROVED",
  "CHANGES_REQUESTED",
  "REJECTED",
] as const satisfies readonly ReviewDecision[];

export const REVIEW_DECISION_LABELS: Record<ReviewDecision, string> = {
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes requested",
  REJECTED: "Rejected",
};

export function isEditableStatus(status: ResourceStatus): boolean {
  return (EDITABLE_RESOURCE_STATUSES as readonly ResourceStatus[]).includes(status);
}

export const RESOURCE_VISIBILITIES = [
  "PUBLIC",
  "UNLISTED",
] as const satisfies readonly ResourceVisibility[];

export const EXPLORE_SORT_OPTIONS = [
  { value: "latest", label: "Newest" },
  { value: "updated", label: "Recently updated" },
  { value: "downloads", label: "Most downloaded" },
] as const;

/** Accepted URL/backend sorts. The toolbar only offers EXPLORE_SORT_OPTIONS. */
export const EXPLORE_SORTS = [
  "latest",
  "updated",
  "relevance",
  "oldest",
  "downloads",
  "rating",
] as const;

export type ExploreSort = (typeof EXPLORE_SORTS)[number];

export const EXPLORE_PAGE_SIZE = 20;

export const DEFAULT_EXPLORE_SORT: ExploreSort = "latest";
