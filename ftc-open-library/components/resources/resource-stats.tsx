import { formatCompactCount, formatRatingAverage, hasPublicRating } from "@/lib/utils/format-count";
import type { ResourceSummary } from "@/types/resources";

function StatIcon({ path }: { path: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 fill-current">
      <path d={path} />
    </svg>
  );
}

export function ResourceStats({ resource }: { resource: ResourceSummary }) {
  const rated = hasPublicRating(resource);
  const ratingAverage = resource.ratingAverage;
  const ratingCount = resource.ratingCount ?? 0;
  const favorites =
    resource.favoriteCount != null && resource.favoriteCount > 0
      ? formatCompactCount(resource.favoriteCount)
      : null;
  const downloads =
    resource.downloadCount != null && resource.downloadCount > 0
      ? formatCompactCount(resource.downloadCount)
      : null;

  if (!rated && !favorites && !downloads) {
    return null;
  }

  return (
    <ul className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-ink-muted">
      {rated && ratingAverage != null ? (
        <li className="inline-flex min-w-0 items-center gap-1">
          <StatIcon path="M8 1.2 9.9 5.1l4.3.4-3.2 2.8.9 4.2L8 10.6 3.9 12.5l.9-4.2L1.6 5.5l4.3-.4L8 1.2Z" />
          <span aria-hidden="true">
            {formatRatingAverage(ratingAverage)}
            {ratingCount > 0 ? ` (${formatCompactCount(ratingCount)})` : ""}
          </span>
          <span className="sr-only">
            Rated {formatRatingAverage(ratingAverage)} out of 5 from {ratingCount}{" "}
            {ratingCount === 1 ? "rating" : "ratings"}
          </span>
        </li>
      ) : null}
      {favorites ? (
        <li className="inline-flex min-w-0 items-center gap-1">
          <StatIcon path="M8 14.2 2.6 9.1A3.4 3.4 0 0 1 8 4.3a3.4 3.4 0 0 1 5.4 4.8L8 14.2Z" />
          <span aria-hidden="true">{favorites}</span>
          <span className="sr-only">
            {favorites} {resource.favoriteCount === 1 ? "favorite" : "favorites"}
          </span>
        </li>
      ) : null}
      {downloads ? (
        <li className="inline-flex min-w-0 items-center gap-1">
          <StatIcon path="M8 2v8.2L5.4 7.6 4.3 8.7 8 12.4l3.7-3.7-1.1-1.1L8 10.2V2H8Zm-5 11v1.5h10V13H3Z" />
          <span aria-hidden="true">{downloads}</span>
          <span className="sr-only">
            {downloads} {resource.downloadCount === 1 ? "download" : "downloads"}
          </span>
        </li>
      ) : null}
    </ul>
  );
}
