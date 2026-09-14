import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { AuthForm, AuthMessage } from "@/components/auth/auth-form";
import { resendVerification } from "@/lib/auth/actions";
import { getCurrentAccess } from "@/lib/auth/session";

type VerifyPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = {
  title: "Verify your email",
  description: "Confirm your email to download original files and contribute later.",
};

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const access = await getCurrentAccess();
  const params = await searchParams;
  const sent = (Array.isArray(params.sent) ? params.sent[0] : params.sent) === "1";
  const reason = Array.isArray(params.reason) ? params.reason[0] : params.reason;

  if (access.emailVerified) {
    return (
      <main id="main-content">
        <PageHeader title="Email verified" description="Your account can download original files." />
        <Container width="narrow" className="pb-16">
          <Card>
            <CardBody className="flex flex-col gap-3">
              <p className="text-sm text-ink-muted">
                You can keep browsing as usual. Uploading resources will open in a later step and
                will still require review before anything is published.
              </p>
              <ButtonLink href="/explore">Continue browsing</ButtonLink>
            </CardBody>
          </Card>
        </Container>
      </main>
    );
  }

  return (
    <main id="main-content">
      <PageHeader
        title="Verify your email"
        description="Check your inbox for a confirmation link. You can browse the library now; downloads and future uploads wait until your email is verified."
      />
      <Container width="narrow" className="pb-16">
        <Card>
          <CardBody className="flex flex-col gap-4">
            <AuthMessage
              notice={
                sent
                  ? "Account created. Check your email to verify your account."
                    : reason === "download"
                    ? "Verify your email to download original files."
                    : reason === "save"
                      ? "Verify your email to save resources."
                      : reason === "submit"
                        ? "Verify your email before submitting resources."
                        : reason === "discuss"
                          ? "Verify your email to join resource discussions."
                          : null
              }
            />
            <AuthForm action={resendVerification} submitLabel="Resend verification email">
              <Input label="Email" name="email" type="email" autoComplete="email" required />
            </AuthForm>
            <ButtonLink href="/explore" variant="ghost" size="sm">
              Continue browsing
            </ButtonLink>
          </CardBody>
        </Card>
      </Container>
    </main>
  );
}
