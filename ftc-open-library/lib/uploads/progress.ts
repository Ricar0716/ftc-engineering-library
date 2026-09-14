/**
 * Convert TUS/standard byte counts into a display percentage.
 * Unknown or zero totals are 0, never NaN or > 100.
 */
export function uploadProgressPercent(uploadedBytes: number, totalBytes: number): number {
  if (!Number.isFinite(uploadedBytes) || uploadedBytes <= 0) {
    return 0;
  }
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round((uploadedBytes / totalBytes) * 100)));
}
