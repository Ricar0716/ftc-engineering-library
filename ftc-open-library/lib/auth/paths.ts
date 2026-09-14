const FALLBACK_PATH = "/";

function looksLikeAbsoluteUrl(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
}

/**
 * Allow only same-origin relative paths. Rejects protocol-relative URLs,
 * backslashes, and encoded tricks that would otherwise open-redirect.
 */
export function safeInternalPath(value: string | null | undefined, fallback = FALLBACK_PATH): string {
  if (!value) {
    return fallback;
  }

  let candidate = value.trim();
  if (!candidate) {
    return fallback;
  }

  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    return fallback;
  }

  candidate = candidate.trim();

  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\")) {
    return fallback;
  }
  if (candidate.includes("\\") || candidate.includes("://")) {
    return fallback;
  }
  if (looksLikeAbsoluteUrl(candidate.slice(1))) {
    return fallback;
  }

  return candidate;
}

export function loginPath(next?: string | null): string {
  const destination = safeInternalPath(next);
  if (destination === "/") {
    return "/login";
  }
  return `/login?next=${encodeURIComponent(destination)}`;
}

const AUTH_PATHS = ["/login", "/signup", "/callback", "/verify", "/forgot-password", "/reset-password"];

export function returnPathAfterAuth(pathname: string, search = ""): string {
  if (AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return "/";
  }
  return safeInternalPath(`${pathname}${search ? `?${search}` : ""}`);
}
