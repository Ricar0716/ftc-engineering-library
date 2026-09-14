export type AccessLevel = "guest" | "unverified" | "verified" | "admin";

export type AccessSnapshot = {
  level: AccessLevel;
  userId: string | null;
  username: string | null;
  emailVerified: boolean;
  isSiteAdmin: boolean;
};

export const GUEST_ACCESS: AccessSnapshot = {
  level: "guest",
  userId: null,
  username: null,
  emailVerified: false,
  isSiteAdmin: false,
};

export function accessLevel(input: {
  authenticated: boolean;
  emailVerified: boolean;
  isSiteAdmin: boolean;
}): AccessLevel {
  if (!input.authenticated) {
    return "guest";
  }
  if (input.isSiteAdmin && input.emailVerified) {
    return "admin";
  }
  if (input.emailVerified) {
    return "verified";
  }
  return "unverified";
}

export function canDownload(access: Pick<AccessSnapshot, "level">): boolean {
  return access.level === "verified" || access.level === "admin";
}

export function canFavorite(access: Pick<AccessSnapshot, "level">): boolean {
  return canDownload(access);
}

export function canDiscuss(access: Pick<AccessSnapshot, "level">): boolean {
  return canDownload(access);
}

export function canExport(access: Pick<AccessSnapshot, "level">): boolean {
  return canDownload(access);
}

export function canSubmitResource(access: Pick<AccessSnapshot, "level">): boolean {
  return canDownload(access);
}

export function contributeActionLabel(access: Pick<AccessSnapshot, "level">): string {
  if (canSubmitResource(access)) {
    return "Submit a resource";
  }
  if (access.level === "unverified") {
    return "Verify to contribute";
  }
  return "Sign in to contribute";
}

export function canAccessAdmin(access: Pick<AccessSnapshot, "level">): boolean {
  return access.level === "admin";
}

export function adminGate(level: AccessLevel): "login" | "forbidden" | "ok" {
  if (level === "guest") {
    return "login";
  }
  if (level !== "admin") {
    return "forbidden";
  }
  return "ok";
}

export function canBrowsePublic(_access?: Pick<AccessSnapshot, "level">): boolean {
  return true;
}
