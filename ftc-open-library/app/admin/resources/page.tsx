import Link from "next/link";
import { AdminHeader } from "@/components/admin/admin-header";
import { ResourceReviewList } from "@/components/admin/resources/resource-review-list";
import {
  ADMIN_RESOURCE_FILTER_LABELS,
  ADMIN_RESOURCE_FILTERS,
  adminResourcesPath,
  parseAdminResourceFilter,
  parseAdminResourcePage,
} from "@/lib/admin/resources/params";
import { listAdminModerationResources } from "@/lib/admin/resources/queries";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Resource review",
  description: "Resources awaiting Site Admin moderation.",
};

export default async function AdminResourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const filter = parseAdminResourceFilter(query);
  const page = parseAdminResourcePage(query);
  const list = await listAdminModerationResources(filter, page);

  return (
    <>
      <AdminHeader
        eyebrow="Site Admin"
        title="Resource review"
        description="First-time submissions waiting for a decision. Approving a resource publishes it; later versions still need their own review."
      />
      <div className="flex flex-col gap-4">
        <nav aria-label="Filter by review status" className="flex flex-wrap gap-1">
          {ADMIN_RESOURCE_FILTERS.map((value) => {
            const href = adminResourcesPath(1, { status: value });
            const active = value === filter;
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
                {ADMIN_RESOURCE_FILTER_LABELS[value]}
              </Link>
            );
          })}
        </nav>
        <ResourceReviewList
          list={list}
          filter={filter}
          hrefForPage={(nextPage) => adminResourcesPath(nextPage, { status: filter })}
        />
      </div>
    </>
  );
}
