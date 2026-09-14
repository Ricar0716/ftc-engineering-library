import Link from "next/link";
import { VersionModerationActions } from "@/components/admin/versions/version-moderation-actions";
import { ModerationNote } from "@/components/admin/resources/moderation-note";
import { ResourcePreview } from "@/components/previews/resource-preview";
import { ResourcePreviewCard } from "@/components/resources/resource-preview-card";
import { ResourceTypeBadge } from "@/components/resources/resource-type-badge";
import { StatusBadge } from "@/components/resources/status-badge";
import { SubmissionFiles } from "@/components/resources/submission-files";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import type { AccessSnapshot } from "@/lib/auth/permissions";
import { adminVersionStatusLabel } from "@/lib/admin/versions/params";
import type { AdminVersionReview } from "@/lib/admin/versions/queries";
import { contributorHref, teamHref, teamIdentityLabel } from "@/lib/identity/paths";
import { isPreviewable } from "@/lib/previews/select";
import { formatDisplayDate } from "@/lib/utils/dates";
import { displayVersionName } from "@/lib/versioning/validation";
import type { ResourceFileSummary, SubmissionFile } from "@/types/resources";

const NOTICES: Record<string, string> = {
  "revision-approved": "Version approved. It is now the latest public release. Older published versions stay available.",
  "revision-changes": "Changes requested on this version. The live public release is unchanged.",
  "revision-rejected": "Version rejected. It is archived and stays private. The live public release is unchanged.",
};

function toPreviewFiles(files: SubmissionFile[]): ResourceFileSummary[] {
  return files.map((file) => ({
    id: file.id,
    versionId: file.versionId,
    filename: file.filename,
    fileType: file.fileType,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
  }));
}

export function VersionReviewDetail({
  review,
  tagNames,
  access,
  notice,
}: {
  review: AdminVersionReview;
  tagNames: string[];
  access: AccessSnapshot;
  notice?: string;
}) {
  const { submission, version, comparisonPublished, submittedFiles, comparisonFiles, reviews } = review;
  const previewFiles = toPreviewFiles(submittedFiles);
  const previewableCount = previewFiles.filter((file) =>
    isPreviewable(submission.resourceType, file),
  ).length;
  const teamLabel = submission.teamNumber
    ? teamIdentityLabel(submission.teamNumber)
    : (submission.teamName ?? "Personal contribution");
  const submittedName = displayVersionName(version);
  const currentName = comparisonPublished ? displayVersionName(comparisonPublished) : "None";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <ResourceTypeBadge type={submission.resourceType} />
        <StatusBadge status={submission.status} />
        <Badge tone={version.status === "PENDING_REVIEW" ? "accent" : "neutral"}>
          {adminVersionStatusLabel(version.status)}
        </Badge>
        <ButtonLink href="/admin/versions" variant="ghost" size="sm">
          Back to versions
        </ButtonLink>
      </div>

      {notice && NOTICES[notice] ? (
        <p
          role="status"
          className="rounded-md border border-line bg-accent-soft px-4 py-3 text-sm text-ink"
        >
          {NOTICES[notice]}
        </p>
      ) : null}

      <p className="rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink">
        This is a new version of a published resource. Approving it promotes {submittedName} without
        unpublishing the resource or rewriting {currentName}.
      </p>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-base font-medium text-ink">Resource</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink-muted">Title</dt>
            <dd className="break-words text-sm text-ink">{submission.title}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Type</dt>
            <dd className="text-sm text-ink">{submission.resourceType}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Submitted by</dt>
            <dd className="text-sm text-ink">
              {version.createdByUsername ? (
                <Link
                  href={contributorHref(version.createdByUsername)}
                  className="underline underline-offset-2"
                >
                  {version.createdByDisplayName ?? version.createdByUsername}
                </Link>
              ) : (
                (version.createdByDisplayName ?? "Unknown")
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Original resource author</dt>
            <dd className="text-sm text-ink">
              {submission.authorUsername ? (
                <Link
                  href={contributorHref(submission.authorUsername)}
                  className="underline underline-offset-2"
                >
                  {submission.authorDisplayName}
                </Link>
              ) : (
                (submission.authorDisplayName ?? "Unknown")
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Team</dt>
            <dd className="text-sm text-ink">
              {submission.teamNumber ? (
                <Link href={teamHref(submission.teamNumber)} className="underline underline-offset-2">
                  {teamLabel}
                  {submission.teamName ? ` · ${submission.teamName}` : ""}
                </Link>
              ) : (
                teamLabel
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Category</dt>
            <dd className="text-sm text-ink">
              {submission.categoryBreadcrumb.length > 0
                ? submission.categoryBreadcrumb.map((item) => item.name).join(" > ")
                : "No category"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Tags</dt>
            <dd className="text-sm text-ink">{tagNames.length > 0 ? tagNames.join(", ") : "None"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-base font-medium text-ink">Current vs submitted</h2>
        <p className="mt-1 text-sm text-ink-muted">
          No Git diff or CAD geometry comparison. Compare labels, changelog, and file names.
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink-muted">Current published version</dt>
            <dd className="text-sm text-ink">{currentName}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Submitted version</dt>
            <dd className="text-sm text-ink">{submittedName}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Current released</dt>
            <dd className="text-sm text-ink">
              {formatDisplayDate(comparisonPublished?.releasedAt) ?? "Not released"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Created</dt>
            <dd className="text-sm text-ink">
              {formatDisplayDate(version.createdAt) ?? "Unknown"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">Submitted</dt>
            <dd className="text-sm text-ink">
              {formatDisplayDate(version.submittedAt) ?? "Not submitted"}
            </dd>
          </div>
        </dl>
        <div className="mt-4">
          <h3 className="text-sm font-medium text-ink">Changelog</h3>
          <p className="mt-1 whitespace-pre-line text-sm leading-6 text-ink-muted">
            {version.changelog?.trim() || "No changelog."}
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-base font-medium text-ink">Files for {currentName}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Live public files. They stay available while this revision is reviewed.
        </p>
        <div className="mt-4">
          <SubmissionFiles resourceId={submission.id} files={comparisonFiles} canRemove={false} />
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-base font-medium text-ink">Files for {submittedName}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Submitted revision files. Downloads use a short-lived signed URL. Private storage paths are
          never shown.{" "}
          {previewableCount === 0
            ? "None of these files can be previewed in the browser."
            : `${previewableCount} of ${submittedFiles.length} file${submittedFiles.length === 1 ? "" : "s"} can be previewed.`}
        </p>
        <div className="mt-4">
          <SubmissionFiles resourceId={submission.id} files={submittedFiles} canRemove={false} />
        </div>
      </section>

      <ResourcePreviewCard>
        <p className="mb-3 text-sm text-ink-muted">
          Preview uses files from {submittedName}, not the live public release.
        </p>
        <ResourcePreview
          resourceType={submission.resourceType}
          files={previewFiles}
          access={access}
          resourceSlug={submission.slug}
        />
      </ResourcePreviewCard>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-base font-medium text-ink">Decision</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {version.status === "PENDING_REVIEW"
            ? "Approve to make this the latest public version. Request changes or reject without touching the live release."
            : "This version is not waiting for a first decision."}
        </p>
        <div className="mt-4">
          {version.status === "PENDING_REVIEW" && submission.status === "PUBLISHED" ? (
            <VersionModerationActions resourceId={submission.id} versionId={version.id} />
          ) : (
            <p className="text-sm text-ink-muted">
              Version decisions are only available while the revision is pending review and the
              resource stays published.
            </p>
          )}
        </div>
      </section>

      <ModerationNote reviews={reviews} />
    </div>
  );
}
