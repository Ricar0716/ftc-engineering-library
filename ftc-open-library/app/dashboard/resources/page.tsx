import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardResourceList } from "@/components/dashboard/dashboard-resource-list";
import { ResourceGrid } from "@/components/resources/resource-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { PagePagination } from "@/components/ui/page-pagination";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentAccess } from "@/lib/auth/session";
import { dashboardPagePath } from "@/lib/dashboard/nav";
import {
  DASHBOARD_RESOURCE_FILTER_LABELS,
  DASHBOARD_RESOURCE_FILTERS,
  parseDashboardResourceFilter,
} from "@/lib/dashboard/params";
import { listOwnDashboardResources, listOwnPublishedResourceCards } from "@/lib/dashboard/queries";
import { parseIdentityPage } from "@/lib/identity/paths";
import { cn } from "@/lib/utils/cn";

export const metadata = {
  title: "My resources",
  description: "Resources you created, grouped by moderation status.",
};

const NOTICES: Record<string, string> = {
  deleted: "The resource and its files were deleted.",
};

export default async function DashboardResourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getCurrentAccess();
  const query = await searchParams;
  const filter = parseDashboardResourceFilter(query);
  const page = parseIdentityPage(query);
  const notice = typeof query.notice === "string" ? query.notice : undefined;
  const userId = access.userId;

  const extra: Record<string, string> = filter === "all" ? {} : { status: filter };
  const [list, publishedCards] = await Promise.all([
    userId && filter !== "published"
      ? listOwnDashboardResources(userId, filter, page)
      : Promise.resolve({ items: [], total: 0, page, pageSize: 20 }),
    userId && filter === "published"
      ? listOwnPublishedResourceCards(userId, page)
      : Promise.resolve(null),
  ]);

  return (
    <>
      <DashboardHeader
        title="My Resources"
        description="Only resources you created. Drafts and submissions under review stay private."
      />

      {notice && NOTICES[notice] ? (
        <p role="status" className="rounded-md border border-line bg-accent-soft px-4 py-3 text-sm text-ink">
          {NOTICES[notice]}
        </p>
      ) : null}

      {access.level === "unverified" ? (
        <p className="rounded-md border border-line bg-accent-soft px-4 py-3 text-sm text-ink">
          Verify your email to create and submit resources.{" "}
          <a href="/verify?reason=submit" className="underline">
            Verify email
          </a>
        </p>
      ) : null}

      <nav aria-label="Resource status" className="flex flex-wrap gap-1">
        {DASHBOARD_RESOURCE_FILTERS.map((value) => {
          const href =
            value === "all" ? "/dashboard/resources" : `/dashboard/resources?status=${value}`;
          const active = filter === value;
          return (
            <Link
              key={value}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                active
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-ink-muted hover:bg-canvas hover:text-ink",
              )}
            >
              {DASHBOARD_RESOURCE_FILTER_LABELS[value]}
            </Link>
          );
        })}
      </nav>

      {filter === "published" && publishedCards ? (
        publishedCards.items.length > 0 ? (
          <div className="flex min-w-0 flex-col gap-4">
            <p className="font-mono text-xs text-ink-muted">
              {publishedCards.total}{" "}
              {publishedCards.total === 1 ? "published resource" : "published resources"}
            </p>
            <ResourceGrid resources={publishedCards.items} />
            <PagePagination
              page={publishedCards.page}
              pageSize={publishedCards.pageSize}
              total={publishedCards.total}
              hrefForPage={(nextPage) =>
                dashboardPagePath("/dashboard/resources", nextPage, extra)
              }
            />
          </div>
        ) : (
          <EmptyState
            title="No published resources yet."
            description="Approved public resources will appear here as cards."
            action={
              <ButtonLink href="/submit" size="sm">
                Submit a resource
              </ButtonLink>
            }
          />
        )
      ) : (
        <DashboardResourceList
          list={list}
          hrefForPage={(nextPage) => dashboardPagePath("/dashboard/resources", nextPage, extra)}
          emptyTitle="You haven't submitted any resources yet."
          emptyDescription="Create a draft, upload your files, and send it for Site Admin review."
        />
      )}
    </>
  );
}
