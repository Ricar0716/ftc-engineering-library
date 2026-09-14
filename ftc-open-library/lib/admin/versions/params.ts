import { parseIdentityPage } from "../../identity/paths.ts";
import type { ResourceVersionStatus } from "@/types/resources";

export const ADMIN_VERSION_PAGE_SIZE = 20;

export const ADMIN_VERSION_FILTERS = [
  "pending",
  "published",
  "rejected",
  "changes",
] as const;

export type AdminVersionFilter = (typeof ADMIN_VERSION_FILTERS)[number];

export const ADMIN_VERSION_FILTER_LABELS: Record<AdminVersionFilter, string> = {
  pending: "Pending",
  published: "Published",
  rejected: "Rejected",
  changes: "Changes requested",
};

/** Queue status on `resource_versions`. Reject maps to ARCHIVED; changes return to DRAFT. */
export const ADMIN_VERSION_FILTER_STATUS: Record<AdminVersionFilter, ResourceVersionStatus> = {
  pending: "PENDING_REVIEW",
  published: "PUBLISHED",
  rejected: "ARCHIVED",
  changes: "DRAFT",
};

export function parseAdminVersionFilter(
  input: Record<string, string | string[] | undefined>,
): AdminVersionFilter {
  const raw = Array.isArray(input.status) ? input.status[0] : input.status;
  if (raw && (ADMIN_VERSION_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminVersionFilter;
  }
  return "pending";
}

export function parseAdminVersionPage(
  input: Record<string, string | string[] | undefined>,
): number {
  return parseIdentityPage(input);
}

export function adminVersionsPath(page: number, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(extra)) {
    if (value) {
      params.set(key, value);
    }
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `/admin/versions?${query}` : "/admin/versions";
}

export function changelogSummary(value: string | null | undefined, max = 140): string | null {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) {
    return null;
  }
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function adminVersionStatusLabel(status: ResourceVersionStatus): string {
  switch (status) {
    case "PENDING_REVIEW":
      return "Pending review";
    case "PUBLISHED":
      return "Published";
    case "ARCHIVED":
      return "Rejected";
    case "DRAFT":
      return "Changes requested";
  }
}
