import { notFound, redirect } from "next/navigation";
import { getSubmissionDetail } from "@/lib/db/submissions";
import { isUuid } from "@/lib/utils/id";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Review submission",
  description: "Redirects to resource or version moderation.",
};

/**
 * Compatibility URL from the mixed review queue. First publishes go to
 * `/admin/resources/[id]`; later versions go to `/admin/versions/[versionId]`.
 */
export default async function ReviewDetailRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ resourceId: string }>;
  searchParams: Promise<{ version?: string; notice?: string }>;
}) {
  const { resourceId } = await params;
  const query = await searchParams;

  if (!isUuid(resourceId)) {
    notFound();
  }

  if (query.version && isUuid(query.version)) {
    const notice = query.notice ? `?notice=${encodeURIComponent(query.notice)}` : "";
    redirect(`/admin/versions/${query.version}${notice}`);
  }

  const submission = await getSubmissionDetail(resourceId);
  if (!submission) {
    notFound();
  }

  const pendingRevision = submission.versions.find(
    (version) => version.status === "PENDING_REVIEW" && version.versionNumber > 1,
  );
  if (pendingRevision) {
    const notice = query.notice ? `?notice=${encodeURIComponent(query.notice)}` : "";
    redirect(`/admin/versions/${pendingRevision.id}${notice}`);
  }

  const notice = query.notice ? `?notice=${encodeURIComponent(query.notice)}` : "";
  redirect(`/admin/resources/${resourceId}${notice}`);
}
