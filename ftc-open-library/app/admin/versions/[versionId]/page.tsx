import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { VersionReviewDetail } from "@/components/admin/versions/version-review-detail";
import { getCurrentAccess } from "@/lib/auth/session";
import { listTags } from "@/lib/db/catalog";
import { getAdminVersionReview } from "@/lib/admin/versions/queries";
import { isUuid } from "@/lib/utils/id";
import { displayVersionName } from "@/lib/versioning/validation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Review version",
  description: "Inspect a submitted version and record a moderation decision.",
};

export default async function AdminVersionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ versionId: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { versionId } = await params;
  const { notice } = await searchParams;

  if (!isUuid(versionId)) {
    notFound();
  }

  const [review, access] = await Promise.all([getAdminVersionReview(versionId), getCurrentAccess()]);
  if (!review) {
    notFound();
  }

  const allTags = await listTags();
  const tagNames = allTags
    .filter((tag) => review.submission.tagIds.includes(tag.id))
    .map((tag) => tag.name);

  return (
    <>
      <AdminHeader
        eyebrow="Version review"
        title={`${review.submission.title} · ${displayVersionName(review.version)}`}
        description="The live public version stays available until this revision is approved."
      />
      <VersionReviewDetail review={review} tagNames={tagNames} access={access} notice={notice} />
    </>
  );
}
