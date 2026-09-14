import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PagePagination } from "@/components/ui/page-pagination";
import { ResourceGrid } from "@/components/resources/resource-grid";
import { identityPath, parseIdentityPage } from "@/lib/identity/paths";
import { requireVerifiedPage } from "@/lib/auth/session";
import { listOwnPublishedFavorites } from "@/lib/favorites/queries";

export const metadata = {
  title: "Saved resources",
  description: "Resources you saved to learn later.",
};

type FavoritesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardFavoritesPage({ searchParams }: FavoritesPageProps) {
  await requireVerifiedPage("/dashboard/favorites", "save");
  const page = parseIdentityPage(await searchParams);
  const list = await listOwnPublishedFavorites(page);

  return (
    <>
      <DashboardHeader
        title="Saved Resources"
        description="Published resources you marked to revisit. Drafts and unpublished work never appear here."
      />
      {list.items.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-4">
          <p className="font-mono text-xs text-ink-muted">
            {list.total} {list.total === 1 ? "saved resource" : "saved resources"}
          </p>
          <ResourceGrid resources={list.items} />
          <PagePagination
            page={list.page}
            pageSize={list.pageSize}
            total={list.total}
            hrefForPage={(nextPage) => identityPath("/dashboard/favorites", nextPage)}
          />
        </div>
      ) : (
        <EmptyState
          title="No saved resources yet."
          description="Open a published resource and choose Save to keep it here."
        />
      )}
    </>
  );
}
