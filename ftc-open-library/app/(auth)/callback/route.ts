import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/utils/logger";
import { safeInternalPath } from "@/lib/auth/paths";

function callbackErrorRedirect(origin: string, next: string, code: string) {
  const dest = next.startsWith("/reset-password")
    ? `/reset-password?error=${code}`
    : `/login?error=${code}&next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(new URL(dest, origin));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeInternalPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const otpType = url.searchParams.get("type");

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=config", url.origin));
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      logger.warn("auth.callback", "Code exchange failed", { message: error.message });
      return callbackErrorRedirect(url.origin, next, "exchange");
    }
    return NextResponse.redirect(new URL(next, url.origin));
  }

  if (tokenHash && otpType) {
    const type =
      otpType === "recovery" || otpType === "signup" || otpType === "email" || otpType === "invite"
        ? otpType
        : "email";
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) {
      logger.warn("auth.callback", "OTP verification failed", { message: error.message });
      return callbackErrorRedirect(url.origin, next, "expired");
    }
    return NextResponse.redirect(new URL(next, url.origin));
  }

  return callbackErrorRedirect(url.origin, next, "missing");
}
