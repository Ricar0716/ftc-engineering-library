import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceForm } from "@/components/resources/resource-form";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { loginPath } from "@/lib/auth/paths";
import { getCurrentAccess } from "@/lib/auth/session";
import { createResourceDraft } from "@/lib/resources/actions";
import { loadResourceFormOptions } from "@/lib/resources/form-options";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Submit a resource",
  description: "Create a draft resource for FTC Open Library and send it for Site Admin review.",
  robots: { index: false, follow: false },
};

export default async function SubmitPage() {
  const access = await getCurrentAccess();

  if (access.level === "guest") {
    redirect(loginPath("/submit"));
  }

  if (access.level === "unverified" || !access.userId) {
    return (
      <main id="main-content">
        <PageHeader
          eyebrow="Contribute"
          title="Verify your email before submitting resources"
          description="Contribution is limited to verified accounts. Verification also unlocks downloads of original files."
        />
        <Container width="narrow" className="pb-16">
          <ButtonLink href="/verify?reason=submit">Verify email</ButtonLink>
        </Container>
      </main>
    );
  }

  const options = await loadResourceFormOptions(access.userId);

  return (
    <main id="main-content">
      <PageHeader
        eyebrow="Contribute"
        title="Submit a resource"
        description="Save a draft first, upload your files, then send it for review. A Site Admin approves everything that becomes public."
      />
      <Container width="narrow" className="pb-16">
        <ResourceForm
          action={createResourceDraft}
          options={options}
          allowTypeChange
          submitLabel="Save draft"
          initial={{
            resourceType: "CAD",
            title: "",
            description: "",
            categoryId: "",
            seasonId: "",
            licenseId: "",
            teamId: "",
            tagIds: [],
          }}
        />
      </Container>
    </main>
  );
}
