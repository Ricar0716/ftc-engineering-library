import Link from "next/link";
import { CategoryBreadcrumb } from "@/components/resources/category-breadcrumb";
import { ResourceTags } from "@/components/resources/resource-tags";
import { ResourceTypeBadge } from "@/components/resources/resource-type-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { RESOURCE_TYPE_LABELS, RESOURCE_TYPE_PURPOSE } from "@/lib/constants/resources";
import { contributorHref, teamHref, teamIdentityLabel } from "@/lib/identity/paths";
import { formatDisplayDate } from "@/lib/utils/dates";
import type { ResourceDetail } from "@/types/resources";

export function ResourceHero({ resource }: { resource: ResourceDetail }) {
  const published = formatDisplayDate(resource.publishedAt);
  const updated = formatDisplayDate(resource.updatedAt);
  const createdBy = resource.authorDisplayName ?? resource.authorUsername;

  return (
    <header className="flex min-w-0 flex-col gap-5 border-b border-line pb-8">
      <nav aria-label="Breadcrumb" className="min-w-0 text-sm text-ink-muted">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <li>
            <Link href="/explore" className="hover:text-ink">
              Explore
            </Link>
          </li>
          <li aria-hidden="true">→</li>
          <li>
            <Link href={`/explore?type=${resource.resourceType}`} className="hover:text-ink">
              {RESOURCE_TYPE_LABELS[resource.resourceType]}
            </Link>
          </li>
          <CategoryBreadcrumb
            resourceType={resource.resourceType}
            items={resource.categoryBreadcrumb}
          />
        </ol>
      </nav>

      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <ResourceTypeBadge type={resource.resourceType} />
        <p className="font-mono text-xs text-ink-muted">
          {RESOURCE_TYPE_PURPOSE[resource.resourceType]}
        </p>
      </div>

      <h1 className="max-w-4xl break-words text-4xl font-medium tracking-tight text-ink sm:text-5xl">
        {resource.title}
      </h1>

      <dl className="flex min-w-0 flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-ink-muted">
        {createdBy && resource.authorUsername ? (
          <div className="flex min-w-0 items-center gap-2">
            <dt className="text-ink">Created by</dt>
            <UserAvatar name={createdBy} src={resource.authorAvatarUrl} size="sm" />
            <dd className="min-w-0 truncate">
              <Link href={contributorHref(resource.authorUsername)} className="hover:text-ink">
                {createdBy}
              </Link>
              <span className="text-ink-muted"> @{resource.authorUsername}</span>
            </dd>
          </div>
        ) : null}
        {resource.teamSlug ? (
          <div className="min-w-0">
            <dt className="sr-only">Team</dt>
            <dd className="truncate">
              <Link href={teamHref(resource.teamSlug)} className="hover:text-ink">
                {teamIdentityLabel(resource.teamSlug)}
              </Link>
            </dd>
          </div>
        ) : null}
        {published ? (
          <div>
            <dt className="sr-only">Published</dt>
            <dd>Published {published}</dd>
          </div>
        ) : null}
        {updated ? (
          <div>
            <dt className="sr-only">Updated</dt>
            <dd>Updated {updated}</dd>
          </div>
        ) : null}
      </dl>

      <ResourceTags tags={resource.tags} />
    </header>
  );
}
