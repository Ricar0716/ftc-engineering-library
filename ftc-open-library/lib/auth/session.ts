import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getConfiguredServerClient } from "@/lib/db/client";
import { loginPath } from "@/lib/auth/paths";
import { accessLevel, adminGate, GUEST_ACCESS, type AccessSnapshot } from "@/lib/auth/permissions";
import { logger } from "@/lib/utils/logger";

function isEmailVerified(user: {
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
}): boolean {
  return Boolean(user.email_confirmed_at ?? user.confirmed_at);
}

export async function getCurrentAccess(): Promise<AccessSnapshot> {
  await cookies();
  const supabase = await getConfiguredServerClient();
  if (!supabase) {
    return GUEST_ACCESS;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return GUEST_ACCESS;
  }

  const emailVerified = isEmailVerified(user);
  let isSiteAdmin = false;

  const { data: adminFlag, error: adminError } = await supabase.rpc("is_site_admin");
  if (adminError) {
    logger.warn("auth.session", "Failed to resolve site admin status", {
      message: adminError.message,
    });
  } else {
    isSiteAdmin = Boolean(adminFlag);
  }

  let username: string | null = null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  username = profile?.username ?? null;

  const level = accessLevel({
    authenticated: true,
    emailVerified,
    isSiteAdmin,
  });

  return {
    level,
    userId: user.id,
    username,
    emailVerified,
    isSiteAdmin: level === "admin",
  };
}

export async function requireVerifiedUser(): Promise<AccessSnapshot | null> {
  const access = await getCurrentAccess();
  if (access.level === "verified" || access.level === "admin") {
    return access;
  }
  return null;
}

export async function requireVerifiedPage(
  nextPath: string,
  verifyReason = "download",
): Promise<AccessSnapshot> {
  const access = await getCurrentAccess();
  if (access.level === "guest") {
    redirect(loginPath(nextPath));
  }
  if (access.level === "unverified") {
    redirect(`/verify?reason=${encodeURIComponent(verifyReason)}`);
  }
  return access;
}

export async function requireSignedInPage(nextPath: string): Promise<AccessSnapshot> {
  const access = await getCurrentAccess();
  if (access.level === "guest") {
    redirect(loginPath(nextPath));
  }
  return access;
}

export async function requireSiteAdmin(): Promise<AccessSnapshot | null> {
  const access = await getCurrentAccess();
  if (access.level === "admin") {
    return access;
  }
  return null;
}

export async function requireAdminPage(nextPath = "/admin"): Promise<AccessSnapshot> {
  const access = await getCurrentAccess();
  const gate = adminGate(access.level);
  if (gate === "login") {
    redirect(loginPath(nextPath));
  }
  if (gate === "forbidden") {
    redirect("/forbidden");
  }
  return access;
}
