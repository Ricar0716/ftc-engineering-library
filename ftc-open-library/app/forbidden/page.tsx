import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";

export const metadata = {
  title: "Forbidden",
  description: "You do not have access to that page.",
  robots: { index: false, follow: false },
};

export default function ForbiddenPage() {
  return (
    <main id="main-content">
      <PageHeader
        title="You don’t have access"
        description="That page is limited to Site Admins. Team roles are separate from Site Admin."
      />
      <Container width="narrow" className="pb-16">
        <ButtonLink href="/explore" variant="secondary">
          Back to explore
        </ButtonLink>
      </Container>
    </main>
  );
}
