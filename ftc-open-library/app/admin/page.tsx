import { AdminHeader } from "@/components/admin/admin-header";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { OrphanCleanupCard } from "@/components/admin/orphan-cleanup-card";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { getAdminOverviewStats } from "@/lib/admin/queries";
import { getUploadHygiene } from "@/lib/admin/storage-actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin",
  description: "Site administration overview for FTC Open Library.",
};

export default async function AdminPage() {
  const [stats, hygiene] = await Promise.all([
    getAdminOverviewStats(),
    getUploadHygiene(),
  ]);

  return (
    <>
      <AdminHeader
        eyebrow="Admin Dashboard"
        title="Overview"
        description="How FTC Open Library is doing right now. Counts come from the database. Management tools for users, discussions, and settings come later."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AdminStatCard
          label="Users"
          value={stats.users}
          description="Registered profiles. User management is not in this step."
        />
        <AdminStatCard
          label="Resources"
          value={stats.resources}
          description="Every resource row, including drafts and archived work."
        />
        <AdminStatCard
          label="Published resources"
          value={stats.publishedResources}
          description="Resources with status Published."
        />
        <AdminStatCard
          label="Pending reviews"
          value={stats.pendingReviews}
          href="/admin/resources?status=pending"
          description="First publishes waiting for a Site Admin decision."
        />
        <AdminStatCard
          label="Pending versions"
          value={stats.pendingVersions}
          href="/admin/versions?status=pending"
          description="New versions of published resources waiting for review."
        />
        <AdminStatCard
          label="Discussions"
          value={stats.discussions}
          description="VISIBLE discussion posts. Moderation stays on the resource page."
        />
      </section>

      {stats.users === 0 && stats.resources === 0 ? (
        <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
          No users or resources yet. Counts stay at zero until the database has rows.
        </p>
      ) : null}

      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-lg font-medium text-ink">Existing tools</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardBody className="flex h-full flex-col gap-3">
              <p className="font-mono text-xs uppercase tracking-wide text-accent">Ready</p>
              <h3 className="text-base font-medium text-ink">Categories</h3>
              <p className="text-sm leading-6 text-ink-muted">
                Create, move, order, and archive the CAD, Code, Tutorial, and Model trees. Public
                filters read these rows directly.
              </p>
              <ButtonLink href="/admin/categories" className="mt-auto w-fit">
                Open category manager
              </ButtonLink>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex h-full flex-col gap-3">
              <p className="font-mono text-xs uppercase tracking-wide text-accent">Ready</p>
              <h3 className="text-base font-medium text-ink">Resource review</h3>
              <p className="text-sm leading-6 text-ink-muted">
                Inspect first-time submissions, preview files, and approve, request changes, or reject.
                Approving a resource does not approve later versions.
              </p>
              <ButtonLink href="/admin/resources?status=pending" className="mt-auto w-fit">
                Open resource review
              </ButtonLink>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex h-full flex-col gap-3">
              <p className="font-mono text-xs uppercase tracking-wide text-accent">Ready</p>
              <h3 className="text-base font-medium text-ink">Version review</h3>
              <p className="text-sm leading-6 text-ink-muted">
                Inspect a new version of a published resource. Approving it promotes that release;
                the previous published version stays available.
              </p>
              <ButtonLink href="/admin/versions?status=pending" className="mt-auto w-fit">
                Open version review
              </ButtonLink>
            </CardBody>
          </Card>
          <OrphanCleanupCard hygiene={hygiene} />
        </div>
      </section>
    </>
  );
}
