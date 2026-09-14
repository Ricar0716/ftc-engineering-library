import { FilterPanel } from "@/components/search/filter-panel";
import type { SeasonOption, TagOption } from "@/lib/db/catalog";
import type { ExploreSearchParams } from "@/lib/search/params";
import type { CategoryTreeNode } from "@/types/categories";

export function ResourceFilters({
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
    <nav aria-label="Filters" className="min-w-0">
      <h2 className="mb-4 hidden text-sm font-medium text-ink lg:block">Filters</h2>
      <FilterPanel filters={filters} categoryTree={categoryTree} tags={tags} seasons={seasons} />
    </nav>
  );
}
