import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceForm } from "@/components/resources/resource-form";
import { ReviewHistory } from "@/components/resources/review-history";
import { StatusBadge } from "@/components/resources/status-badge";
import { FileUploader } from "@/components/resources/file-uploader";
import { UploadActivityProvider } from "@/components/resources/upload-activity";
import { SubmissionFiles } from "@/components/resources/submission-files";
import {
  DeleteResourceForm,
  SubmitForReviewForm,
  WithdrawSubmissionForm,
} from "@/components/resources/submission-actions";
import {
  CreateVersionForm,
  RevisionNotesForm,
  SubmitRevisionForm,
  WithdrawRevisionForm,
} from "@/components/versioning/create-version-form";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { loginPath } from "@/lib/auth/paths";
import { getCurrentAccess } from "@/lib/auth/session";
import { RESOURCE_STATUS_HELP } from "@/lib/constants/resources";
import { categoryRequiredFor, getSubmissionDetail } from "@/lib/db/submissions";
import { updateResourceDraft } from "@/lib/resources/actions";
import { loadResourceFormOptions } from "@/lib/resources/form-options";
import { contributorCanEdit, contributorCanWithdraw } from "@/lib/resources/transitions";
import { submissionBlockers } from "@/lib/resources/validation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isUuid } from "@/lib/utils/id";
import { formatDisplayDate } from "@/lib/utils/dates";
import {
  nextVersionLabel,
  openRevision,
  revisionSubmitBlockers,
} from "@/lib/versioning/queries";
import { displayVersionName } from "@/lib/versioning/validation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit resource",
  description: "Edit a draft resource and submit it for Site Admin review.",
};

const NOTICES: Record<string, string> = {
  created: "Draft created. Upload your files, then submit it for review.",
  saved: "Changes saved.",
  submitted:
    "Submitted for review. Your resource is not public yet — you can track its status in your dashboard.",
  withdrawn: "Submission withdrawn. This is a draft again and you can keep editing.",
  "file-removed": "File removed.",
  "revision-created": "New version created. Upload files and a changelog, then submit it for review.",
  "revision-submitted": "Version submitted for review. The published page is unchanged until a Site Admin decides.",
  "revision-withdrawn": "Version withdrawn. You can keep editing this revision.",
};

