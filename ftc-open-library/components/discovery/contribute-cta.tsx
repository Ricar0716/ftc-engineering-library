import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { loginPath } from "@/lib/auth/paths";
import { canSubmitResource, contributeActionLabel, type AccessSnapshot } from "@/lib/auth/permissions";

export function ContributeCta({ access }: { access: AccessSnapshot }) {
  const href =
    access.level === "unverified" ? "/verify?reason=submit" : canSubmitResource(access) ? "/submit" : loginPath("/submit");

  return (
    <section className="border-t border-line bg-surface">
      <Container
        width="wide"
        className="flex flex-col gap-4 py-12 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 max-w-xl">
          <h2 className="text-xl font-medium">Have a robot design?</h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            Share your CAD, code, or tutorial. Guests can browse. Verified users submit a draft for
            review — nothing is published without a Site Admin decision.
          </p>
        </div>
        <ButtonLink href={href} className="w-full shrink-0 sm:w-auto">
          {contributeActionLabel(access)}
        </ButtonLink>
      </Container>
    </section>
  );
}
