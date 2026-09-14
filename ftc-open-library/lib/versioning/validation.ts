import type { ResourceVersionSummary } from "@/types/resources";

export const VERSION_LABEL_MAX = 80;
export const VERSION_CHANGELOG_MAX = 4000;

export function parseVersionNumber(
  input: Record<string, string | string[] | undefined>,
): number | null {
  const raw = Array.isArray(input.version) ? input.version[0] : input.version;
  if (!raw) {
    return null;
  }
  const normalized = raw.trim().replace(/^v/i, "");
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

export function versionHref(slug: string, versionNumber: number, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams(extra);
  params.set("version", String(versionNumber));
  const query = params.toString();
  return `/resources/${slug}?${query}`;
}

export function displayVersionName(version: Pick<ResourceVersionSummary, "versionNumber" | "versionLabel">): string {
  if (version.versionLabel?.trim()) {
    return version.versionLabel.trim();
  }
  return `v${version.versionNumber}`;
}

export function normalizeVersionLabel(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) {
    return null;
  }
  return value.slice(0, VERSION_LABEL_MAX);
}

export function normalizeChangelog(
  raw: string | null | undefined,
): { ok: true; changelog: string | null } | { ok: false; error: "too_long" } {
  const changelog = (raw ?? "").trim();
  if (!changelog) {
    return { ok: true, changelog: null };
  }
  if (changelog.length > VERSION_CHANGELOG_MAX) {
    return { ok: false, error: "too_long" };
  }
  return { ok: true, changelog };
}
