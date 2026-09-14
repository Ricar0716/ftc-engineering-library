"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { EXPLORE_SORT_OPTIONS, EXPLORE_SORTS, type ExploreSort } from "@/lib/constants/resources";
import { explorePathWith, type ExploreSearchParams } from "@/lib/search/params";

const SORT_FALLBACK_LABELS: Partial<Record<ExploreSort, string>> = {
  relevance: "Most relevant",
  oldest: "Oldest",
  rating: "Highest rated",
};

function isExploreSort(value: string): value is ExploreSort {
  return (EXPLORE_SORTS as readonly string[]).includes(value);
}

export function SortSelector({
  filters,
  className,
}: {
  filters: ExploreSearchParams;
  className?: string;
}) {
  const router = useRouter();
  const options = EXPLORE_SORT_OPTIONS.some((option) => option.value === filters.sort)
    ? EXPLORE_SORT_OPTIONS
    : [
        ...EXPLORE_SORT_OPTIONS,
        {
          value: filters.sort,
          label: SORT_FALLBACK_LABELS[filters.sort] ?? filters.sort,
        },
      ];

  return (
    <div className={className}>
      <Select
        key={`${filters.sort}:${filters.q}:${filters.type}:${filters.category}:${filters.tag}:${filters.season}`}
        label="Sort"
        name="sort"
        id="explore-sort"
        defaultValue={filters.sort}
        onChange={(event) => {
          const value = event.currentTarget.value;
          if (isExploreSort(value)) {
            router.push(explorePathWith(filters, { sort: value }));
          }
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
