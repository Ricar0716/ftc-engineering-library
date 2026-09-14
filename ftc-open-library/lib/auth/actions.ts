"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { publicAuthError } from "@/lib/auth/errors";
import { safeInternalPath } from "@/lib/auth/paths";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/utils/logger";

export type AuthActionState = { error: string | null; notice: string | null };

function configuredOrError(): AuthActionState | null {
  if (!isSupabaseConfigured()) {
    return { error: "Authentication is not configured on this server.", notice: null };
  }
  return null;
}

async function requestOrigin(): Promise<string> {
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  if (origin && /^https?:\/\//i.test(origin)) {
    return origin;
  }
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  if (host && !host.includes("://")) {
    return `${proto}://${host}`;
  }
  return "http://127.0.0.1:3000";
}

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function validUsername(value: string): boolean {
  return /^[a-zA-Z0-9_]{3,32}$/.test(value);
}

export async function signIn(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const blocked = configuredOrError();
  if (blocked) {
    return blocked;
  }

  const email = readString(formData, "email");
  const password = readString(formData, "password");
  const next = safeInternalPath(readString(formData, "next") || "/");

  if (!email || !password) {
    return { error: "Email and password are required.", notice: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    logger.warn("auth.signIn", "Sign-in failed", { message: error.message });
    return { error: publicAuthError(error), notice: null };
  }

  redirect(next);
}

export async function signUp(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const blocked = configuredOrError();
  if (blocked) {
    return blocked;
  }

  const email = readString(formData, "email");
  const password = readString(formData, "password");
  const username = readString(formData, "username");

  if (!email || !password || !username) {
    return { error: "Username, email, and password are required.", notice: null };
  }
  if (!validUsername(username)) {
    return {
      error: "Username must be 3–32 characters: letters, numbers, and underscores.",
      notice: null,
    };
  }
  if (password.length < 8) {
    return { error: "Choose a stronger password (at least 8 characters).", notice: null };
  }

  const origin = await requestOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/callback?next=${encodeURIComponent("/verify")}`,
      data: { username },
    },
  });

  if (error) {
    logger.warn("auth.signUp", "Sign-up failed", { message: error.message });
    return { error: publicAuthError(error), notice: null };
  }

  if (data.user?.identities && data.user.identities.length === 0) {
    return { error: "An account with this email already exists.", notice: null };
  }

  redirect("/verify?sent=1");
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured()) {
    redirect("/");
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const blocked = configuredOrError();
  if (blocked) {
    return blocked;
  }

  const email = readString(formData, "email");
  if (!email) {
    return { error: "Enter the email for your account.", notice: null };
  }

  const origin = await requestOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/callback?next=${encodeURIComponent("/reset-password")}`,
  });

  if (error) {
    logger.warn("auth.reset", "Password reset request failed", { message: error.message });
    return { error: publicAuthError(error), notice: null };
  }

  return {
    error: null,
    notice: "If an account exists for that email, a reset link is on the way.",
  };
}

export async function updatePassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const blocked = configuredOrError();
  if (blocked) {
    return blocked;
  }

  const password = readString(formData, "password");
  const confirm = readString(formData, "confirm");
  if (password.length < 8) {
    return { error: "Choose a stronger password (at least 8 characters).", notice: null };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match.", notice: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    logger.warn("auth.updatePassword", "Password update failed", { message: error.message });
    return { error: publicAuthError(error), notice: null };
  }

  redirect("/");
}

export async function resendVerification(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const blocked = configuredOrError();
  if (blocked) {
    return blocked;
  }

  const email = readString(formData, "email");
  if (!email) {
    return { error: "Enter the email you used to sign up.", notice: null };
  }

  const origin = await requestOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/callback?next=${encodeURIComponent("/verify")}` },
  });

  if (error) {
    logger.warn("auth.resend", "Verification resend failed", { message: error.message });
    return { error: publicAuthError(error), notice: null };
  }

  return { error: null, notice: "If that account needs verification, a new email is on the way." };
}
