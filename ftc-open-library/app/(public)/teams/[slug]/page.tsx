import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { TeamHeader } from "@/components/teams/team-header";
import { TeamResources } from "@/components/teams/team-resources";
import { TeamStats } from "@/components/teams/team-stats";
import {
  countPublishedResources,
  listPublishedSeasonLabels,
} from "@/lib/db/resources";
import { getTeamBySlug, listTeamResources } from "@/lib/db/teams";
import { parseIdentityPage } from "@/lib/identity/paths";
import { siteConfig } from "@/lib/config/site";
import { publicPageMetadata, truncateSeoText } from "@/lib/seo/metadata";

type TeamPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: TeamPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = parseIdentityPage(await searchParams);
  const team = await getTeamBySlug(slug);

  if (!team) {
    notFound();
  }

  const description = truncateSeoText(
    team.description,
    `${team.name} (${team.teamNumber}) on ${siteConfig.name}.`,
  );

  return publicPageMetadata({
    title: `FTC Team ${team.teamNumber}`,
    description,
    path: `/teams/${team.teamNumber}`,
    index: page <= 1,
    imagePath: team.logoUrl,
  });
}

export default async function TeamPage({ params, searchParams }: TeamPageProps) {
  const { slug } = await params;
  const page = parseIdentityPage(await searchParams);
  const team = await getTeamBySlug(slug);

  if (!team) {
    notFound();
  }

  const [counts, seasons, list] = await Promise.all([
    countPublishedResources({ teamId: team.id }),
    listPublishedSeasonLabels({ teamId: team.id }),
    listTeamResources(team.id, page),
  ]);

  return (
    <main id="main-content">
      <Container width="wide" className="min-w-0 py-10">
        <TeamHeader team={team} />
        <TeamStats counts={counts} seasons={seasons} />
        <TeamResources teamNumber={team.teamNumber} list={list} />
        <ButtonLink href="/teams" variant="secondary">
          Back to teams
        </ButtonLink>
      </Container>
    </main>
  );
}
