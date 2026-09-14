import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { ActiveFilters } from "@/components/search/active-filters";
import { Pagination } from "@/components/search/pagination";
import { ExploreToolbar } from "@/components/discovery/explore-toolbar";
import { ResourceGrid } from "@/components/resources/resource-grid";
import type { PublishedResourceList } from "@/lib/db/resources";
import { exploreEmptyCopy } from "@/lib/discovery/empty";
import { formatResultCount } from "@/lib/search/query";
import { buildExplorePath, hasActiveExploreFilters, type ExploreSearchParams } from "@/lib/search/params";

export function SearchResults({
  filters,
  list,
  categoryLabel,
  tagLabel,
}: {
  filters: ExploreSearchParams;
  list: PublishedResourceList;
  categoryLabel?: string | null;
  tagLabel?: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ExploreToolbar filters={filters} />
      <ActiveFilters filters={filters} categoryLabel={categoryLabel} tagLabel={tagLabel} />
      {filters.q ? (
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm text-ink">
            Query: <span className="font-medium">“{filters.q}”</span>
          </p>
          <p className="text-sm text-ink-muted">{formatResultCount(list.total, filters.q)}</p>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">{formatResultCount(list.total, "")}</p>
      )}
      {list.items.length > 0 ? (
        <>
          <ResourceGrid resources={list.items} />
          <Pagination filters={filters} total={list.total} pageSize={list.pageSize} />
        </>
      ) : (
        <EmptyState
          {...exploreEmptyCopy(filters)}
          action={
            hasActiveExploreFilters(filters) ? (
              <ButtonLink href={buildExplorePath({})} variant="secondary" size="sm">
                Clear filters
              </ButtonLink>
            ) : null
          }
        />
      )}
    </div>
  );
}
