import Link from "next/link";
import { RESOURCE_TYPE_LABELS } from "@/lib/constants/resources";
import {
  buildExplorePath,
  explorePathWith,
  hasActiveExploreFilters,
  type ExploreSearchParams,
} from "@/lib/search/params";

export function ActiveFilters({
  filters,
  categoryLabel,
  tagLabel,
}: {
  filters: ExploreSearchParams;
  categoryLabel?: string | null;
  tagLabel?: string | null;
}) {
  if (!hasActiveExploreFilters(filters)) {
    return null;
  }

  const chips: { key: string; label: string; href: string }[] = [];

  if (filters.q) {
    chips.push({
      key: "q",
      label: `Search: ${filters.q}`,
      href: explorePathWith(filters, { q: "" }),
    });
  }
  if (filters.type) {
    chips.push({
      key: "type",
      label: RESOURCE_TYPE_LABELS[filters.type],
      href: explorePathWith(filters, { type: null }),
    });
  }
  if (filters.category) {
    chips.push({
      key: "category",
      label: categoryLabel ?? "Category",
      href: explorePathWith(filters, { category: null }),
    });
  }
  if (filters.season) {
    chips.push({
      key: "season",
      label: filters.season,
      href: explorePathWith(filters, { season: null }),
    });
  }
  if (filters.tag) {
    chips.push({
      key: "tag",
      label: tagLabel ?? filters.tag,
      href: explorePathWith(filters, { tag: null }),
    });
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <p className="font-mono text-xs uppercase tracking-[0.12em] text-ink-muted">Active</p>
      <ul className="flex min-w-0 flex-wrap gap-2" aria-label="Active filters">
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link
              href={chip.href}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 font-mono text-xs text-ink hover:border-accent/40"
            >
              {chip.label}
              <span aria-hidden="true" className="text-ink-muted">
                ×
              </span>
              <span className="sr-only">Remove {chip.label} filter</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href={buildExplorePath({})}
        className="font-mono text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline"
      >
        Clear filters
      </Link>
    </div>
  );
}
