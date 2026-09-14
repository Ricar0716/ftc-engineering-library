import { SearchBar } from "@/components/search/search-bar";
import { SortSelector } from "@/components/search/sort-selector";
import { DEFAULT_EXPLORE_SORT } from "@/lib/constants/resources";
import type { ExploreSearchParams } from "@/lib/search/params";
import { cn } from "@/lib/utils/cn";

export function ExploreToolbar({
  filters,
  className,
}: {
  filters: ExploreSearchParams;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end", className)}>
      <SearchBar
        id="explore-resource-search"
        defaultValue={filters.q}
        className="min-w-0 flex-1"
        hiddenFields={{
          type: filters.type,
          category: filters.category,
          tag: filters.tag,
          season: filters.season,
          sort: filters.sort !== DEFAULT_EXPLORE_SORT ? filters.sort : null,
        }}
      />
      <SortSelector filters={filters} className="w-full sm:w-56" />
    </div>
  );
}
