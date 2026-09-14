export const primaryNav = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/submit", label: "Contribute" },
  { href: "/about", label: "About" },
  { href: "/teams", label: "Teams" },
] as const;

export function isPrimaryNavActive(
  href: string,
  pathname: string,
  searchParams: Pick<URLSearchParams, "get">,
): boolean {
  const url = new URL(href, "http://local.invalid");

  if (url.pathname === "/") {
    return pathname === "/";
  }

  if (url.pathname === "/explore") {
    if (pathname !== "/explore") {
      return false;
    }

    const hrefType = url.searchParams.get("type");
    const currentType = searchParams.get("type");

    if (!hrefType) {
      return !currentType;
    }

    return hrefType === currentType;
  }

  return pathname === url.pathname || pathname.startsWith(`${url.pathname}/`);
}
