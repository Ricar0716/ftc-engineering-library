export const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CATEGORY_NAME_MAX = 80;
export const CATEGORY_SLUG_MAX = 80;
export const CATEGORY_DESCRIPTION_MAX = 500;
export const CATEGORY_SORT_MIN = -1_000_000;
export const CATEGORY_SORT_MAX = 1_000_000;

export function suggestCategorySlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, CATEGORY_SLUG_MAX);
}

export function isValidCategorySlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= CATEGORY_SLUG_MAX && CATEGORY_SLUG_PATTERN.test(slug);
}
