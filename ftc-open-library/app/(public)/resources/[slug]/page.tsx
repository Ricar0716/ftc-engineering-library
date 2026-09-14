import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResourceDiscussion } from "@/components/discussion/resource-discussion";
import { ResourcePreview } from "@/components/previews/resource-preview";
import { ResourceActions } from "@/components/resources/resource-actions";
import { ResourceAuthorCard } from "@/components/resources/resource-author-card";
import { ResourceDescription } from "@/components/resources/resource-description";
import { ResourceFileExplorer } from "@/components/resources/resource-file-explorer";
import { ResourceHero } from "@/components/resources/resource-hero";
import { ResourceMetadata } from "@/components/resources/resource-metadata";
import { ResourcePreviewCard } from "@/components/resources/resource-preview-card";
import { ResourceRelated } from "@/components/resources/resource-related";
import { ResourceJsonLd } from "@/components/seo/resource-json-ld";
import { Container } from "@/components/ui/container";
import { VersionHistory } from "@/components/versioning/version-history";
import { VersionSelector } from "@/components/versioning/version-selector";
import { getCurrentAccess } from "@/lib/auth/session";
import { isDiscussionEnabled } from "@/lib/config/features";
import { RESOURCE_TYPE_LABELS } from "@/lib/constants/resources";
import { getResourceBySlug } from "@/lib/db/resources";
import { parseDiscussionPage } from "@/lib/discussion/validation";
import { isResourceFavorited } from "@/lib/favorites/queries";
import { DETAIL_EMPTY } from "@/lib/resources/detail-ui";
import { publicPageMetadata, resourceSeoDescription } from "@/lib/seo/metadata";
import { getPublicResourceSeo } from "@/lib/seo/queries";
import { requestedPublishedVersionMissing, selectPublishedVersion } from "@/lib/versioning/queries";
import { parseVersionNumber } from "@/lib/versioning/validation";

type ResourcePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: ResourcePageProps): Promise<Metadata> {
  const { slug } = await params;
  const resource = await getPublicResourceSeo(slug);

  if (!resource) {
    notFound();
  }

  const description = resourceSeoDescription(
    resource.title,
    resource.description,
    resource.resourceType,
  );
  const typeLabel = RESOURCE_TYPE_LABELS[resource.resourceType];

  return publicPageMetadata({
    title: `${resource.title} ${typeLabel}`,
    description,
    path: `/resources/${resource.slug}`,
    type: "article",
    imagePath: resource.thumbnailUrl,
  });
}

export default async function ResourcePage({ params, searchParams }: ResourcePageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const discussionEnabled = isDiscussionEnabled();
  const discussionPage = discussionEnabled ? parseDiscussionPage(query) : 1;
  const requestedVersion = parseVersionNumber(query);
  const [resource, access] = await Promise.all([getResourceBySlug(slug), getCurrentAccess()]);

  if (!resource) {
    notFound();
  }

  const saved = await isResourceFavorited(resource.id);

  const selected = selectPublishedVersion(resource.versions, requestedVersion);
  const selectedFiles = selected
    ? resource.files.filter((file) => file.versionId === selected.id)
    : [];
  const versionUnavailable = requestedPublishedVersionMissing(resource.versions, requestedVersion);
  const seoDescription = resourceSeoDescription(
    resource.title,
    resource.description,
    resource.resourceType,
  );

  return (
    <main id="main-content">
      <ResourceJsonLd
        title={resource.title}
        description={seoDescription}
        slug={resource.slug}
        publishedAt={resource.publishedAt ?? null}
        updatedAt={resource.updatedAt ?? null}
        authorName={resource.authorDisplayName}
        authorUsername={resource.authorUsername}
        teamName={resource.teamName ?? null}
        teamNumber={resource.teamSlug ?? null}
      />
      <Container width="wide" className="py-10">
        <ResourceHero resource={resource} />

        <div className="flex min-w-0 flex-col gap-10 py-8">
          <ResourceActions
            access={access}
            resourceId={resource.id}
            resourceSlug={resource.slug}
            favoriteCount={resource.favoriteCount}
            initialSaved={saved}
          />

          <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex min-w-0 flex-col gap-10">
              <ResourcePreviewCard>
                <div className="flex min-w-0 flex-col gap-3">
                  {versionUnavailable ? (
                    <p role="status" className="text-sm text-ink-muted">
                      {DETAIL_EMPTY.versionUnavailable}
                    </p>
                  ) : null}
                  <VersionSelector
                    slug={resource.slug}
                    versions={resource.versions}
                    selectedId={selected?.id ?? null}
                  />
                  <ResourcePreview
                    resourceType={resource.resourceType}
                    files={selectedFiles}
                    access={access}
                    resourceSlug={resource.slug}
                  />
                </div>
              </ResourcePreviewCard>

              <ResourceDescription
                description={resource.description}
                changelog={selected?.changelog ?? null}
              />

              <section id="files" className="flex min-w-0 scroll-mt-20 flex-col gap-3">
                <h2 className="text-lg font-medium">Files</h2>
                <p className="text-sm text-ink-muted">
                  File names and sizes are listed for everyone. Downloads use a verified session
                  and a short-lived signed URL. The list matches the selected published version.
                </p>
                <ResourceFileExplorer
                  files={selectedFiles}
                  access={access}
                  resourceSlug={resource.slug}
                  resourceType={resource.resourceType}
                />
              </section>
            </div>

            <aside className="flex min-w-0 flex-col gap-6">
              <ResourceAuthorCard resource={resource} />
              <ResourceMetadata resource={resource} latest={selected} />
            </aside>
          </div>

          <VersionHistory
            slug={resource.slug}
            versions={resource.versions}
            selectedId={selected?.id ?? null}
          />

          {discussionEnabled ? (
            <ResourceDiscussion
              resourceId={resource.id}
              resourceSlug={resource.slug}
              resourceAuthorId={resource.authorId}
              access={access}
              page={discussionPage}
            />
          ) : null}

          <ResourceRelated resources={resource.related} />
        </div>
      </Container>
    </main>
  );
}
