import { Button, ButtonLink } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { CategoryTree } from "@/components/search/category-tree";
import { DEFAULT_EXPLORE_SORT, RESOURCE_TYPE_LABELS, RESOURCE_TYPES } from "@/lib/constants/resources";
import type { SeasonOption, TagOption } from "@/lib/db/catalog";
import { buildExplorePath, type ExploreSearchParams } from "@/lib/search/params";
import type { CategoryTreeNode } from "@/types/categories";

export function FilterPanel({
  filters,
  categoryTree,
  tags,
  seasons,
}: {
  filters: ExploreSearchParams;
  categoryTree: readonly CategoryTreeNode[];
  tags: TagOption[];
  seasons: SeasonOption[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <form method="get" className="flex flex-col gap-4">
        {filters.q ? <input type="hidden" name="q" value={filters.q} /> : null}
        {filters.category ? <input type="hidden" name="category" value={filters.category} /> : null}
        {filters.sort && filters.sort !== DEFAULT_EXPLORE_SORT ? (
          <input type="hidden" name="sort" value={filters.sort} />
        ) : null}

        <Select label="Resource type" name="type" defaultValue={filters.type ?? ""}>
          <option value="">All types</option>
          {RESOURCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {RESOURCE_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>

        <Select label="Season" name="season" defaultValue={filters.season ?? ""}>
          <option value="">All seasons</option>
          {seasons.map((season) => (
            <option key={season.id} value={season.label}>
              {season.label}
            </option>
          ))}
        </Select>

        <Select label="Tag" name="tag" defaultValue={filters.tag ?? ""}>
          <option value="">All tags</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.slug}>
              {tag.name}
            </option>
          ))}
        </Select>

        <Button type="submit" className="w-full">
          Apply filters
        </Button>
        <ButtonLink href={buildExplorePath({})} variant="secondary" className="w-full">
          Clear all
        </ButtonLink>
      </form>

      {filters.type ? (
        <CategoryTree resourceType={filters.type} nodes={categoryTree} filters={filters} />
      ) : (
        <p className="text-sm text-ink-muted">Select a resource type to browse categories.</p>
      )}
    </div>
  );
}
