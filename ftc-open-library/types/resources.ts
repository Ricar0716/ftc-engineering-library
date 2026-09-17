export type ResourceType = "CAD" | "CODE" | "TUTORIAL" | "MODEL";

export type ResourceStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "CHANGES_REQUESTED"
  | "PUBLISHED"
  | "REJECTED"
  | "ARCHIVED";

export type ResourceVersionStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "ARCHIVED";

export type ReviewDecision = "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";

export type ResourceVisibility = "PUBLIC" | "UNLISTED";

export type ResourceRelationType = "RELATED" | "USES" | "BASED_ON";

export type ResourceFileCategory = "CAD" | "SOURCE" | "DOCUMENT" | "VIDEO_LINK" | "VIDEO" | "IMAGE" | "OTHER";

export type ResourceAuthor = {
  username: string;
  displayName: string;
};

export type ResourceTag = {
  name: string;
  slug: string;
};

/**
 * UI-facing resource summary. Mapped from database rows in `lib/db`.
 */
export type ResourceSummary = {
  id: string;
  title: string;
  slug: string;
  resourceType: ResourceType;
  description: string;
  author?: ResourceAuthor | null;
  teamName?: string | null;
  teamSlug?: string | null;
  seasonLabel?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  tags?: ResourceTag[];
  updatedAt?: string | null;
  publishedAt?: string | null;
  ratingAverage?: number | null;
  ratingCount?: number | null;
  downloadCount?: number | null;
  favoriteCount?: number | null;
  thumbnailUrl?: string | null;
};

export type ResourceVersionSummary = {
  id: string;
  versionNumber: number;
  versionLabel: string | null;
  changelog: string | null;
  status: ResourceVersionStatus;
  releasedAt: string | null;
  createdAt: string;
  submittedAt?: string | null;
  createdByUsername?: string | null;
  createdByDisplayName?: string | null;
};

export type ResourceFileSummary = {
  id: string;
  versionId: string;
  filename: string;
  fileType: ResourceFileCategory | null;
  mimeType: string | null;
  sizeBytes: number | null;
};

export type ResourceLicense = {
  name: string;
  url: string | null;
  spdxId: string | null;
};

export type ResourceHardware = {
  name: string;
  slug: string;
};

export type ResourceReviewEntry = {
  id: string;
  versionId: string | null;
  decision: ReviewDecision;
  message: string | null;
  createdAt: string;
  reviewerName: string | null;
};

/** A resource as seen by its contributor or a reviewer, including private states. */
export type SubmissionSummary = {
  id: string;
  title: string;
  slug: string;
  resourceType: ResourceType;
  status: ResourceStatus;
  categoryName: string | null;
  updatedAt: string;
  submittedAt: string | null;
  publishedAt: string | null;
  fileCount: number;
  latestReview: ResourceReviewEntry | null;
};

export type SubmissionFile = ResourceFileSummary & {
  storagePath: string;
  storageBucket: "resource-files" | "tutorial-videos";
  createdAt: string;
};

export type SubmissionDetail = {
  id: string;
  title: string;
  slug: string;
  resourceType: ResourceType;
  description: string;
  status: ResourceStatus;
  visibility: ResourceVisibility;
  categoryId: string | null;
  categoryBreadcrumb: { id: string; name: string }[];
  seasonId: string | null;
  licenseId: string | null;
  licenseName: string | null;
  teamId: string | null;
  teamName: string | null;
  teamNumber: string | null;
  authorId: string | null;
  authorUsername: string | null;
  authorDisplayName: string | null;
  tagIds: string[];
  versionId: string | null;
  versions: ResourceVersionSummary[];
  files: SubmissionFile[];
  reviews: ResourceReviewEntry[];
  rightsAcknowledgedAt: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
};

export type ResourceDetail = ResourceSummary & {
  authorId: string | null;
  teamId: string | null;
  authorUsername: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  authorBio: string | null;
  categorySlug: string | null;
  categoryBreadcrumb: { id: string; name: string }[];
  license: ResourceLicense | null;
  hardware: ResourceHardware[];
  versions: ResourceVersionSummary[];
  files: ResourceFileSummary[];
  related: ResourceSummary[];
  authorPublishedCount: number | null;
};
