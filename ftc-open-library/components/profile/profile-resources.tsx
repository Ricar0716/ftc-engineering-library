import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { PagePagination } from "@/components/ui/page-pagination";
import { ResourceGrid } from "@/components/resources/resource-grid";
import { identityPath } from "@/lib/identity/paths";
import type { PublishedResourceList } from "@/lib/db/resources";

export function ProfileResources({
  username,
  list,
}: {
  username: string;
  list: PublishedResourceList;
}) {
  const pathname = `/profile/${username}`;

  return (
    <section className="flex min-w-0 flex-col gap-4 py-10">
      <h2 className="text-lg font-medium">Published resources</h2>
      {list.items.length > 0 ? (
        <>
          <ResourceGrid resources={list.items} />
          <PagePagination
            page={list.page}
            pageSize={list.pageSize}
            total={list.total}
            hrefForPage={(page) => identityPath(pathname, page)}
          />
        </>
      ) : (
        <EmptyState
          title="No published resources yet."
          description="Public CAD, code, tutorials, and models from this contributor will appear here."
          action={
            <ButtonLink href="/explore" variant="secondary" size="sm">
              Explore resources
            </ButtonLink>
          }
        />
      )}
    </section>
  );
}
