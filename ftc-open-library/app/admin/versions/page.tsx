import Link from "next/link";
import { AdminHeader } from "@/components/admin/admin-header";
import { VersionReviewList } from "@/components/admin/versions/version-review-list";
import {
  ADMIN_VERSION_FILTER_LABELS,
  ADMIN_VERSION_FILTERS,
  adminVersionsPath,
  parseAdminVersionFilter,
  parseAdminVersionPage,
} from "@/lib/admin/versions/params";
import { listAdminModerationVersions } from "@/lib/admin/versions/queries";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Version review",
  description: "New versions of published resources awaiting Site Admin review.",
};

export default async function AdminVersionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const filter = parseAdminVersionFilter(query);
  const page = parseAdminVersionPage(query);
  const list = await listAdminModerationVersions(filter, page);

  return (
    <>
      <AdminHeader
        eyebrow="Site Admin"
        title="Version review"
        description="New versions of already-published resources. Approving a version does not unpublish the resource or rewrite older releases."
      />
      <div className="flex flex-col gap-4">
        <nav aria-label="Filter by version status" className="flex flex-wrap gap-1">
          {ADMIN_VERSION_FILTERS.map((value) => {
            const href = adminVersionsPath(1, { status: value });
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
                {ADMIN_VERSION_FILTER_LABELS[value]}
              </Link>
            );
          })}
        </nav>
        <VersionReviewList
          list={list}
          filter={filter}
          hrefForPage={(nextPage) => adminVersionsPath(nextPage, { status: filter })}
        />
      </div>
    </>
  );
}
