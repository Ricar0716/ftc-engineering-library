import { parseIdentityPage } from "../../identity/paths.ts";
import type { ResourceStatus } from "@/types/resources";

export const ADMIN_RESOURCE_PAGE_SIZE = 20;

export const ADMIN_RESOURCE_FILTERS = [
  "pending",
  "published",
  "rejected",
  "changes",
] as const;

export type AdminResourceFilter = (typeof ADMIN_RESOURCE_FILTERS)[number];

export const ADMIN_RESOURCE_FILTER_LABELS: Record<AdminResourceFilter, string> = {
  pending: "Pending",
  published: "Approved",
  rejected: "Rejected",
  changes: "Changes requested",
};

export const ADMIN_RESOURCE_FILTER_STATUS: Record<AdminResourceFilter, ResourceStatus> = {
  pending: "PENDING_REVIEW",
  published: "PUBLISHED",
  rejected: "REJECTED",
  changes: "CHANGES_REQUESTED",
};

export function parseAdminResourceFilter(
  input: Record<string, string | string[] | undefined>,
): AdminResourceFilter {
  const raw = Array.isArray(input.status) ? input.status[0] : input.status;
  if (raw && (ADMIN_RESOURCE_FILTERS as readonly string[]).includes(raw)) {
    return raw as AdminResourceFilter;
  }
  return "pending";
}

export function parseAdminResourcePage(
  input: Record<string, string | string[] | undefined>,
): number {
  return parseIdentityPage(input);
}

export function adminResourcesPath(
  page: number,
  extra: Record<string, string> = {},
): string {
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
  return query ? `/admin/resources?${query}` : "/admin/resources";
}
