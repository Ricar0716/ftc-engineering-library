import { ResourceReviewCard } from "@/components/admin/resources/resource-review-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PagePagination } from "@/components/ui/page-pagination";
import type { AdminModerationResourceList } from "@/lib/admin/resources/queries";
import { ADMIN_RESOURCE_FILTER_LABELS, type AdminResourceFilter } from "@/lib/admin/resources/params";

export function ResourceReviewList({
  list,
  filter,
  hrefForPage,
}: {
  list: AdminModerationResourceList;
  filter: AdminResourceFilter;
  hrefForPage: (page: number) => string;
}) {
  const label = ADMIN_RESOURCE_FILTER_LABELS[filter].toLowerCase();

  if (list.items.length === 0) {
    return (
      <EmptyState
        title={`No ${label} resources.`}
        description={
          filter === "pending"
            ? "When a verified contributor submits a resource it will appear here."
            : "Nothing in this status right now."
        }
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="font-mono text-xs text-ink-muted">
        {list.total} {list.total === 1 ? "resource" : "resources"}
      </p>
      <ul className="flex flex-col gap-3">
        {list.items.map((resource) => (
          <li key={resource.id}>
            <ResourceReviewCard resource={resource} />
          </li>
        ))}
      </ul>
      <PagePagination
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
        hrefForPage={hrefForPage}
      />
    </div>
  );
}
