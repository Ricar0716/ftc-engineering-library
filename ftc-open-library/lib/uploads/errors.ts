export type TransportErrorCode =
  | "cancelled"
  | "signed_out"
  | "project_limit"
  | "network"
  | "rejected"
  | "unknown";

export type TransportError = {
  code: TransportErrorCode;
  message: string;
};

export const TRANSPORT_ERROR_MESSAGES: Record<TransportErrorCode, string> = {
  cancelled: "Upload cancelled.",
  signed_out: "Your session expired. Sign in again, then retry the upload.",
  project_limit: "This file exceeds the current storage limit configured for FTC Open Library.",
  network: "The upload was interrupted. You can retry without starting over if the session is still valid.",
  rejected: "The upload was rejected. Check the file type and size, then try again.",
  unknown: "The upload could not be completed. Check your connection and try again.",
};

export function transportErrorFromUnknown(error: unknown): TransportError {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "cancelled" || code === "signed_out") {
      return { code, message: TRANSPORT_ERROR_MESSAGES[code] };
    }
  }

  const raw = error instanceof Error ? error.message : String(error ?? "");
  const lower = raw.toLowerCase();

  if (/abort|cancelled|canceled/i.test(raw) && !/payload/i.test(raw)) {
    return { code: "cancelled", message: TRANSPORT_ERROR_MESSAGES.cancelled };
  }
  if (/401|403|jwt|session|signed.?out|not authenticated|invalid.?token/i.test(lower)) {
    return { code: "signed_out", message: TRANSPORT_ERROR_MESSAGES.signed_out };
  }
  if (/413|entity too large|maximum size|payload too large|file_size_limit|exceeded the maximum/i.test(lower)) {
    return { code: "project_limit", message: TRANSPORT_ERROR_MESSAGES.project_limit };
  }
  if (/network|failed to fetch|timeout|econnreset|offline|interrupted/i.test(lower)) {
    return { code: "network", message: TRANSPORT_ERROR_MESSAGES.network };
  }
  if (/row-level security|permission denied|400|invalid/i.test(lower)) {
    return { code: "rejected", message: TRANSPORT_ERROR_MESSAGES.rejected };
  }

  return { code: "unknown", message: TRANSPORT_ERROR_MESSAGES.unknown };
}

export class UploadCancelledError extends Error {
  readonly code = "cancelled" as const;
  constructor() {
    super(TRANSPORT_ERROR_MESSAGES.cancelled);
    this.name = "UploadCancelledError";
  }
}

export class SignedOutError extends Error {
  readonly code = "signed_out" as const;
  constructor() {
    super(TRANSPORT_ERROR_MESSAGES.signed_out);
    this.name = "SignedOutError";
  }
}
