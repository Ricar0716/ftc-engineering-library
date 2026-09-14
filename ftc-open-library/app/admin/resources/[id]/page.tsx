import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { ResourceReviewDetail } from "@/components/admin/resources/resource-review-detail";
import { RESOURCE_STATUS_HELP } from "@/lib/constants/resources";
import { listTags } from "@/lib/db/catalog";
import { categoryRequiredFor, getSubmissionDetail } from "@/lib/db/submissions";
import { getCurrentAccess } from "@/lib/auth/session";
import { submissionBlockers } from "@/lib/resources/validation";
import { isUuid } from "@/lib/utils/id";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Review resource",
  description: "Inspect a submitted resource and record a first-publish decision.",
};

export default async function AdminResourceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const { notice } = await searchParams;

  if (!isUuid(id)) {
    notFound();
  }

  const [submission, access] = await Promise.all([getSubmissionDetail(id), getCurrentAccess()]);
  if (!submission) {
    notFound();
  }

  const [categoryRequired, allTags] = await Promise.all([
    categoryRequiredFor(submission.resourceType),
    listTags(),
  ]);
  const tagNames = allTags
    .filter((tag) => submission.tagIds.includes(tag.id))
    .map((tag) => tag.name);
  const blockers = submissionBlockers({
    title: submission.title,
    description: submission.description,
    licenseId: submission.licenseId,
    categoryId: submission.categoryId,
    categoryRequired,
    fileCount: submission.files.length,
  });

  return (
    <>
      <AdminHeader
        eyebrow="Resource review"
        title={submission.title}
        description={RESOURCE_STATUS_HELP[submission.status]}
      />
      <ResourceReviewDetail
        submission={submission}
        tagNames={tagNames}
        access={access}
        notice={notice}
        blockers={blockers}
      />
    </>
  );
}
