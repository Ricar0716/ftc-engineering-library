import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardVersionRow } from "@/components/dashboard/dashboard-version-row";
import { EmptyState } from "@/components/ui/empty-state";
import { PagePagination } from "@/components/ui/page-pagination";
import { getCurrentAccess } from "@/lib/auth/session";
import { dashboardPagePath } from "@/lib/dashboard/nav";
import { listOwnDashboardVersions } from "@/lib/dashboard/queries";
import { parseIdentityPage } from "@/lib/identity/paths";

export const metadata = {
  title: "Versions",
  description: "Version history for resources you created.",
};

export default async function DashboardVersionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getCurrentAccess();
  const page = parseIdentityPage(await searchParams);
  const list = access.userId
    ? await listOwnDashboardVersions(access.userId, page)
    : { items: [], total: 0, page, pageSize: 20 };

  return (
    <>
      <DashboardHeader
        title="Versions"
        description="Your resource versions. Published releases are public; drafts stay private until a reviewer approves them."
      />
      {list.items.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-3">
          <p className="font-mono text-xs text-ink-muted">
            {list.total} {list.total === 1 ? "version" : "versions"}
          </p>
          <ul className="flex flex-col gap-3">
            {list.items.map((version) => (
              <li key={version.id}>
                <DashboardVersionRow version={version} />
              </li>
            ))}
          </ul>
          <PagePagination
            page={list.page}
            pageSize={list.pageSize}
            total={list.total}
            hrefForPage={(nextPage) => dashboardPagePath("/dashboard/versions", nextPage)}
          />
        </div>
      ) : (
        <EmptyState
          title="No versions yet."
          description="Creating a resource starts version 1. New versions of published work appear here after you create them."
        />
      )}
    </>
  );
}
