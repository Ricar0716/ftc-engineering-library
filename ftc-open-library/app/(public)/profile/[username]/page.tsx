import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileResources } from "@/components/profile/profile-resources";
import { ProfileStats } from "@/components/profile/profile-stats";
import { getPublicProfileByUsername } from "@/lib/db/profiles";
import { countPublishedResources, listPublishedResources } from "@/lib/db/resources";
import { parseIdentityPage } from "@/lib/identity/paths";
import { siteConfig } from "@/lib/config/site";
import { publicPageMetadata, truncateSeoText } from "@/lib/seo/metadata";

type ProfilePageProps = {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const page = parseIdentityPage(await searchParams);
  const profile = await getPublicProfileByUsername(username);

  if (!profile) {
    notFound();
  }

  const description = truncateSeoText(
    profile.bio,
    `${profile.displayName} on ${siteConfig.name}.`,
  );

  return publicPageMetadata({
    title: profile.displayName,
    description,
    path: `/profile/${profile.username}`,
    type: "profile",
    index: page <= 1,
    imagePath: profile.avatarUrl,
  });
}

export default async function ProfilePage({ params, searchParams }: ProfilePageProps) {
  const { username } = await params;
  const page = parseIdentityPage(await searchParams);
  const profile = await getPublicProfileByUsername(username);

  if (!profile) {
    notFound();
  }

  const [counts, list] = await Promise.all([
    countPublishedResources({ authorId: profile.id }),
    listPublishedResources({
      authorId: profile.id,
      sort: "latest",
      page,
    }),
  ]);

  return (
    <main id="main-content">
      <Container width="wide" className="min-w-0 py-10">
        <ProfileHeader profile={profile} />
        <ProfileStats counts={counts} />
        <ProfileResources username={profile.username} list={list} />
      </Container>
    </main>
  );
}
