import { getConfiguredServerClient } from "@/lib/db/client";
import { listCategories, resourceIdsForTag } from "@/lib/db/catalog";
import { getCategoryDescendants } from "@/lib/categories/tree";
import { ilikeContainsPattern, uniqueIds } from "@/lib/search/query";
import { logger } from "@/lib/utils/logger";

const EXPAND_TERM_LIMIT = 20;
const EXPAND_ID_CAP = 200;

/**
 * Extra published-resource ids whose tags, category names, authors, or teams
 * match the keyword. Callers still AND `status = PUBLISHED`.
 */
export async function expandSearchResourceIds(rawQuery: string): Promise<string[]> {
  const pattern = ilikeContainsPattern(rawQuery);
  if (!pattern) {
    return [];
  }

  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return [];
  }

  const [tagName, tagSlug, categories, usernames, displayNames, teamNames, teamNumbers] =
    await Promise.all([
      supabase.from("tags").select("id").ilike("name", pattern).limit(EXPAND_TERM_LIMIT),
      supabase.from("tags").select("id").ilike("slug", pattern).limit(EXPAND_TERM_LIMIT),
      supabase.from("categories").select("id").ilike("name", pattern).limit(EXPAND_TERM_LIMIT),
      supabase.from("profiles").select("id").ilike("username", pattern).limit(EXPAND_TERM_LIMIT),
      supabase.from("profiles").select("id").ilike("display_name", pattern).limit(EXPAND_TERM_LIMIT),
      supabase.from("teams").select("id").ilike("name", pattern).limit(EXPAND_TERM_LIMIT),
      supabase.from("teams").select("id").ilike("team_number", pattern).limit(EXPAND_TERM_LIMIT),
    ]);

  for (const result of [
    tagName,
    tagSlug,
    categories,
    usernames,
    displayNames,
    teamNames,
    teamNumbers,
  ]) {
    if (result.error) {
      logger.error("db.search", "Failed to expand search keyword", {
        message: result.error.message,
        code: result.error.code,
      });
    }
  }

  const tagIds = uniqueIds([
    ...(tagName.data ?? []).map((row) => row.id),
    ...(tagSlug.data ?? []).map((row) => row.id),
  ]);
  const matchedCategoryIds = (categories.data ?? []).map((row) => row.id);
  const authorIds = uniqueIds([
    ...(usernames.data ?? []).map((row) => row.id),
    ...(displayNames.data ?? []).map((row) => row.id),
  ]);
  const teamIds = uniqueIds([
    ...(teamNames.data ?? []).map((row) => row.id),
    ...(teamNumbers.data ?? []).map((row) => row.id),
  ]);

  const categoryIds = new Set<string>(matchedCategoryIds);
  if (matchedCategoryIds.length > 0) {
    const taxonomy = await listCategories();
    for (const id of matchedCategoryIds) {
      for (const descendant of getCategoryDescendants(taxonomy, id)) {
        categoryIds.add(descendant);
      }
    }
  }

  const extra: string[] = [];
  const lookups: Promise<void>[] = [];

  if (tagIds.length > 0) {
    const tagged = uniqueIds((await Promise.all(tagIds.map((id) => resourceIdsForTag(id)))).flat());
    if (tagged.length > 0) {
      lookups.push(
        (async () => {
          const { data, error } = await supabase
            .from("resources")
            .select("id")
            .eq("status", "PUBLISHED")
            .eq("visibility", "PUBLIC")
            .in("id", tagged.slice(0, EXPAND_ID_CAP))
            .limit(EXPAND_ID_CAP);
          if (error) {
            logger.error("db.search", "Failed to expand tag search", {
              message: error.message,
              code: error.code,
            });
            return;
          }
          extra.push(...(data ?? []).map((row) => row.id));
        })(),
      );
    }
  }

  if (categoryIds.size > 0) {
    lookups.push(
      (async () => {
        const { data, error } = await supabase
          .from("resources")
          .select("id")
          .eq("status", "PUBLISHED")
          .eq("visibility", "PUBLIC")
          .in("category_id", [...categoryIds])
          .limit(EXPAND_ID_CAP);
        if (error) {
          logger.error("db.search", "Failed to expand category search", {
            message: error.message,
            code: error.code,
          });
          return;
        }
        extra.push(...(data ?? []).map((row) => row.id));
      })(),
    );
  }

  if (authorIds.length > 0) {
    lookups.push(
      (async () => {
        const { data, error } = await supabase
          .from("resources")
          .select("id")
          .eq("status", "PUBLISHED")
          .eq("visibility", "PUBLIC")
          .in("author_id", authorIds)
          .limit(EXPAND_ID_CAP);
        if (error) {
          logger.error("db.search", "Failed to expand author search", {
            message: error.message,
            code: error.code,
          });
          return;
        }
        extra.push(...(data ?? []).map((row) => row.id));
      })(),
    );
  }

  if (teamIds.length > 0) {
    lookups.push(
      (async () => {
        const { data, error } = await supabase
          .from("resources")
          .select("id")
          .eq("status", "PUBLISHED")
          .eq("visibility", "PUBLIC")
          .in("team_id", teamIds)
          .limit(EXPAND_ID_CAP);
        if (error) {
          logger.error("db.search", "Failed to expand team search", {
            message: error.message,
            code: error.code,
          });
          return;
        }
        extra.push(...(data ?? []).map((row) => row.id));
      })(),
    );
  }

  await Promise.all(lookups);
  return uniqueIds(extra).slice(0, EXPAND_ID_CAP);
}
