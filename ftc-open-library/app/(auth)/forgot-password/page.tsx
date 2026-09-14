import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { AuthForm } from "@/components/auth/auth-form";
import { requestPasswordReset } from "@/lib/auth/actions";

export const metadata = {
  title: "Forgot password",
  description: "Request an email to reset your FTC Open Library password.",
};

export default function ForgotPasswordPage() {
  return (
    <main id="main-content">
      <PageHeader
        title="Forgot password"
        description="We’ll email a reset link if that address has an account."
      />
      <Container width="narrow" className="pb-16">
        <Card>
          <CardBody className="flex flex-col gap-4">
            <AuthForm action={requestPasswordReset} submitLabel="Send reset link">
              <Input label="Email" name="email" type="email" autoComplete="email" required />
            </AuthForm>
            <ButtonLink href="/login" variant="ghost" size="sm">
              Back to sign in
            </ButtonLink>
          </CardBody>
        </Card>
      </Container>
    </main>
  );
}
