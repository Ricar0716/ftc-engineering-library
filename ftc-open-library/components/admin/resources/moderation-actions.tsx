import { ReviewDecisionForm } from "@/components/admin/review-decision-form";

export function ModerationActions({ resourceId }: { resourceId: string }) {
  return <ReviewDecisionForm resourceId={resourceId} />;
}
