import Link from "next/link";
import { formatDisplayDate } from "@/lib/utils/dates";
import { displayVersionName } from "@/lib/versioning/validation";
import type { ResourceVersionSummary } from "@/types/resources";

export function VersionCard({
  version,
  slug,
  latest,
  selected,
}: {
  version: ResourceVersionSummary;
  slug: string;
  latest: boolean;
  selected: boolean;
}) {
  const href = latest ? `/resources/${slug}` : `/resources/${slug}?version=${version.versionNumber}`;
  const released = formatDisplayDate(version.releasedAt ?? version.createdAt);

  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-ink">
          <Link href={href} className="hover:text-accent">
            {displayVersionName(version)}
          </Link>
          {latest ? <span className="ml-2 font-mono text-xs text-accent">Latest</span> : null}
          {selected && !latest ? (
            <span className="ml-2 font-mono text-xs text-ink-muted">Viewing</span>
          ) : null}
        </h3>
        <p className="font-mono text-xs text-ink-muted">Released {released ?? "Unknown"}</p>
      </div>
      {version.changelog ? (
        <div className="mt-3">
          <h4 className="text-xs font-medium uppercase tracking-wide text-ink-muted">Changes</h4>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-ink-muted">{version.changelog}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">No changelog recorded for this version.</p>
      )}
    </article>
  );
}
