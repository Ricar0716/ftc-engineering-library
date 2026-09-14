import { RESOURCE_TYPES } from "../constants/resources.ts";
import { findCategoryById, getCategoryDescendants } from "./tree.ts";
import {
  CATEGORY_DESCRIPTION_MAX,
  CATEGORY_NAME_MAX,
  CATEGORY_SORT_MAX,
  CATEGORY_SORT_MIN,
  isValidCategorySlug,
} from "./slug.ts";
import { isUuid } from "../utils/id.ts";
import type { Category } from "@/types/categories";
import type { ResourceType } from "@/types/resources";

export type CategoryInput = {
  name: string;
  slug: string;
  description: string | null;
  resourceType: ResourceType;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
};

function isResourceType(value: string): value is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(value);
}

export function parseOptionalParentId(value: string | null | undefined): string | null | { error: string } {
  const raw = value?.trim() ?? "";
  if (!raw || raw === "none") {
    return null;
  }
  if (!isUuid(raw)) {
    return { error: "Select a valid parent category." };
  }
  return raw;
}

export function parseSortOrder(value: string | null | undefined): number | { error: string } {
  const raw = (value ?? "").trim();
  if (!raw) {
    return 0;
  }
  if (!/^-?\d+$/.test(raw)) {
    return { error: "Sort order must be a whole number." };
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < CATEGORY_SORT_MIN || parsed > CATEGORY_SORT_MAX) {
    return { error: "Sort order is out of range." };
  }
  return parsed;
}

export function parseCategoryInput(input: {
  name: string;
  slug: string;
  description?: string;
  resourceType: string;
  parentId?: string | null;
  sortOrder?: string;
  isActive?: boolean;
}): { ok: true; value: CategoryInput } | { ok: false; error: string } {
  const name = input.name.trim();
  if (!name) {
    return { ok: false, error: "Name is required." };
  }
  if (name.length > CATEGORY_NAME_MAX) {
    return { ok: false, error: `Name must be ${CATEGORY_NAME_MAX} characters or fewer.` };
  }

  const slug = input.slug.trim().toLowerCase();
  if (!slug) {
    return { ok: false, error: "Slug is required." };
  }
  if (!isValidCategorySlug(slug)) {
    return {
      ok: false,
      error: "Slug must be lowercase letters, numbers, and hyphens (e.g. dual-flywheel).",
    };
  }

  const descriptionRaw = input.description?.trim() ?? "";
  if (descriptionRaw.length > CATEGORY_DESCRIPTION_MAX) {
    return {
      ok: false,
      error: `Description must be ${CATEGORY_DESCRIPTION_MAX} characters or fewer.`,
    };
  }

  if (!isResourceType(input.resourceType)) {
    return { ok: false, error: "Select a valid Resource Type." };
  }

  const parentId = parseOptionalParentId(input.parentId);
  if (parentId && typeof parentId === "object") {
    return { ok: false, error: parentId.error };
  }

  const sortOrder = parseSortOrder(input.sortOrder);
  if (typeof sortOrder === "object") {
    return { ok: false, error: sortOrder.error };
  }

  return {
    ok: true,
    value: {
      name,
      slug,
      description: descriptionRaw ? descriptionRaw : null,
      resourceType: input.resourceType,
      parentId,
      sortOrder,
      isActive: Boolean(input.isActive),
    },
  };
}

export function siblingSlugConflict(
  categories: readonly Category[],
  input: Pick<CategoryInput, "slug" | "resourceType" | "parentId">,
  excludeId?: string,
): boolean {
  return categories.some(
    (category) =>
      category.id !== excludeId &&
      category.resourceType === input.resourceType &&
      category.parentId === input.parentId &&
      category.slug === input.slug,
  );
}

export function parentValidationError(
  categories: readonly Category[],
  input: Pick<CategoryInput, "resourceType" | "parentId">,
  movingId?: string,
): string | null {
  if (!input.parentId) {
    return null;
  }

  if (movingId && input.parentId === movingId) {
    return "A category cannot be its own parent.";
  }

  const parent = findCategoryById(categories, input.parentId);
  if (!parent) {
    return "The parent category does not exist.";
  }

  if (parent.resourceType !== input.resourceType) {
    return "The parent category belongs to a different Resource Type.";
  }

  if (movingId) {
    const blocked = getCategoryDescendants(categories, movingId, { includeSelf: false });
    if (blocked.includes(input.parentId)) {
      return "This move would create a category cycle.";
    }
  }

  return null;
}

export function parentOptions(
  categories: readonly Category[],
  resourceType: ResourceType,
  movingId?: string,
): Category[] {
  const blocked = movingId
    ? new Set(getCategoryDescendants(categories, movingId, { includeSelf: true }))
    : new Set<string>();

  return categories.filter(
    (category) => category.resourceType === resourceType && !blocked.has(category.id),
  );
}
