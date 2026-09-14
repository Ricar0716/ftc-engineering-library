"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminCategoriesPath } from "@/lib/admin/category-search";
import { requireSiteAdmin } from "@/lib/auth/session";
import { publicCategoryError } from "@/lib/categories/errors";
import {
  parseCategoryInput,
  parentValidationError,
  siblingSlugConflict,
} from "@/lib/categories/validation";
import { listCategories } from "@/lib/db/catalog";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/utils/logger";
import { isUuid } from "@/lib/utils/id";

export type CategoryActionState = { error: string | null };

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readActive(formData: FormData): boolean {
  const value = formData.get("isActive");
  return value === "on" || value === "true" || value === "1";
}

function revalidateTaxonomy() {
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/explore");
  revalidatePath("/");
  revalidatePath("/resources", "layout");
}

async function requireAdminClient() {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured on this server." as const, admin: null, supabase: null };
  }
  const admin = await requireSiteAdmin();
  if (!admin) {
    return {
      error: "You do not have permission to manage categories." as const,
      admin: null,
      supabase: null,
    };
  }
  return { error: null, admin, supabase: await createClient() };
}

export async function createCategory(
  _prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const gate = await requireAdminClient();
  if (gate.error || !gate.supabase) {
    return { error: gate.error ?? "You do not have permission to manage categories." };
  }

  const parsed = parseCategoryInput({
    name: readString(formData, "name"),
    slug: readString(formData, "slug"),
    description: readString(formData, "description"),
    resourceType: readString(formData, "resourceType"),
    parentId: readString(formData, "parentId"),
    sortOrder: readString(formData, "sortOrder"),
    isActive: readActive(formData),
  });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const categories = await listCategories(parsed.value.resourceType);
  const parentError = parentValidationError(categories, parsed.value);
  if (parentError) {
    return { error: parentError };
  }
  if (siblingSlugConflict(categories, parsed.value)) {
    return { error: "A category with this slug already exists under the selected parent." };
  }

  const { data, error } = await gate.supabase
    .from("categories")
    .insert({
      name: parsed.value.name,
      slug: parsed.value.slug,
      description: parsed.value.description,
      resource_type: parsed.value.resourceType,
      parent_id: parsed.value.parentId,
      sort_order: parsed.value.sortOrder,
      is_active: parsed.value.isActive,
    })
    .select("id")
    .single();

  if (error || !data) {
    logger.warn("admin.categories", "Create failed", { message: error?.message, code: error?.code });
    return { error: publicCategoryError(error) };
  }

  revalidateTaxonomy();
  redirect(
    adminCategoriesPath({
      type: parsed.value.resourceType,
      id: data.id,
      notice: "created",
    }),
  );
}

export async function updateCategory(
  _prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const gate = await requireAdminClient();
  if (gate.error || !gate.supabase) {
    return { error: gate.error ?? "You do not have permission to manage categories." };
  }

  const id = readString(formData, "id");
  if (!isUuid(id)) {
    return { error: "Select a valid category." };
  }

  const existing = (await listCategories()).find((category) => category.id === id);
  if (!existing) {
    return { error: "That category no longer exists." };
  }

  const parsed = parseCategoryInput({
    name: readString(formData, "name"),
    slug: readString(formData, "slug"),
    description: readString(formData, "description"),
    resourceType: existing.resourceType,
    parentId: readString(formData, "parentId"),
    sortOrder: readString(formData, "sortOrder"),
    isActive: readActive(formData),
  });
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const categories = await listCategories(existing.resourceType);
  const parentError = parentValidationError(categories, parsed.value, id);
  if (parentError) {
    return { error: parentError };
  }
  if (siblingSlugConflict(categories, parsed.value, id)) {
    return { error: "A category with this slug already exists under the selected parent." };
  }

  const { error } = await gate.supabase
    .from("categories")
    .update({
      name: parsed.value.name,
      slug: parsed.value.slug,
      description: parsed.value.description,
      parent_id: parsed.value.parentId,
      sort_order: parsed.value.sortOrder,
      is_active: parsed.value.isActive,
    })
    .eq("id", id);

  if (error) {
    logger.warn("admin.categories", "Update failed", { message: error.message, code: error.code });
    return { error: publicCategoryError(error) };
  }

  const moved = existing.parentId !== parsed.value.parentId;
  revalidateTaxonomy();
  redirect(
    adminCategoriesPath({
      type: existing.resourceType,
      id,
      notice: moved ? "moved" : "updated",
    }),
  );
}

export async function setCategoryActive(
  _prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const gate = await requireAdminClient();
  if (gate.error || !gate.supabase) {
    return { error: gate.error ?? "You do not have permission to manage categories." };
  }

  const id = readString(formData, "id");
  const nextActive = readString(formData, "nextActive") === "true";
  if (!isUuid(id)) {
    return { error: "Select a valid category." };
  }

  const existing = (await listCategories()).find((category) => category.id === id);
  if (!existing) {
    return { error: "That category no longer exists." };
  }

  const { error } = await gate.supabase.from("categories").update({ is_active: nextActive }).eq("id", id);
  if (error) {
    logger.warn("admin.categories", "Active toggle failed", { message: error.message, code: error.code });
    return { error: publicCategoryError(error) };
  }

  revalidateTaxonomy();
  redirect(
    adminCategoriesPath({
      type: existing.resourceType,
      id,
      notice: nextActive ? "activated" : "deactivated",
    }),
  );
}

export async function deleteCategory(
  _prev: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const gate = await requireAdminClient();
  if (gate.error || !gate.supabase) {
    return { error: gate.error ?? "You do not have permission to manage categories." };
  }

  const id = readString(formData, "id");
  if (!isUuid(id)) {
    return { error: "Select a valid category." };
  }

  const existing = (await listCategories()).find((category) => category.id === id);
  if (!existing) {
    return { error: "That category no longer exists." };
  }

  const childCount = (await listCategories(existing.resourceType)).filter(
    (category) => category.parentId === id,
  ).length;
  if (childCount > 0) {
    return { error: "This category cannot be deleted because it has child categories." };
  }

  const { data: resourceCount, error: countError } = await gate.supabase.rpc("category_resource_count", {
    p_category_id: id,
  });
  if (countError) {
    logger.warn("admin.categories", "Resource count failed", { message: countError.message });
    return { error: "Unable to check whether Resources still reference this category." };
  }
  if ((resourceCount ?? 0) > 0) {
    return { error: "This category cannot be deleted because Resources reference it." };
  }

  const { error } = await gate.supabase.from("categories").delete().eq("id", id);
  if (error) {
    logger.warn("admin.categories", "Delete failed", { message: error.message, code: error.code });
    return { error: publicCategoryError(error) };
  }

  revalidateTaxonomy();
  redirect(adminCategoriesPath({ type: existing.resourceType, notice: "deleted" }));
}
