/**
 * Upload Intent expiry lives in Postgres. The browser may only store the
 * timestamp the server last returned — never a locally computed TTL.
 */
export function authoritativeExpiresAt(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const ts = Date.parse(trimmed);
  if (!Number.isFinite(ts)) {
    return null;
  }
  return trimmed;
}

export function canResumeWithExpiry(expiresAt: string | null | undefined, nowMs: number): boolean {
  if (!expiresAt) {
    return false;
  }
  const ts = Date.parse(expiresAt);
  return Number.isFinite(ts) && ts > nowMs;
}
