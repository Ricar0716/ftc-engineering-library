const FALLBACK = "Unable to save that category. Try again.";

const MATCHERS: { pattern: RegExp; message: string }[] = [
  {
    pattern: /duplicate key|unique constraint|categories_root_slug_unique|categories_sibling_slug_unique/i,
    message: "A category with this slug already exists under the selected parent.",
  },
  {
    pattern: /categories_slug_format|slug_format/i,
    message: "Slug must be lowercase letters, numbers, and hyphens (e.g. dual-flywheel).",
  },
  {
    pattern: /cannot be its own parent/i,
    message: "A category cannot be its own parent.",
  },
  {
    pattern: /parent would create a cycle/i,
    message: "This move would create a category cycle.",
  },
  {
    pattern: /resource_type must match parent/i,
    message: "The parent category belongs to a different Resource Type.",
  },
  {
    pattern: /parent category does not exist/i,
    message: "The parent category does not exist.",
  },
  {
    pattern: /resource_type cannot be changed/i,
    message: "Resource Type cannot be changed after a category is created.",
  },
  {
    pattern: /has child categories/i,
    message: "This category cannot be deleted because it has child categories.",
  },
  {
    pattern: /referenced by resources/i,
    message: "This category cannot be deleted because Resources reference it.",
  },
  {
    pattern: /row-level security|permission denied|42501/i,
    message: "You do not have permission to manage categories.",
  },
];

export function publicCategoryError(error: { message?: string; code?: string } | string | null | undefined): string {
  const raw = typeof error === "string" ? error : [error?.code, error?.message].filter(Boolean).join(" ");
  if (!raw) {
    return FALLBACK;
  }
  for (const matcher of MATCHERS) {
    if (matcher.pattern.test(raw)) {
      return matcher.message;
    }
  }
  return FALLBACK;
}
