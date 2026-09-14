const DOWNLOAD_ERRORS = {
  signin: "Sign in to download this resource.",
  verify: "Verify your email to download published files.",
  missing: "This file is no longer available.",
  unavailable: "Downloads are unavailable right now. Try again later.",
  failed: "Unable to start download. Try again.",
} as const;

export function publicDownloadError(status: number): string {
  if (status === 401) {
    return DOWNLOAD_ERRORS.signin;
  }
  if (status === 403) {
    return DOWNLOAD_ERRORS.verify;
  }
  if (status === 404) {
    return DOWNLOAD_ERRORS.missing;
  }
  if (status === 503) {
    return DOWNLOAD_ERRORS.unavailable;
  }
  return DOWNLOAD_ERRORS.failed;
}

export { DOWNLOAD_ERRORS };
