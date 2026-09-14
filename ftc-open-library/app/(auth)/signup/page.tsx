import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { AuthForm } from "@/components/auth/auth-form";
import { signUp } from "@/lib/auth/actions";
import { getCurrentAccess } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Create an account",
  description: "Create an FTC Open Library account. Email verification is required to download.",
};

export default async function SignupPage() {
  const access = await getCurrentAccess();
  if (access.level === "verified" || access.level === "admin") {
    redirect("/");
  }

  return (
    <main id="main-content">
      <PageHeader
        title="Create an account"
        description="You can browse immediately. Downloading original files and future uploads require a verified email."
      />
      <Container width="narrow" className="pb-16">
        <Card>
          <CardBody className="flex flex-col gap-4">
            <AuthForm action={signUp} submitLabel="Create account">
              <Input
                label="Username"
                name="username"
                autoComplete="username"
                required
                hint="Public profile name. 3–32 letters, numbers, or underscores."
              />
              <Input
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                required
                hint="Email addresses are never shown on public profiles."
              />
              <Input
                label="Password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                hint="At least 8 characters."
              />
            </AuthForm>
            <p className="text-sm text-ink-muted">
              Already have an account?{" "}
              <a href="/login" className="underline">
                Sign in
              </a>
            </p>
            <ButtonLink href="/" variant="ghost" size="sm">
              Back to home
            </ButtonLink>
          </CardBody>
        </Card>
      </Container>
    </main>
  );
}
