import { ReviewHistory } from "@/components/resources/review-history";
import type { ResourceReviewEntry } from "@/types/resources";

/**
 * Contributor-visible moderation notes. Never rendered on a public resource page.
 */
export function ModerationNote({ reviews }: { reviews: ResourceReviewEntry[] }) {
  const latest = reviews[0] ?? null;

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-base font-medium text-ink">Moderation notes</h2>
      <p className="mt-1 text-sm text-ink-muted">
        The contributor can read these on their dashboard editor. They are not shown on the public
        resource page.
      </p>
      {latest?.message ? (
        <p className="mt-3 whitespace-pre-line rounded-md border border-line bg-canvas px-3 py-2 text-sm leading-6 text-ink">
          {latest.message}
        </p>
      ) : null}
      <div className="mt-4">
        <ReviewHistory reviews={reviews} />
      </div>
    </section>
  );
}
