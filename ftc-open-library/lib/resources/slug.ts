/**
 * Resource slugs.
 *
 * Slugs are only used for public URLs. Private submission routes address
 * resources by UUID, so a draft slug can change while the title is still being
 * worked on. `resources_slug_unique` is the final authority; callers pass a
 * taken-slug probe so a duplicate title never produces a broken public URL.
 */
export const RESOURCE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const RESOURCE_SLUG_MAX = 80;

const MAX_NUMERIC_ATTEMPTS = 50;

export function suggestResourceSlug(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, RESOURCE_SLUG_MAX)
    .replace(/-+$/, "");

  return base;
}

export function isValidResourceSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= RESOURCE_SLUG_MAX && RESOURCE_SLUG_PATTERN.test(slug);
}

function withSuffix(base: string, suffix: string): string {
  const room = RESOURCE_SLUG_MAX - suffix.length - 1;
  const trimmed = base.slice(0, Math.max(1, room)).replace(/-+$/, "");
  return `${trimmed}-${suffix}`;
}

/**
 * Finds the first free slug for `title`. `isTaken` is awaited per candidate, so
 * the caller decides how to probe (usually a `resources` lookup). The database
 * unique constraint still guards against a race.
 */
export async function uniqueResourceSlug(
  title: string,
  isTaken: (candidate: string) => Promise<boolean>,
  randomSuffix: () => string = defaultRandomSuffix,
): Promise<string> {
  const base = suggestResourceSlug(title) || "resource";

  if (!(await isTaken(base))) {
    return base;
  }

  for (let attempt = 2; attempt <= MAX_NUMERIC_ATTEMPTS; attempt += 1) {
    const candidate = withSuffix(base, String(attempt));
    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }

  return withSuffix(base, randomSuffix());
}

function defaultRandomSuffix(): string {
  return Math.random().toString(36).slice(2, 8).replace(/[^a-z0-9]/g, "0");
}
