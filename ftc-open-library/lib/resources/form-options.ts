import "server-only";

import { categoryPathOptions, type CategoryOption } from "@/lib/categories/options";
import { RESOURCE_TYPES } from "@/lib/constants/resources";
import { listCategories, listLicenses, listSeasons, listTags } from "@/lib/db/catalog";
import { listManageableTeams } from "@/lib/db/teams";
import type { ResourceFormOptions } from "@/components/resources/resource-form";
import type { ResourceType } from "@/types/resources";

/**
 * Everything the contributor form needs, read from the database. Categories,
 * licenses, seasons, and tags are never hardcoded, and any of them may be empty.
 */
export async function loadResourceFormOptions(userId: string): Promise<ResourceFormOptions> {
  const [categories, licenses, seasons, tags, teams] = await Promise.all([
    listCategories(null, { activeOnly: true }),
    listLicenses(),
    listSeasons(),
    listTags(),
    listManageableTeams(userId),
  ]);

  const categoriesByType = Object.fromEntries(
    RESOURCE_TYPES.map((type) => [
      type,
      categoryPathOptions(
        categories.filter((category) => category.resourceType === type),
        { activeOnly: true },
      ),
    ]),
  ) as Record<ResourceType, CategoryOption[]>;

  return {
    categoriesByType,
    licenses: licenses.map((license) => ({ id: license.id, name: license.name })),
    seasons: seasons.map((season) => ({ id: season.id, label: season.label })),
    tags: tags.map((tag) => ({ id: tag.id, name: tag.name })),
    teams,
  };
}
