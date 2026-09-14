import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { teamHref, teamIdentityLabel } from "@/lib/identity/paths";
import type { ResourceDetail, ResourceVersionSummary } from "@/types/resources";
import { formatDisplayDate } from "@/lib/utils/dates";
import { displayVersionName } from "@/lib/versioning/validation";

export function ResourceMetadata({
  resource,
  latest,
}: {
  resource: ResourceDetail;
  latest: ResourceVersionSummary | null;
}) {
  const downloads =
    resource.downloadCount != null && resource.downloadCount > 0
      ? new Intl.NumberFormat("en-US").format(resource.downloadCount)
      : null;
  const published = formatDisplayDate(resource.publishedAt);
  const updated = formatDisplayDate(resource.updatedAt);
  const isLatest = Boolean(latest && resource.versions[0]?.id === latest.id);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {latest ? (
        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="text-sm font-medium">{isLatest ? "Latest version" : "This version"}</h2>
          <dl className="mt-3 space-y-2 font-mono text-xs text-ink-muted">
            <div>
              <dt className="text-ink">Version</dt>
              <dd>{displayVersionName(latest)}</dd>
            </div>
            <div>
              <dt className="text-ink">Released</dt>
              <dd>{formatDisplayDate(latest.releasedAt ?? latest.createdAt) ?? "Unknown"}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {resource.versions.length > 1 ? (
        <p className="text-sm text-ink-muted">
          <a href="#versions" className="hover:text-ink">
            View version history
          </a>
        </p>
      ) : null}

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-medium">Competition</h2>
        <dl className="mt-3 space-y-3 text-sm">
          {resource.seasonLabel ? (
            <div>
              <dt className="font-mono text-xs text-ink-muted">Season</dt>
              <dd>
                <Link href={`/explore?season=${resource.seasonLabel}`} className="hover:text-ink">
                  {resource.seasonLabel}
                </Link>
              </dd>
            </div>
          ) : null}
          {resource.teamSlug ? (
            <div>
              <dt className="font-mono text-xs text-ink-muted">Team</dt>
              <dd>
                <Link href={teamHref(resource.teamSlug)} className="hover:text-ink">
                  {teamIdentityLabel(resource.teamSlug)}
                  {resource.teamName ? ` · ${resource.teamName}` : ""}
                </Link>
              </dd>
            </div>
          ) : null}
          {resource.license ? (
            <div>
              <dt className="font-mono text-xs text-ink-muted">License</dt>
              <dd>
                {resource.license.url ? (
                  <a
                    href={resource.license.url}
                    className="text-accent hover:text-accent-hover"
                    rel="noreferrer"
                    target="_blank"
                  >
                    {resource.license.name}
                  </a>
                ) : (
                  resource.license.name
                )}
              </dd>
            </div>
          ) : null}
          {!resource.seasonLabel && !resource.teamSlug && !resource.license ? (
            <p className="text-sm text-ink-muted">No competition metadata attached.</p>
          ) : null}
        </dl>
      </section>

      {(downloads || published || updated) ? (
        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="text-sm font-medium">Activity</h2>
          <dl className="mt-3 space-y-3 font-mono text-xs text-ink-muted">
            {downloads ? (
              <div>
                <dt className="text-ink">Downloads</dt>
                <dd>{downloads}</dd>
              </div>
            ) : null}
            {published ? (
              <div>
                <dt className="text-ink">Published</dt>
                <dd>{published}</dd>
              </div>
            ) : null}
            {updated ? (
              <div>
                <dt className="text-ink">Updated</dt>
                <dd>{updated}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      {resource.hardware.length > 0 ? (
        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="text-sm font-medium">Hardware</h2>
          <p className="mt-1 text-xs leading-5 text-ink-muted">
            Vendors and fabrication tags attached to this resource.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {resource.hardware.map((item) => (
              <li
                key={item.slug}
                className="rounded-md border border-line px-2 py-1 font-mono text-xs text-ink-muted"
              >
                {item.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ButtonLink href="/explore" variant="secondary">
        Back to explore
      </ButtonLink>
    </div>
  );
}
