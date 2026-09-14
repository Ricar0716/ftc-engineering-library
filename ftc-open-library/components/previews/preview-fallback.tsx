import { EmptyState } from "@/components/ui/empty-state";
import { DETAIL_EMPTY } from "@/lib/resources/detail-ui";

export function PreviewFallback({
  title = DETAIL_EMPTY.preview,
  description = "You can still view the resource details and download supported published files if you have access.",
}: {
  title?: string;
  description?: string;
}) {
  return <EmptyState title={title} description={description} />;
}
