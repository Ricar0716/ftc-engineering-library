type LogExtra = Record<string, unknown>;

function sanitize(extra?: LogExtra): LogExtra | undefined {
  if (!extra) {
    return undefined;
  }

  const blocked = new Set([
    "password",
    "token",
    "accessToken",
    "refreshToken",
    "serviceRoleKey",
    "anonKey",
    "authorization",
    "apikey",
    "access_token",
    "refresh_token",
    "x-signature",
    "signedUrl",
    "signed_url",
  ]);

  return Object.fromEntries(Object.entries(extra).filter(([key]) => !blocked.has(key)));
}

export const logger = {
  info(scope: string, message: string, extra?: LogExtra) {
    console.info(`[${scope}] ${message}`, sanitize(extra) ?? "");
  },
  warn(scope: string, message: string, extra?: LogExtra) {
    console.warn(`[${scope}] ${message}`, sanitize(extra) ?? "");
  },
  error(scope: string, message: string, extra?: LogExtra) {
    console.error(`[${scope}] ${message}`, sanitize(extra) ?? "");
  },
};
