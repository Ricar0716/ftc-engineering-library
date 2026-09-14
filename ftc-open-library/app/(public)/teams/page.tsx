import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { TeamCard } from "@/components/teams/team-card";
import { listPublicTeams } from "@/lib/db/teams";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = publicPageMetadata({
  title: "FTC Teams",
  description: "Browse FTC teams and the resources they have published.",
  path: "/teams",
});

export default async function TeamsPage() {
  const teams = await listPublicTeams();

  return (
    <main id="main-content">
      <PageHeader
        eyebrow="Community"
        title="Teams"
        description="Public team pages and the published resources attached to them."
      />
      <Container width="wide" className="pb-16">
        {teams.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <li key={team.id}>
                <TeamCard team={team} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No public teams yet"
            description="Public team pages will appear here as teams join the library."
          />
        )}
      </Container>
    </main>
  );
}
