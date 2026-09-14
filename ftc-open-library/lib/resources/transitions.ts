import type { ResourceStatus, ReviewDecision } from "@/types/resources";

/**
 * Mirror of the state machine enforced by
 * `public.resources_enforce_status_transition()`.
 *
 * The database is authoritative. This copy exists so the UI can hide actions a
 * user cannot perform, and so the rules are unit-testable without a live
 * Postgres instance. Keep both in sync.
 */
export type Actor = "contributor" | "admin";

const CONTRIBUTOR_TRANSITIONS: Record<ResourceStatus, readonly ResourceStatus[]> = {
  DRAFT: ["PENDING_REVIEW"],
  CHANGES_REQUESTED: ["PENDING_REVIEW"],
  PENDING_REVIEW: ["DRAFT"],
  PUBLISHED: [],
  REJECTED: [],
  ARCHIVED: [],
};

const ADMIN_TRANSITIONS: Record<ResourceStatus, readonly ResourceStatus[]> = {
  DRAFT: ["PENDING_REVIEW"],
  CHANGES_REQUESTED: ["PENDING_REVIEW"],
  PENDING_REVIEW: ["PUBLISHED", "CHANGES_REQUESTED", "REJECTED", "DRAFT"],
  PUBLISHED: ["ARCHIVED"],
  REJECTED: [],
  ARCHIVED: ["PUBLISHED"],
};

export function allowedTransitions(actor: Actor, from: ResourceStatus): readonly ResourceStatus[] {
  return actor === "admin" ? ADMIN_TRANSITIONS[from] : CONTRIBUTOR_TRANSITIONS[from];
}

export function canTransition(actor: Actor, from: ResourceStatus, to: ResourceStatus): boolean {
  return allowedTransitions(actor, from).includes(to);
}

/** States whose metadata, child rows, and Storage objects a contributor may change. */
export function contributorCanEdit(status: ResourceStatus): boolean {
  return status === "DRAFT" || status === "CHANGES_REQUESTED";
}

export function contributorCanDelete(status: ResourceStatus): boolean {
  return contributorCanEdit(status);
}

export function contributorCanSubmit(status: ResourceStatus): boolean {
  return canTransition("contributor", status, "PENDING_REVIEW");
}

export function contributorCanWithdraw(status: ResourceStatus): boolean {
  return status === "PENDING_REVIEW";
}

/** Whether normal public browsing may surface the resource. */
export function isPubliclyVisible(status: ResourceStatus): boolean {
  return status === "PUBLISHED";
}

export function statusAfterDecision(decision: ReviewDecision): ResourceStatus {
  switch (decision) {
    case "APPROVED":
      return "PUBLISHED";
    case "CHANGES_REQUESTED":
      return "CHANGES_REQUESTED";
    case "REJECTED":
      return "REJECTED";
  }
}

export function decisionRequiresMessage(decision: ReviewDecision): boolean {
  return decision !== "APPROVED";
}
