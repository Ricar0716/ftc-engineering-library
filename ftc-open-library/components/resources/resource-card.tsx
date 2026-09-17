import Link from "next/link";
import { ResourceTypePlaceholder } from "@/components/discovery/resource-type-placeholder";
import { Card } from "@/components/ui/card";
import { ResourceStats } from "@/components/resources/resource-stats";
import { ResourceTypeBadge } from "@/components/resources/resource-type-badge";
import { publicCardImageUrl } from "@/lib/discovery/thumbnail";
import type { ResourceSummary } from "@/types/resources";

export function ResourceCard({
  resource,
  href,
}: {
  resource: ResourceSummary;
  href?: string;
}) {
  const imageUrl = publicCardImageUrl(resource.thumbnailUrl);
  const to = href ?? `/resources/${resource.slug}`;
  const visibleTags = (resource.tags ?? []).slice(0, 3);
  const teamLabel = resource.teamName
    ? resource.teamSlug
      ? `Team ${resource.teamSlug}`
      : resource.teamName
    : null;
  const meta = [teamLabel ?? resource.author?.displayName, resource.categoryName, resource.seasonLabel].filter(
    (value): value is string => Boolean(value),
  );

  return (
    <Card className="group h-full overflow-hidden shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-accent/50 hover:shadow-md">
      <Link href={to} className="flex h-full min-w-0 flex-col">
        <div className="relative aspect-[16/9] overflow-hidden bg-canvas">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            />
          ) : (
            <ResourceTypePlaceholder type={resource.resourceType} />
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 break-words text-base font-medium leading-6 text-ink line-clamp-2">
              {resource.title}
            </h3>
            <span className="mt-0.5 shrink-0">
              <ResourceTypeBadge type={resource.resourceType} />
            </span>
          </div>
          {resource.description ? (
            <p className="line-clamp-2 text-sm leading-6 text-ink-muted">{resource.description}</p>
          ) : null}
          {meta.length > 0 ? (
            <p className="min-w-0 truncate font-mono text-xs text-ink-muted" title={meta.join(" · ")}>
              {meta.join(" · ")}
            </p>
          ) : null}
          <ResourceStats resource={resource} />
          {visibleTags.length > 0 ? (
            <ul className="mt-auto flex flex-wrap gap-1.5 pt-1">
              {visibleTags.map((tag) => (
                <li
                  key={tag.slug}
                  className="max-w-full truncate rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-muted"
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
