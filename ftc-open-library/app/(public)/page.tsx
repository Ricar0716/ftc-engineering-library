import type { Metadata } from "next";
import { BrowseByType } from "@/components/discovery/browse-by-type";
import { CategorySection } from "@/components/discovery/category-section";
import { ContributeCta } from "@/components/discovery/contribute-cta";
import { FeaturedResources } from "@/components/discovery/featured-resources";
import { HomepageHero } from "@/components/discovery/homepage-hero";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { TeamCard } from "@/components/teams/team-card";
import { siteConfig } from "@/lib/config/site";
import { getCurrentAccess } from "@/lib/auth/session";
import { getLatestResourcesByType, listPublishedResources } from "@/lib/db/resources";
import { listPublicTeams } from "@/lib/db/teams";
import { DISCOVERY_EMPTY } from "@/lib/discovery/empty";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...publicPageMetadata({
    title: siteConfig.name,
    description: siteConfig.description,
    path: "/",
  }),
  title: { absolute: siteConfig.name },
};

export default async function HomePage() {
  const [featured, cad, code, tutorials, models, teams, access] = await Promise.all([
    listPublishedResources({ sort: "latest", page: 1, pageSize: 6 }),
    getLatestResourcesByType("CAD", 3),
    getLatestResourcesByType("CODE", 3),
    getLatestResourcesByType("TUTORIAL", 3),
    getLatestResourcesByType("MODEL", 3),
    listPublicTeams(4),
    getCurrentAccess(),
  ]);

  return (
    <main id="main-content">
      <HomepageHero access={access} publishedCount={featured.total} />

      <Container width="wide" className="flex min-w-0 flex-col gap-12 py-12">
        <BrowseByType />
        {featured.total === 0 ? (
          <EmptyState
            title={DISCOVERY_EMPTY.library}
            description={DISCOVERY_EMPTY.launch}
            action={
              <ButtonLink href="/explore" variant="secondary" size="sm">
                Explore resources
              </ButtonLink>
            }
          />
        ) : (
          <>
            <FeaturedResources resources={featured.items} />
            <CategorySection type="CAD" resources={cad} />
            <CategorySection type="CODE" resources={code} />
            <CategorySection type="TUTORIAL" resources={tutorials} />
            <CategorySection type="MODEL" resources={models} />
          </>
        )}

        {teams.length > 0 ? (
          <section className="flex min-w-0 flex-col gap-4">
            <div className="flex min-w-0 items-end justify-between gap-3">
              <h2 className="text-xl font-medium">Teams</h2>
              <ButtonLink href="/teams" variant="ghost" size="sm">
                Browse teams
              </ButtonLink>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {teams.map((team) => (
                <li key={team.id}>
                  <TeamCard team={team} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </Container>

      <ContributeCta access={access} />
    </main>
  );
}
