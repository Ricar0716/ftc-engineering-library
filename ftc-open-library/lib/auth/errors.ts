const FALLBACK = "Something went wrong. Try again.";

const MATCHERS: { pattern: RegExp; message: string }[] = [
  { pattern: /invalid login credentials/i, message: "Incorrect email or password." },
  { pattern: /email not confirmed/i, message: "Verify your email before signing in." },
  { pattern: /already registered|user already exists|already been registered/i, message: "An account with this email already exists." },
  { pattern: /password should be at least|password is known to be weak|weak password/i, message: "Choose a stronger password (at least 8 characters)." },
  { pattern: /unable to validate email|invalid email/i, message: "Enter a valid email address." },
  { pattern: /expired|otp_expired|token has expired/i, message: "This link has expired. Request a new one." },
  { pattern: /same password/i, message: "Choose a password you have not used before." },
  { pattern: /rate limit|too many requests/i, message: "Too many attempts. Wait a moment and try again." },
  { pattern: /signup is disabled/i, message: "New accounts cannot be created right now." },
];

export function publicAuthError(error: { message?: string } | string | null | undefined): string {
  const raw = typeof error === "string" ? error : error?.message;
  if (!raw) {
    return FALLBACK;
  }
  for (const matcher of MATCHERS) {
    if (matcher.pattern.test(raw)) {
      return matcher.message;
    }
  }
  return FALLBACK;
}
