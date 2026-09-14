import { isDiscussionEnabled } from "../config/features.ts";

export const DASHBOARD_PAGE_SIZE = 20;

export const dashboardNav = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/resources", label: "My Resources", exact: true },
  { href: "/dashboard/drafts", label: "Drafts", exact: true },
  { href: "/dashboard/reviews", label: "Reviews", exact: true },
  { href: "/dashboard/versions", label: "Versions", exact: true },
  { href: "/dashboard/favorites", label: "Saved Resources", exact: true },
  { href: "/dashboard/discussions", label: "Discussions", exact: true },
  { href: "/dashboard/profile", label: "Profile", exact: true },
  { href: "/dashboard/team", label: "Team", exact: true },
] as const;

export function visibleDashboardNav() {
  if (isDiscussionEnabled()) {
    return dashboardNav;
  }
  return dashboardNav.filter((item) => item.href !== "/dashboard/discussions");
}

export function isDashboardNavActive(href: string, pathname: string, exact: boolean): boolean {
  if (exact) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function dashboardPagePath(
  pathname: string,
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
  return query ? `${pathname}?${query}` : pathname;
}
