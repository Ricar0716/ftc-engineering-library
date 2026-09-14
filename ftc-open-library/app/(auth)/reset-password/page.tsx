import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { AuthForm, AuthMessage } from "@/components/auth/auth-form";
import { updatePassword } from "@/lib/auth/actions";
import { getCurrentAccess } from "@/lib/auth/session";

type ResetPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = {
  title: "Reset password",
  description: "Choose a new password for your FTC Open Library account.",
};

export default async function ResetPasswordPage({ searchParams }: ResetPageProps) {
  const access = await getCurrentAccess();
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const expired = error === "expired" || error === "exchange";

  if (access.level === "guest" || expired) {
    return (
      <main id="main-content">
        <PageHeader
          title="Reset password"
          description="Open the reset link from your email to continue."
        />
        <Container width="narrow" className="pb-16">
          <Card>
            <CardBody className="flex flex-col gap-4">
              <AuthMessage error="This reset link is missing or has expired. Request a new one." />
              <ButtonLink href="/forgot-password">Request a new link</ButtonLink>
            </CardBody>
          </Card>
        </Container>
      </main>
    );
  }

  return (
    <main id="main-content">
      <PageHeader title="Reset password" description="Choose a new password for this account." />
      <Container width="narrow" className="pb-16">
        <Card>
          <CardBody className="flex flex-col gap-4">
            <AuthForm action={updatePassword} submitLabel="Update password">
              <Input
                label="New password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
              />
              <Input
                label="Confirm password"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </AuthForm>
          </CardBody>
        </Card>
      </Container>
    </main>
  );
}
