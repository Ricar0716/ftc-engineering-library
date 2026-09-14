import Link from "next/link";
import { ResourceTypePlaceholder } from "@/components/discovery/resource-type-placeholder";
import { Card } from "@/components/ui/card";
import { ResourceTypeBadge } from "@/components/resources/resource-type-badge";
import { publicCardImageUrl } from "@/lib/discovery/thumbnail";
import { formatDisplayDate } from "@/lib/utils/dates";
import type { ResourceSummary } from "@/types/resources";

function formatCount(value: number | null | undefined): string | null {
  if (value == null || value <= 0) {
    return null;
  }
  return new Intl.NumberFormat("en-US").format(value);
}

export function ResourceCard({
  resource,
  href,
}: {
  resource: ResourceSummary;
  href?: string;
}) {
  const downloads = formatCount(resource.downloadCount);
  const updated = formatDisplayDate(resource.updatedAt ?? resource.publishedAt);
  const authorLabel = resource.author?.displayName ?? null;
  const visibleTags = (resource.tags ?? []).slice(0, 3);
  const imageUrl = publicCardImageUrl(resource.thumbnailUrl);
  const to = href ?? `/resources/${resource.slug}`;

  return (
    <Card className="overflow-hidden transition-colors hover:border-accent/40">
      <Link href={to} className="block h-full min-w-0">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="aspect-[16/9] w-full object-cover bg-canvas" />
        ) : (
          <ResourceTypePlaceholder type={resource.resourceType} />
        )}
        <div className="flex min-w-0 flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 break-words text-base font-medium leading-6 text-ink">{resource.title}</h3>
            <ResourceTypeBadge type={resource.resourceType} />
          </div>
          <p className="line-clamp-2 text-sm leading-6 text-ink-muted">{resource.description}</p>
          <dl className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-ink-muted">
            {authorLabel ? (
              <div className="min-w-0">
                <dt className="sr-only">Author</dt>
                <dd className="truncate">{authorLabel}</dd>
              </div>
            ) : null}
            {resource.teamName ? (
              <div className="min-w-0">
                <dt className="sr-only">Team</dt>
                <dd className="truncate">{resource.teamName}</dd>
              </div>
            ) : null}
            {resource.categoryName ? (
              <div className="min-w-0">
                <dt className="sr-only">Category</dt>
                <dd className="truncate">{resource.categoryName}</dd>
              </div>
            ) : null}
            {updated ? (
              <div>
                <dt className="sr-only">Updated</dt>
                <dd>Updated {updated}</dd>
              </div>
            ) : null}
            {downloads ? (
              <div>
                <dt className="sr-only">Downloads</dt>
                <dd>{downloads} downloads</dd>
              </div>
            ) : null}
          </dl>
          {visibleTags.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {visibleTags.map((tag) => (
                <li
                  key={tag.slug}
                  className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-muted"
                >
                  {tag.name}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Link>
    </Card>
  );
}
