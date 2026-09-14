export const adminNav = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/resources", label: "Resources", exact: false },
  { href: "/admin/versions", label: "Versions", exact: false },
  { href: "/admin/categories", label: "Categories", exact: false },
] as const;

export const adminNavLater = [
  "Users",
  "Discussions",
  "Settings",
] as const;

export function isAdminNavActive(href: string, pathname: string, exact: boolean): boolean {
  if (exact) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
