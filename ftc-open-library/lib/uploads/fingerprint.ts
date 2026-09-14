/**
 * Local TUS resume identity.
 *
 * Includes the authenticated user and the trusted Upload Intent destination so
 * a shared browser cannot resume someone else's private upload, and so a new
 * intent (new path) does not attach to a previous object. Never put tokens or
 * secrets in this string — tus-js-client stores it in localStorage.
 */
export function tusResumeFingerprint(input: {
  userId: string;
  bucket: string;
  path: string;
  filename: string;
  sizeBytes: number;
}): string {
  return [
    "ftc",
    input.userId,
    input.bucket,
    input.path,
    String(input.sizeBytes),
    input.filename,
  ].join(":");
}

export function tusFingerprintMatchesTicket(
  fingerprint: string,
  ticket: { userId: string; bucket: string; path: string },
): boolean {
  const parts = fingerprint.split(":");
  return (
    parts[0] === "ftc" &&
    parts[1] === ticket.userId &&
    parts[2] === ticket.bucket &&
    parts[3] === ticket.path
  );
}
