import { RESOURCE_TYPES } from "../constants/resources.ts";
import { isUuid } from "../utils/id.ts";
import type { ResourceType } from "@/types/resources";

export const CATEGORY_NOTICES = {
  created: "Category created.",
  updated: "Category updated.",
  moved: "Category moved.",
  deactivated: "Category deactivated.",
  activated: "Category reactivated.",
  deleted: "Category deleted.",
} as const;

export type CategoryNotice = keyof typeof CATEGORY_NOTICES;

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function isResourceType(value: string): value is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(value);
}

function isNotice(value: string): value is CategoryNotice {
  return value in CATEGORY_NOTICES;
}

export type AdminCategorySearch = {
  resourceType: ResourceType;
  selectedId: string | null;
  parentId: string | null;
  mode: "edit" | "create";
  notice: CategoryNotice | null;
};

export function parseAdminCategorySearch(
  input: Record<string, string | string[] | undefined>,
): AdminCategorySearch {
  const typeValue = first(input.type);
  const idValue = first(input.id)?.trim() ?? null;
  const parentValue = first(input.parent)?.trim() ?? null;
  const modeValue = first(input.mode);
  const noticeValue = first(input.notice);

  return {
    resourceType: typeValue && isResourceType(typeValue) ? typeValue : "CAD",
    selectedId: idValue && isUuid(idValue) ? idValue : null,
    parentId: parentValue && isUuid(parentValue) ? parentValue : null,
    mode: modeValue === "create" ? "create" : "edit",
    notice: noticeValue && isNotice(noticeValue) ? noticeValue : null,
  };
}

export function adminCategoriesPath(input: {
  type: ResourceType;
  id?: string | null;
  parent?: string | null;
  mode?: "edit" | "create";
  notice?: CategoryNotice | null;
}): string {
  const params = new URLSearchParams();
  params.set("type", input.type);
  if (input.mode === "create") {
    params.set("mode", "create");
  }
  if (input.id) {
    params.set("id", input.id);
  }
  if (input.parent) {
    params.set("parent", input.parent);
  }
  if (input.notice) {
    params.set("notice", input.notice);
  }
  return `/admin/categories?${params.toString()}`;
}
