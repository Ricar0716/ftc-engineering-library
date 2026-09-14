import { DiscussionComposer } from "@/components/discussion/discussion-composer";
import { DiscussionItem } from "@/components/discussion/discussion-item";
import { EmptyState } from "@/components/ui/empty-state";
import { PagePagination } from "@/components/ui/page-pagination";
import type { AccessSnapshot } from "@/lib/auth/permissions";
import { listResourceDiscussions } from "@/lib/discussion/queries";
import { discussionPageHref } from "@/lib/discussion/validation";
import { DETAIL_EMPTY } from "@/lib/resources/detail-ui";

export async function ResourceDiscussion({
  resourceId,
  resourceSlug,
  resourceAuthorId,
  access,
  page,
}: {
  resourceId: string;
  resourceSlug: string;
  resourceAuthorId: string | null;
  access: AccessSnapshot;
  page: number;
}) {
  const list = await listResourceDiscussions(resourceId, page);

  return (
    <section id="discussion" className="flex min-w-0 scroll-mt-20 flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">Discussion</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Ask technical questions, share improvements, and explain design decisions. This is not a
          social feed.
        </p>
      </div>

      <DiscussionComposer resourceId={resourceId} resourceSlug={resourceSlug} access={access} />

      {list.items.length === 0 ? (
        <EmptyState title="Existing discussions" description={DETAIL_EMPTY.discussion} />
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          <h3 className="text-sm font-medium text-ink">Existing discussions</h3>
          <ul className="flex min-w-0 flex-col gap-4">
            {list.items.map((thread) => (
              <li key={thread.id} className="min-w-0">
                <DiscussionItem
                  thread={thread}
                  resourceId={resourceId}
                  resourceSlug={resourceSlug}
                  resourceAuthorId={resourceAuthorId}
                  teamOwnerId={list.teamOwnerId}
                  access={access}
                />
              </li>
            ))}
          </ul>
          <PagePagination
            page={list.page}
            pageSize={list.pageSize}
            total={list.total}
            hrefForPage={(next) => discussionPageHref(resourceSlug, next)}
          />
        </div>
      )}
    </section>
  );
}
