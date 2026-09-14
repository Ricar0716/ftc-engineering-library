import { RESOURCE_TYPE_LABELS, RESOURCE_TYPES } from "@/lib/constants/resources";
import type { PublishedResourceCounts } from "@/lib/db/resources";

export function TeamStats({
  counts,
  seasons,
}: {
  counts: PublishedResourceCounts;
  seasons: string[];
}) {
  const types = RESOURCE_TYPES.filter((type) => counts.byType[type] > 0);

  return (
    <section aria-label="Team statistics" className="border-b border-line py-6">
      <h2 className="text-lg font-medium">Team statistics</h2>
      <dl className="mt-4 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface p-3">
          <dt className="font-mono text-xs text-ink-muted">Published resources</dt>
          <dd className="mt-1 text-xl font-medium tabular-nums">
            {new Intl.NumberFormat("en-US").format(counts.total)}
          </dd>
        </div>
        <div className="rounded-lg border border-line bg-surface p-3">
          <dt className="font-mono text-xs text-ink-muted">Resource types</dt>
          <dd className="mt-1 text-sm font-medium">
            {types.length > 0 ? types.map((type) => RESOURCE_TYPE_LABELS[type]).join(" · ") : "None yet"}
          </dd>
        </div>
        <div className="col-span-2 rounded-lg border border-line bg-surface p-3 sm:col-span-1">
          <dt className="font-mono text-xs text-ink-muted">Seasons</dt>
          <dd className="mt-1 text-sm font-medium">
            {seasons.length > 0 ? seasons.join(" · ") : "None yet"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
