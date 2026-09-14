import { ReviewRevisionForm } from "@/components/admin/review-decision-form";

export function VersionModerationActions({
  resourceId,
  versionId,
}: {
  resourceId: string;
  versionId: string;
}) {
  return <ReviewRevisionForm resourceId={resourceId} versionId={versionId} />;
}
