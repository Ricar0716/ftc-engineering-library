const compactCount = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const exactCount = new Intl.NumberFormat("en-US");

/** Compact whole-number display for social-proof counts. */
export function formatCompactCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0";
  }

  const normalized = Math.round(value);
  return normalized >= 1000 ? compactCount.format(normalized) : exactCount.format(normalized);
}

export function formatRatingAverage(value: number): string {
  return value.toFixed(1);
}

export function hasPublicRating(
  resource: {
    ratingAverage?: number | null;
    ratingCount?: number | null;
  },
): boolean {
  return (
    (resource.ratingCount ?? 0) > 0 &&
    resource.ratingAverage != null &&
    Number.isFinite(resource.ratingAverage) &&
    resource.ratingAverage > 0
  );
}
