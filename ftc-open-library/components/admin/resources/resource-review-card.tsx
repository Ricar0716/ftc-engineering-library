import Link from "next/link";
import { ResourceTypeBadge } from "@/components/resources/resource-type-badge";
import { StatusBadge } from "@/components/resources/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { teamIdentityLabel } from "@/lib/identity/paths";
import { formatDisplayDate } from "@/lib/utils/dates";
import type { AdminModerationResource } from "@/lib/admin/resources/queries";

export function ResourceReviewCard({ resource }: { resource: AdminModerationResource }) {
  const href = `/admin/resources/${resource.id}`;
  const submittedBy = resource.teamNumber
    ? teamIdentityLabel(resource.teamNumber)
    : (resource.contributorName ?? "Unknown contributor");

  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-base font-medium text-ink">
            <Link
              href={href}
              className="underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {resource.title}
            </Link>
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <ResourceTypeBadge type={resource.resourceType} />
            <StatusBadge status={resource.status} />
            <span>Submitted by {submittedBy}</span>
            {resource.categoryName ? <span>· {resource.categoryName}</span> : null}
            <span>
              · {resource.fileCount} file{resource.fileCount === 1 ? "" : "s"}
            </span>
            <span>· Submitted {formatDisplayDate(resource.submittedAt) ?? "recently"}</span>
          </p>
        </div>
        <ButtonLink href={href} size="sm">
          Review
        </ButtonLink>
      </div>
    </article>
  );
}
