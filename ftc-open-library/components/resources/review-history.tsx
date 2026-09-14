import { REVIEW_DECISION_LABELS } from "@/lib/constants/resources";
import { formatDisplayDate } from "@/lib/utils/dates";
import type { ResourceReviewEntry } from "@/types/resources";

/**
 * Moderation notes are private to the contributor and Site Admins. This
 * component is never rendered on a public resource page.
 */
export function ReviewHistory({
  reviews,
  emptyText = "No review decisions have been recorded yet.",
}: {
  reviews: ResourceReviewEntry[];
  emptyText?: string;
}) {
  if (reviews.length === 0) {
    return <p className="text-sm text-ink-muted">{emptyText}</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {reviews.map((review) => (
        <li key={review.id} className="rounded-lg border border-line bg-canvas px-4 py-3">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-ink">
            <span className="font-medium">{REVIEW_DECISION_LABELS[review.decision]}</span>
            <span className="text-ink-muted">
              {review.reviewerName ? `by ${review.reviewerName}` : "by a Site Admin"}
              {formatDisplayDate(review.createdAt) ? ` · ${formatDisplayDate(review.createdAt)}` : ""}
            </span>
          </p>
          {review.message ? (
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink-muted">
              {review.message}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
