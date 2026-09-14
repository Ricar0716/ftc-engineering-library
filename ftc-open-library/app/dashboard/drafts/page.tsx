import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardResourceList } from "@/components/dashboard/dashboard-resource-list";
import { getCurrentAccess } from "@/lib/auth/session";
import { dashboardPagePath } from "@/lib/dashboard/nav";
import { listOwnDashboardResources } from "@/lib/dashboard/queries";
import { parseIdentityPage } from "@/lib/identity/paths";

export const metadata = {
  title: "Drafts",
  description: "Continue editing drafts and resources that need changes.",
};

export default async function DashboardDraftsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getCurrentAccess();
  const page = parseIdentityPage(await searchParams);
  const list = access.userId
    ? await listOwnDashboardResources(access.userId, "drafts", page)
    : { items: [], total: 0, page, pageSize: 20 };

  return (
    <>
      <DashboardHeader
        title="Drafts"
        description="Drafts and resources sent back for changes. Continue editing from here — this is not a full editor."
      />
      <DashboardResourceList
        list={list}
        hrefForPage={(nextPage) => dashboardPagePath("/dashboard/drafts", nextPage)}
        emptyTitle="No drafts right now."
        emptyDescription="Start a draft when you are ready to contribute. Nothing becomes public until a Site Admin approves it."
      />
    </>
  );
}
