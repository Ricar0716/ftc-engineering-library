import { VersionReviewCard } from "@/components/admin/versions/version-review-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PagePagination } from "@/components/ui/page-pagination";
import { ADMIN_VERSION_FILTER_LABELS, type AdminVersionFilter } from "@/lib/admin/versions/params";
import type { AdminModerationVersionList } from "@/lib/admin/versions/queries";

export function VersionReviewList({
  list,
  filter,
  hrefForPage,
}: {
  list: AdminModerationVersionList;
  filter: AdminVersionFilter;
  hrefForPage: (page: number) => string;
}) {
  const label = ADMIN_VERSION_FILTER_LABELS[filter].toLowerCase();

  if (list.items.length === 0) {
    return (
      <EmptyState
        title={`No ${label} versions.`}
        description={
          filter === "pending"
            ? "When a contributor submits a new version of a published resource it will appear here."
            : "Nothing in this status right now."
        }
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="font-mono text-xs text-ink-muted">
        {list.total} {list.total === 1 ? "version" : "versions"}
      </p>
      <ul className="flex flex-col gap-3">
        {list.items.map((version) => (
          <li key={version.id}>
            <VersionReviewCard version={version} />
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
