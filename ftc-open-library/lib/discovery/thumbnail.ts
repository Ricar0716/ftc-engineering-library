/**
 * Card images must never point at private Storage. Homepage and Explore only
 * show a public path or a type placeholder — never a signed URL or bucket host.
 */
export function publicCardImageUrl(thumbnailUrl: string | null | undefined): string | null {
  if (!thumbnailUrl) {
    return null;
  }

  const value = thumbnailUrl.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  if (value.includes("\\") || value.includes("://")) {
    return null;
  }
  if (value.includes("storage") || value.includes("resource-files") || value.includes("tutorial-videos")) {
    return null;
  }
  if (value.includes("?")) {
    return null;
  }

  return value;
}
