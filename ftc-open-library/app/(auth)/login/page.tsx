import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { AuthForm, AuthMessage } from "@/components/auth/auth-form";
import { signIn } from "@/lib/auth/actions";
import { safeInternalPath } from "@/lib/auth/paths";
import { getCurrentAccess } from "@/lib/auth/session";
import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const CALLBACK_ERRORS: Record<string, string> = {
  exchange: "Sign-in could not be completed. Try again.",
  expired: "This link has expired. Request a new one.",
  missing: "That sign-in link was incomplete. Try again.",
  config: "Authentication is not configured on this server.",
};

export const metadata = {
  title: "Sign in",
  description: "Sign in to download resources and, later, to contribute.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const access = await getCurrentAccess();
  const params = await searchParams;
  const next = safeInternalPath(first(params.next));
  const callbackError = first(params.error);
  const banner = callbackError ? CALLBACK_ERRORS[callbackError] : null;

  if (access.level !== "guest" && !banner) {
    redirect(next === "/login" ? "/" : next);
  }

  return (
    <main id="main-content">
      <PageHeader
        title="Sign in"
        description="Public browsing stays open. A verified account is required to download original files."
      />
      <Container width="narrow" className="pb-16">
        <Card>
          <CardBody className="flex flex-col gap-4">
            <AuthMessage error={banner} />
            <AuthForm action={signIn} submitLabel="Sign in">
              <input type="hidden" name="next" value={next} />
              <Input
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
              <Input
                label="Password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </AuthForm>
            <p className="text-sm text-ink-muted">
              <a href="/forgot-password" className="underline">
                Forgot password?
              </a>
            </p>
            <p className="text-sm text-ink-muted">
              Need an account?{" "}
              <a href="/signup" className="underline">
                Sign up
              </a>
            </p>
            <ButtonLink href="/explore" variant="ghost" size="sm">
              Continue browsing
            </ButtonLink>
          </CardBody>
        </Card>
      </Container>
    </main>
  );
}
