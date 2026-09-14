import Link from "next/link";
import { ResourceTypeBadge } from "@/components/resources/resource-type-badge";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { adminVersionStatusLabel } from "@/lib/admin/versions/params";
import type { AdminModerationVersion } from "@/lib/admin/versions/queries";
import { teamIdentityLabel } from "@/lib/identity/paths";
import { formatDisplayDate } from "@/lib/utils/dates";
import { displayVersionName } from "@/lib/versioning/validation";

export function VersionReviewCard({ version }: { version: AdminModerationVersion }) {
  const href = `/admin/versions/${version.id}`;
  const submittedBy = version.contributorName ?? "Unknown contributor";
  const teamLabel = version.teamNumber
    ? teamIdentityLabel(version.teamNumber)
    : version.teamName;
  const submittedName = displayVersionName({
    versionNumber: version.versionNumber,
    versionLabel: version.versionLabel,
  });
  const currentName =
    version.currentVersionNumber != null
      ? displayVersionName({
          versionNumber: version.currentVersionNumber,
          versionLabel: version.currentVersionLabel,
        })
      : "None";

  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-base font-medium text-ink">
            <Link
              href={href}
              className="underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {version.resourceTitle}
            </Link>
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <ResourceTypeBadge type={version.resourceType} />
            <Badge tone={version.status === "PENDING_REVIEW" ? "accent" : "neutral"}>
              {adminVersionStatusLabel(version.status)}
            </Badge>
            <span>New version {submittedName}</span>
            <span>· Current {currentName}</span>
            <span>· Submitted by {submittedBy}</span>
            {teamLabel ? <span>· Team {teamLabel}</span> : null}
            <span>
              · {version.fileCount} file{version.fileCount === 1 ? "" : "s"}
            </span>
            <span>· Submitted {formatDisplayDate(version.submittedAt) ?? "recently"}</span>
          </p>
          {version.changelogSummary ? (
            <p className="mt-2 text-sm leading-6 text-ink">
              <span className="text-ink-muted">Changes: </span>
              {version.changelogSummary}
            </p>
          ) : null}
        </div>
        <ButtonLink href={href} size="sm">
          Review
        </ButtonLink>
      </div>
    </article>
  );
}
