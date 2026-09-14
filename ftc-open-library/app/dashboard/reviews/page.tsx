import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardResourceList } from "@/components/dashboard/dashboard-resource-list";
import { DashboardVersionRow } from "@/components/dashboard/dashboard-version-row";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentAccess } from "@/lib/auth/session";
import { dashboardPagePath } from "@/lib/dashboard/nav";
import { listOwnDashboardResources, listOwnPendingRevisionRows } from "@/lib/dashboard/queries";
import { parseIdentityPage } from "@/lib/identity/paths";

export const metadata = {
  title: "Reviews",
  description: "Your submissions and versions waiting for Site Admin review.",
};

export default async function DashboardReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getCurrentAccess();
  const page = parseIdentityPage(await searchParams);
  const userId = access.userId;
  const [resources, versions] = await Promise.all([
    userId
      ? listOwnDashboardResources(userId, "reviews", page)
      : Promise.resolve({ items: [], total: 0, page, pageSize: 20 }),
    userId ? listOwnPendingRevisionRows(userId) : Promise.resolve([]),
  ]);

  return (
    <>
      <DashboardHeader
        title="Reviews"
        description="You can watch status here. You cannot publish these yourself — a Site Admin has to approve them."
      />

      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">First publish</h2>
        <DashboardResourceList
          list={resources}
          hrefForPage={(nextPage) => dashboardPagePath("/dashboard/reviews", nextPage)}
          emptyTitle="No resources waiting for first publish."
          emptyDescription="When you submit a draft, it appears here until a Site Admin decides."
        />
      </section>

      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">New versions</h2>
        {versions.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {versions.map((version) => (
              <li key={version.id}>
                <DashboardVersionRow version={version} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No versions waiting for review."
            description="After a resource is published, new versions stay private until they are approved."
          />
        )}
      </section>
    </>
  );
}
