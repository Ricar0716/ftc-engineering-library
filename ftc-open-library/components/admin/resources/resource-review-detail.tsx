import Link from "next/link";
import { ArchiveToggleForm } from "@/components/admin/review-decision-form";
import { ModerationActions } from "@/components/admin/resources/moderation-actions";
import { ModerationNote } from "@/components/admin/resources/moderation-note";
import { ResourcePreview } from "@/components/previews/resource-preview";
import { ResourcePreviewCard } from "@/components/resources/resource-preview-card";
import { ResourceTypeBadge } from "@/components/resources/resource-type-badge";
import { StatusBadge } from "@/components/resources/status-badge";
import { SubmissionFiles } from "@/components/resources/submission-files";
import { ButtonLink } from "@/components/ui/button";
import type { AccessSnapshot } from "@/lib/auth/permissions";
import { isDiscussionEnabled } from "@/lib/config/features";
import { RESOURCE_STATUS_HELP } from "@/lib/constants/resources";
import { contributorHref, teamHref, teamIdentityLabel } from "@/lib/identity/paths";
import { isPreviewable } from "@/lib/previews/select";
import { formatDisplayDate } from "@/lib/utils/dates";
import { displayVersionName } from "@/lib/versioning/validation";
import type { ResourceFileSummary, SubmissionDetail, SubmissionFile } from "@/types/resources";

const NOTICES: Record<string, string> = {
  approved: "Approved and published. The resource is now publicly browsable.",
  "changes-requested": "Changes requested. The contributor can edit and resubmit.",
  rejected: "Rejected. The resource stays private and its files are preserved.",
  archived: "Archived. The resource no longer appears in public browsing.",
  restored: "Restored. The resource is published again.",
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

export function ResourceReviewDetail({
  submission,
  tagNames,
  access,
  notice,
  blockers,
}: {
  submission: SubmissionDetail;
  tagNames: string[];
  access: AccessSnapshot;
  notice?: string;
  blockers: string[];
}) {
  const pendingRevision =
    submission.status === "PUBLISHED"
      ? (submission.versions.find(
          (version) => version.status === "PENDING_REVIEW" && version.versionNumber > 1,
        ) ?? null)
      : null;
  const publishedVersion = submission.versions.find((version) => version.status === "PUBLISHED") ?? null;
  const currentVersion =
    pendingRevision && publishedVersion
      ? publishedVersion
      : (submission.versions.find((version) => version.id === submission.versionId) ??
        submission.versions[0] ??
        null);
  const currentFiles = currentVersion
    ? submission.files.filter((file) => file.versionId === currentVersion.id)
    : submission.files;
  const previewFiles = toPreviewFiles(currentFiles);
  const previewableCount = previewFiles.filter((file) =>
    isPreviewable(submission.resourceType, file),
  ).length;
  const teamLabel = submission.teamNumber
    ? teamIdentityLabel(submission.teamNumber)
    : (submission.teamName ?? "Personal contribution");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <ResourceTypeBadge type={submission.resourceType} />
        <StatusBadge status={submission.status} />
        <ButtonLink href="/admin/resources" variant="ghost" size="sm">
          Back to resources
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

      {pendingRevision ? (
        <p className="rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink">
          This resource is already published. Approving it did not approve later versions.{" "}
          <Link
            href={`/admin/versions/${pendingRevision.id}`}
            className="underline underline-offset-2"
          >
            Review {displayVersionName(pendingRevision)} in the version queue
          </Link>
          .
        </p>
      ) : null}

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-base font-medium text-ink">Resource information</h2>
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
            <dt className="text-sm text-ink-muted">Creator</dt>
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
          <div>
            <dt className="text-sm text-ink-muted">Submitted</dt>
            <dd className="text-sm text-ink">
              {formatDisplayDate(submission.submittedAt) ?? "Not submitted"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">License</dt>
            <dd className="text-sm text-ink">{submission.licenseName ?? "Not chosen"}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <h3 className="text-sm font-medium text-ink">Description</h3>
          <p className="mt-1 whitespace-pre-line text-sm leading-6 text-ink-muted">
            {submission.description || "No description."}
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-base font-medium text-ink">Version</h2>
        <p className="mt-1 text-sm text-ink-muted">
          First-publish approval does not approve future versions. Those stay on the review queue.
        </p>
        {currentVersion ? (
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-ink-muted">Current version</dt>
              <dd className="text-sm text-ink">{displayVersionName(currentVersion)}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Version status</dt>
              <dd className="text-sm text-ink">{currentVersion.status}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Released</dt>
              <dd className="text-sm text-ink">
                {formatDisplayDate(currentVersion.releasedAt) ?? "Not released"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-muted">Created</dt>
              <dd className="text-sm text-ink">
                {formatDisplayDate(currentVersion.createdAt) ?? "Unknown"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">No version row is attached yet.</p>
        )}
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-base font-medium text-ink">Files</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Downloads use a short-lived signed URL. Private storage paths are never shown.{" "}
          {previewableCount === 0
            ? "None of these files can be previewed in the browser."
            : `${previewableCount} of ${currentFiles.length} file${currentFiles.length === 1 ? "" : "s"} can be previewed.`}
        </p>
        <div className="mt-4">
          <SubmissionFiles resourceId={submission.id} files={currentFiles} canRemove={false} />
        </div>
      </section>

      <ResourcePreviewCard>
        <ResourcePreview
          resourceType={submission.resourceType}
          files={previewFiles}
          access={access}
          resourceSlug={submission.slug}
        />
      </ResourcePreviewCard>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-base font-medium text-ink">Decision</h2>
        <p className="mt-1 text-sm text-ink-muted">{RESOURCE_STATUS_HELP[submission.status]}</p>
        <div className="mt-4">
          {submission.status === "PENDING_REVIEW" ? (
            <>
              {blockers.length > 0 ? (
                <p className="mb-4 rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
                  This submission is incomplete and approval will be refused. Request changes
                  instead.
                </p>
              ) : null}
              <ModerationActions resourceId={submission.id} />
            </>
          ) : submission.status === "PUBLISHED" || submission.status === "ARCHIVED" ? (
            <ArchiveToggleForm
              resourceId={submission.id}
              archived={submission.status === "ARCHIVED"}
            />
          ) : (
            <p className="text-sm text-ink-muted">
              First-publish decisions are only available while the resource is pending review.
            </p>
          )}
        </div>
      </section>

      {submission.status === "PUBLISHED" && isDiscussionEnabled() ? (
        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="text-base font-medium text-ink">Discussion</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Hide or restore posts on the published resource page. There is no separate discussion
            queue.
          </p>
          <div className="mt-3">
            <ButtonLink href={`/resources/${submission.slug}#discussion`} variant="secondary" size="sm">
              Open public discussion
            </ButtonLink>
          </div>
        </section>
      ) : null}

      <ModerationNote reviews={submission.reviews} />
    </div>
  );
}