export default async function EditSubmissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const { notice } = await searchParams;
  const access = await getCurrentAccess();

  if (access.level === "guest") {
    redirect(loginPath(`/my/resources/${id}/edit`));
  }
  if (access.level === "unverified" || !access.userId || !isUuid(id) || !isSupabaseConfigured()) {
    notFound();
  }

  // Private editing addresses resources by UUID, never by public slug.
  const supabase = await createClient();
  const { data: manageable } = await supabase.rpc("can_manage_resource", { p_resource_id: id });
  if (!manageable) {
    notFound();
  }

  const submission = await getSubmissionDetail(id);
  if (!submission) {
    notFound();
  }

  const editable = contributorCanEdit(submission.status);
  const options = await loadResourceFormOptions(access.userId);
  const categoryRequired = await categoryRequiredFor(submission.resourceType);
  const revision = openRevision(submission.versions);
  const revisionDraft = revision?.status === "DRAFT" ? revision : null;
  const revisionPending = revision?.status === "PENDING_REVIEW" ? revision : null;
  const revisionFiles = revision
    ? submission.files.filter((file) => file.versionId === revision.id)
    : [];
  const publishedFiles =
    submission.status === "PUBLISHED"
      ? submission.files.filter((file) => !revision || file.versionId !== revision.id)
      : submission.files;
  const revisionBlockers = revisionDraft
    ? revisionSubmitBlockers({
        changelog: revisionDraft.changelog,
        fileCount: revisionFiles.length,
      })
    : [];
  const blockers = submissionBlockers({
    title: submission.title,
    description: submission.description,
    licenseId: submission.licenseId,
    categoryId: submission.categoryId,
    categoryRequired,
    fileCount: submission.files.length,
  });
  const totalBytes = submission.files.reduce((total, file) => total + (file.sizeBytes ?? 0), 0);
  const latestReview = submission.reviews[0] ?? null;

  return (
    <main id="main-content">
      <PageHeader
        eyebrow="Dashboard"
        title={submission.title}
        description={RESOURCE_STATUS_HELP[submission.status]}
      />
      <Container width="narrow" className="flex flex-col gap-4 pb-16">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={submission.status} />
          {submission.submittedAt ? (
            <span className="text-sm text-ink-muted">
              Submitted {formatDisplayDate(submission.submittedAt)}
            </span>
          ) : null}
          {submission.publishedAt ? (
            <span className="text-sm text-ink-muted">
              Published {formatDisplayDate(submission.publishedAt)}
            </span>
          ) : null}
          <ButtonLink href="/dashboard/resources" variant="ghost" size="sm">
            Back to dashboard
          </ButtonLink>
          {submission.status === "PUBLISHED" ? (
            <ButtonLink href={`/resources/${submission.slug}`} variant="ghost" size="sm">
              View public page
            </ButtonLink>
          ) : null}
        </div>

        {notice && NOTICES[notice] ? (
          <p
            role="status"
            className="rounded-md border border-line bg-accent-soft px-4 py-3 text-sm text-ink"
          >
            {NOTICES[notice]}
          </p>
        ) : null}

        {submission.status === "CHANGES_REQUESTED" ||
        submission.status === "REJECTED" ||
        (submission.status === "PUBLISHED" && revisionDraft && latestReview) ? (
          <section className="rounded-lg border border-accent/30 bg-accent-soft p-4">
            <h2 className="text-base font-medium text-ink">Reviewer feedback</h2>
            <div className="mt-2">
              <ReviewHistory
                reviews={latestReview ? [latestReview] : []}
                emptyText="No reviewer note was recorded."
              />
            </div>
          </section>
        ) : null}

        {editable ? (
          <ResourceForm
            action={updateResourceDraft}
            options={options}
            resourceId={submission.id}
            allowTypeChange={submission.status === "DRAFT"}
            submitLabel="Save changes"
            initial={{
              resourceType: submission.resourceType,
              title: submission.title,
              description: submission.description,
              categoryId: submission.categoryId ?? "",
              seasonId: submission.seasonId ?? "",
              licenseId: submission.licenseId ?? "",
              teamId: submission.teamId ?? "",
              tagIds: submission.tagIds,
            }}
          />
        ) : (
          <section className="rounded-lg border border-line bg-surface p-4">
            <h2 className="text-base font-medium text-ink">Details</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-ink-muted">Resource Type</dt>
                <dd className="text-sm text-ink">{submission.resourceType}</dd>
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
                <dt className="text-sm text-ink-muted">License</dt>
                <dd className="text-sm text-ink">{submission.licenseName ?? "Not chosen"}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">Team</dt>
                <dd className="text-sm text-ink">{submission.teamName ?? "Personal contribution"}</dd>
              </div>
            </dl>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink-muted">
              {submission.description}
            </p>
          </section>
        )}

        <UploadActivityProvider>
        {submission.status === "PUBLISHED" ? (
          <>
            <section className="rounded-lg border border-line bg-surface p-4">
              <h2 className="text-base font-medium text-ink">Published files</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Released files stay immutable. To change them, create a new version and submit it for
                review.
              </p>
              <div className="mt-4">
                <SubmissionFiles resourceId={submission.id} files={publishedFiles} canRemove={false} />
              </div>
            </section>

            <section className="rounded-lg border border-line bg-surface p-4">
              <h2 className="text-base font-medium text-ink">
                {revision ? `Version ${displayVersionName(revision)}` : "New version"}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                {revisionPending
                  ? `This version is waiting for Site Admin review${revisionPending.submittedAt ? ` since ${formatDisplayDate(revisionPending.submittedAt)}` : ""}. The public page still shows the latest published release.`
                  : revisionDraft
                    ? "Upload files for this revision only. They stay private until a reviewer approves them."
                    : "Create a draft version. It will not replace the public files until a Site Admin approves it."}
              </p>
              <div className="mt-4 flex flex-col gap-4">
                {revisionDraft ? (
                  <>
                    <RevisionNotesForm
                      resourceId={submission.id}
                      versionId={revisionDraft.id}
                      versionLabel={revisionDraft.versionLabel}
                      changelog={revisionDraft.changelog}
                    />
                    <SubmissionFiles
                      resourceId={submission.id}
                      files={revisionFiles}
                      canRemove
                    />
                    <FileUploader
                      resourceId={submission.id}
                      resourceType={submission.resourceType}
                      fileCount={submission.files.length}
                      totalBytes={totalBytes}
                      disabled={false}
                    />
                    <SubmitRevisionForm
                      resourceId={submission.id}
                      versionId={revisionDraft.id}
                      blockers={revisionBlockers}
                    />
                  </>
                ) : null}
                {revisionPending ? (
                  <>
                    {revisionPending.changelog ? (
                      <p className="whitespace-pre-line text-sm leading-6 text-ink-muted">
                        {revisionPending.changelog}
                      </p>
                    ) : null}
                    <SubmissionFiles
                      resourceId={submission.id}
                      files={revisionFiles}
                      canRemove={false}
                    />
                    <WithdrawRevisionForm resourceId={submission.id} versionId={revisionPending.id} />
                  </>
                ) : null}
                {!revision ? (
                  <CreateVersionForm
                    resourceId={submission.id}
                    nextLabel={nextVersionLabel(submission.versions)}
                  />
                ) : null}
              </div>
            </section>
          </>
        ) : (
        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="text-base font-medium text-ink">Files</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Files stay in private storage. Only you and Site Admin reviewers can open them until the
            resource is published.
          </p>
          <div className="mt-4 flex flex-col gap-4">
            <SubmissionFiles
              resourceId={submission.id}
              files={submission.files}
              canRemove={editable}
            />
            <FileUploader
              resourceId={submission.id}
              resourceType={submission.resourceType}
              fileCount={submission.files.length}
              totalBytes={totalBytes}
              disabled={!editable}
              disabledReason={RESOURCE_STATUS_HELP[submission.status]}
            />
          </div>
        </section>
        )}

        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="text-base font-medium text-ink">Review</h2>
          <div className="mt-4 flex flex-col gap-4">
            {editable ? (
              <SubmitForReviewForm resourceId={submission.id} blockers={blockers} />
            ) : null}
            {contributorCanWithdraw(submission.status) ? (
              <WithdrawSubmissionForm resourceId={submission.id} />
            ) : null}
            <div>
              <h3 className="text-sm font-medium text-ink">Review history</h3>
              <div className="mt-2">
                <ReviewHistory reviews={submission.reviews} />
              </div>
            </div>
          </div>
        </section>
        </UploadActivityProvider>

        {editable ? (
          <section className="rounded-lg border border-line bg-surface p-4">
            <h2 className="text-base font-medium text-ink">Danger zone</h2>
            <div className="mt-4">
              <DeleteResourceForm resourceId={submission.id} title={submission.title} />
            </div>
          </section>
        ) : null}
      </Container>
    </main>
  );
}
