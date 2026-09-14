import { asRelationList, getConfiguredServerClient } from "@/lib/db/client";
import { logger } from "@/lib/utils/logger";
import type { Category } from "@/types/categories";
import type { TableRow } from "@/types/database";
import type { ResourceType } from "@/types/resources";

const FILTER_ERROR = "Something went wrong while loading filters.";

export type TagOption = Pick<TableRow<"tags">, "id" | "name" | "slug">;
export type SeasonOption = Pick<TableRow<"seasons">, "id" | "label" | "start_year" | "end_year">;

const CATEGORY_COLUMNS =
  "id, name, slug, resource_type, parent_id, description, sort_order, is_active";

function mapCategory(row: {
  id: string;
  name: string;
  slug: string;
  resource_type: ResourceType;
  parent_id: string | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    resourceType: row.resource_type,
    parentId: row.parent_id,
    description: row.description,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

export async function listCategories(
  resourceType?: ResourceType | null,
  options?: { activeOnly?: boolean },
): Promise<Category[]> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return [];
  }

  let request = supabase.from("categories").select(CATEGORY_COLUMNS);

  if (resourceType) {
    request = request.eq("resource_type", resourceType);
  }
  if (options?.activeOnly) {
    request = request.eq("is_active", true);
  }

  const { data, error } = await request;
  if (error) {
    logger.error("db.catalog", "Failed to list categories", {
      message: error.message,
      code: error.code,
    });
    throw new Error(FILTER_ERROR);
  }

  return (data ?? []).map(mapCategory);
}

export async function countCategoryResources(categoryId: string): Promise<number | null> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return 0;
  }

  const { data, error } = await supabase.rpc("category_resource_count", {
    p_category_id: categoryId,
  });

  if (error) {
    logger.error("db.catalog", "Failed to count category resources", {
      message: error.message,
      code: error.code,
    });
    return null;
  }

  return data ?? 0;
}

export async function listTags(): Promise<TagOption[]> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("tags")
    .select("id, name, slug")
    .order("name", { ascending: true });

  if (error) {
    logger.error("db.catalog", "Failed to list tags", {
      message: error.message,
      code: error.code,
    });
    throw new Error(FILTER_ERROR);
  }

  return data ?? [];
}

export async function listSeasons(): Promise<SeasonOption[]> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("seasons")
    .select("id, label, start_year, end_year")
    .order("start_year", { ascending: false });

  if (error) {
    logger.error("db.catalog", "Failed to list seasons", {
      message: error.message,
      code: error.code,
    });
    throw new Error(FILTER_ERROR);
  }

  return data ?? [];
}

export async function resolveCategoryId(id: string): Promise<string | null> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logger.error("db.catalog", "Failed to resolve category", {
      message: error.message,
      code: error.code,
    });
    throw new Error(FILTER_ERROR);
  }

  return data?.id ?? null;
}

export async function resolveTagId(slug: string): Promise<string | null> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.from("tags").select("id").eq("slug", slug).maybeSingle();

  if (error) {
    logger.error("db.catalog", "Failed to resolve tag", {
      message: error.message,
      code: error.code,
    });
    throw new Error(FILTER_ERROR);
  }

  return data?.id ?? null;
}

export async function resolveSeasonId(label: string): Promise<string | null> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("seasons")
    .select("id")
    .eq("label", label)
    .maybeSingle();

  if (error) {
    logger.error("db.catalog", "Failed to resolve season", {
      message: error.message,
      code: error.code,
    });
    throw new Error(FILTER_ERROR);
  }

  return data?.id ?? null;
}

export async function resourceIdsForTag(tagId: string): Promise<string[]> {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("resource_tags")
    .select("resource_id")
    .eq("tag_id", tagId);

  if (error) {
    logger.error("db.catalog", "Failed to list resources for tag", {
      message: error.message,
      code: error.code,
    });
    throw new Error(FILTER_ERROR);
  }

  return (data ?? []).map((row) => row.resource_id);
}

export async function listHardware() {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("hardware")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    logger.error("db.catalog", "Failed to list hardware", {
      message: error.message,
      code: error.code,
    });
    throw new Error(FILTER_ERROR);
  }

  return asRelationList(data);
}

export async function listLicenses() {
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("licenses")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    logger.error("db.catalog", "Failed to list licenses", {
      message: error.message,
      code: error.code,
    });
    throw new Error(FILTER_ERROR);
  }

  return data ?? [];
}
