import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardStatCard } from "@/components/dashboard/dashboard-stats";
import { ResourceGrid } from "@/components/resources/resource-grid";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentAccess } from "@/lib/auth/session";
import { isDiscussionEnabled } from "@/lib/config/features";
import { getDashboardCounts, listOwnPublishedResourceCards } from "@/lib/dashboard/queries";

export const metadata = {
  title: "Dashboard",
  description: "Manage your resources, drafts, and saved items.",
};

export default async function DashboardPage() {
  const access = await getCurrentAccess();
  const userId = access.userId;
  const [counts, published] = await Promise.all([
    userId
      ? getDashboardCounts(userId)
      : Promise.resolve({
          published: 0,
          drafts: 0,
          pendingReviews: 0,
          saved: 0,
          questions: 0,
          replies: 0,
        }),
    userId
      ? listOwnPublishedResourceCards(userId, 1, 3)
      : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 3 }),
  ]);
  const preview = published.items;

  return (
    <>
      <DashboardHeader
        title="Overview"
        description="Your FTC Open Library workspace. Unpublished work stays private until a Site Admin approves it."
      />

      {!access.emailVerified ? (
        <p className="rounded-lg border border-line bg-accent-soft px-4 py-3 text-sm text-ink">
          Verify your email to submit resources and save items.{" "}
          <a href="/verify" className="underline">
            Verify email
          </a>
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardStatCard
          label="Published"
          value={counts.published}
          href="/dashboard/resources?status=published"
          description="Resources that are live in the public catalog."
        />
        <DashboardStatCard
          label="Drafts"
          value={counts.drafts}
          href="/dashboard/drafts"
          description="Drafts and changes requested by a reviewer."
        />
        <DashboardStatCard
          label="Pending reviews"
          value={counts.pendingReviews}
          href="/dashboard/reviews"
          description="First publishes and new versions waiting for a Site Admin."
        />
        <DashboardStatCard
          label="Saved"
          value={counts.saved}
          href="/dashboard/favorites"
          description="Published resources you marked to revisit."
        />
        {isDiscussionEnabled() ? (
          <>
            <DashboardStatCard
              label="Questions"
              value={counts.questions}
              href="/dashboard/discussions"
              description="Discussion threads you started on published resources."
            />
            <DashboardStatCard
              label="Replies"
              value={counts.replies}
              href="/dashboard/discussions"
              description="Replies you posted on published resources."
            />
          </>
        ) : null}
      </section>

      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium text-ink">Published resources</h2>
          <ButtonLink href="/submit" size="sm">
            Submit a resource
          </ButtonLink>
        </div>
        {preview.length > 0 ? (
          <>
            <ResourceGrid resources={preview} className="lg:grid-cols-3" />
            {published.total > preview.length ? (
              <ButtonLink href="/dashboard/resources?status=published" variant="secondary" size="sm">
                View all published
              </ButtonLink>
            ) : null}
          </>
        ) : (
          <EmptyState
            title="No published resources yet."
            description="Create a draft, upload files, and submit it for Site Admin review."
            action={
              <ButtonLink href="/submit" size="sm">
                Submit a resource
              </ButtonLink>
            }
          />
        )}
      </section>
    </>
  );
}
