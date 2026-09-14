import type { ResourceVersionSummary } from "@/types/resources";

export function latestPublishedVersion(
  versions: ResourceVersionSummary[],
): ResourceVersionSummary | null {
  return versions.find((version) => version.status === "PUBLISHED") ?? null;
}

export function selectPublishedVersion(
  versions: ResourceVersionSummary[],
  requestedNumber: number | null,
): ResourceVersionSummary | null {
  const published = versions.filter((version) => version.status === "PUBLISHED");
  if (published.length === 0) {
    return null;
  }
  if (requestedNumber != null) {
    return published.find((version) => version.versionNumber === requestedNumber) ?? published[0];
  }
  return published[0];
}

export function requestedPublishedVersionMissing(
  versions: ResourceVersionSummary[],
  requestedNumber: number | null,
): boolean {
  if (requestedNumber == null) {
    return false;
  }
  return !versions.some(
    (version) => version.status === "PUBLISHED" && version.versionNumber === requestedNumber,
  );
}

export function filesForVersion<T extends { versionId: string }>(
  files: T[],
  versionId: string | null,
): T[] {
  if (!versionId) {
    return [];
  }
  return files.filter((file) => file.versionId === versionId);
}

export function openRevision(
  versions: ResourceVersionSummary[],
): ResourceVersionSummary | null {
  return (
    versions.find((version) => version.status === "DRAFT" || version.status === "PENDING_REVIEW") ??
    null
  );
}

export function nextVersionLabel(versions: ResourceVersionSummary[]): string {
  const max = versions.reduce((highest, version) => Math.max(highest, version.versionNumber), 0);
  return `v${max + 1}`;
}

export function revisionSubmitBlockers(input: {
  changelog: string | null;
  fileCount: number;
}): string[] {
  const blockers: string[] = [];
  if (!input.changelog?.trim()) {
    blockers.push("Add a changelog before submitting this version for review.");
  }
  if (input.fileCount < 1) {
    blockers.push("Upload at least one file for this version.");
  }
  return blockers;
}
