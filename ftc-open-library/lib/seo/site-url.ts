const LOCAL_DEV_ORIGIN = "http://localhost:3000";

function originFromValue(value: string): string | null {
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    if (!url.hostname) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Canonical site origin. Production must set NEXT_PUBLIC_SITE_URL
 * (example: https://example.com). Never assume a specific domain is owned.
 *
 * Preview deploys fall back to https://$VERCEL_URL when SITE_URL is unset.
 * Local development uses http://localhost:3000.
 */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    const origin = originFromValue(configured);
    if (origin) {
      return origin;
    }
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const origin = originFromValue(vercel);
    if (origin) {
      return origin;
    }
  }

  return LOCAL_DEV_ORIGIN;
}

export function canonicalUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") {
    return getSiteUrl();
  }
  return `${getSiteUrl()}${normalized}`;
}

export function absoluteUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, `${getSiteUrl()}/`).toString();
}
