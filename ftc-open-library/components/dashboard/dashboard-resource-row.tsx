import Link from "next/link";
import { ResourceTypeBadge } from "@/components/resources/resource-type-badge";
import { StatusBadge } from "@/components/resources/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { contributorCanEdit } from "@/lib/resources/transitions";
import { formatDisplayDate } from "@/lib/utils/dates";
import type { DashboardResourceRow } from "@/lib/dashboard/queries";

export function DashboardResourceRow({ resource }: { resource: DashboardResourceRow }) {
  const editable = contributorCanEdit(resource.status);
  const manageHref = `/my/resources/${resource.id}/edit`;
  const publicHref = resource.status === "PUBLISHED" ? `/resources/${resource.slug}` : null;

  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-base font-medium text-ink">
            <Link
              href={publicHref ?? manageHref}
              className="underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {resource.title}
            </Link>
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <ResourceTypeBadge type={resource.resourceType} />
            <StatusBadge status={resource.status} />
            <span>{resource.categoryName ?? "No category"}</span>
            <span>
              · {resource.fileCount} file{resource.fileCount === 1 ? "" : "s"}
            </span>
            {resource.submittedAt ? (
              <span>· Submitted {formatDisplayDate(resource.submittedAt)}</span>
            ) : (
              <span>· Updated {formatDisplayDate(resource.updatedAt) ?? "recently"}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {publicHref ? (
            <ButtonLink href={publicHref} variant="secondary" size="sm">
              View
            </ButtonLink>
          ) : null}
          <ButtonLink href={manageHref} variant={editable ? "primary" : "secondary"} size="sm">
            {editable ? "Continue editing" : "Manage"}
          </ButtonLink>
        </div>
      </div>
    </article>
  );
}
