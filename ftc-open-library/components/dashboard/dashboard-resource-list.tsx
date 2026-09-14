import { DashboardResourceRow } from "@/components/dashboard/dashboard-resource-row";
import { EmptyState } from "@/components/ui/empty-state";
import { PagePagination } from "@/components/ui/page-pagination";
import { ButtonLink } from "@/components/ui/button";
import type { DashboardResourceList } from "@/lib/dashboard/queries";

export function DashboardResourceList({
  list,
  hrefForPage,
  emptyTitle,
  emptyDescription,
}: {
  list: DashboardResourceList;
  hrefForPage: (page: number) => string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (list.items.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={
          <ButtonLink href="/submit" size="sm">
            Submit a resource
          </ButtonLink>
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
            <DashboardResourceRow resource={resource} />
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
