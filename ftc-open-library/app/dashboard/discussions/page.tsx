import { DashboardDiscussionRow } from "@/components/dashboard/dashboard-discussion-row";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PagePagination } from "@/components/ui/page-pagination";
import { isDiscussionEnabled } from "@/lib/config/features";
import { getCurrentAccess } from "@/lib/auth/session";
import { dashboardPagePath } from "@/lib/dashboard/nav";
import { listOwnDashboardDiscussions } from "@/lib/dashboard/queries";
import { parseIdentityPage } from "@/lib/identity/paths";

export const metadata = {
  title: "Discussions",
  description: "Questions and replies you posted on published resources.",
};

export default async function DashboardDiscussionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getCurrentAccess();
  const page = parseIdentityPage(await searchParams);
  const list = access.userId
    ? await listOwnDashboardDiscussions(access.userId, page)
    : { items: [], total: 0, page, pageSize: 20 };

  return (
    <>
      <DashboardHeader
        title="Discussions"
        description={
          isDiscussionEnabled()
            ? "Your questions and replies on published public resources. This is not an analytics report."
            : "Public discussion is paused for the initial Beta. Existing posts you already made are listed here."
        }
      />
      {list.items.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-3">
          <p className="font-mono text-xs text-ink-muted">
            {list.total} {list.total === 1 ? "post" : "posts"}
          </p>
          <ul className="flex flex-col gap-3">
            {list.items.map((post) => (
              <li key={post.id}>
                <DashboardDiscussionRow post={post} />
              </li>
            ))}
          </ul>
          <PagePagination
            page={list.page}
            pageSize={list.pageSize}
            total={list.total}
            hrefForPage={(nextPage) => dashboardPagePath("/dashboard/discussions", nextPage)}
          />
        </div>
      ) : (
        <EmptyState
          title="No discussion posts yet."
          description={
            isDiscussionEnabled()
              ? "When you ask a question or reply on a published resource, it will show up here."
              : "Public discussion is paused for the initial Beta. New posts cannot be created until it is enabled."
          }
        />
      )}
    </>
  );
}
