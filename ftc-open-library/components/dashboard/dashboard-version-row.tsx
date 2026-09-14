import Link from "next/link";
import { StatusBadge } from "@/components/resources/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { displayVersionName, versionHref } from "@/lib/versioning/validation";
import { formatDisplayDate } from "@/lib/utils/dates";
import type { DashboardVersionRow } from "@/lib/dashboard/queries";
import type { ResourceStatus } from "@/types/resources";

export function DashboardVersionRow({ version }: { version: DashboardVersionRow }) {
  const published = version.status === "PUBLISHED" && version.resourceStatus === "PUBLISHED";
  const viewHref = published
    ? versionHref(version.resourceSlug, version.versionNumber)
    : `/my/resources/${version.resourceId}/edit`;

  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-base font-medium text-ink">
            <Link
              href={viewHref}
              className="underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {version.resourceTitle}
            </Link>
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <span className="font-mono text-xs">{displayVersionName(version)}</span>
            <StatusBadge status={version.status as ResourceStatus} />
            <span>
              {version.status === "PUBLISHED"
                ? `Released ${formatDisplayDate(version.releasedAt ?? version.createdAt) ?? "recently"}`
                : version.status === "PENDING_REVIEW"
                  ? `Submitted ${formatDisplayDate(version.submittedAt) ?? "recently"}`
                  : `Created ${formatDisplayDate(version.createdAt) ?? "recently"}`}
            </span>
          </p>
        </div>
        <ButtonLink href={viewHref} variant="secondary" size="sm">
          View version
        </ButtonLink>
      </div>
    </article>
  );
}
