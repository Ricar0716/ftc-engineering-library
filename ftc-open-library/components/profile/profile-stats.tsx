import { RESOURCE_TYPE_LABELS, RESOURCE_TYPES } from "@/lib/constants/resources";
import type { PublishedResourceCounts } from "@/lib/db/resources";

export function ProfileStats({ counts }: { counts: PublishedResourceCounts }) {
  return (
    <section aria-label="Contribution summary" className="border-b border-line py-6">
      <h2 className="text-lg font-medium">Contributions</h2>
      <dl className="mt-4 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border border-line bg-surface p-3">
          <dt className="font-mono text-xs text-ink-muted">Published</dt>
          <dd className="mt-1 text-xl font-medium tabular-nums">
            {new Intl.NumberFormat("en-US").format(counts.total)}
          </dd>
        </div>
        {RESOURCE_TYPES.map((type) => (
          <div key={type} className="rounded-lg border border-line bg-surface p-3">
            <dt className="font-mono text-xs text-ink-muted">{RESOURCE_TYPE_LABELS[type]}</dt>
            <dd className="mt-1 text-xl font-medium tabular-nums">
              {new Intl.NumberFormat("en-US").format(counts.byType[type])}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
