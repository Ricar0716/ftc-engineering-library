import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/lib/config/site";
import {
  RESOURCE_TYPE_BLURBS,
  RESOURCE_TYPE_LABELS,
  RESOURCE_TYPE_PURPOSE,
  RESOURCE_TYPES,
} from "@/lib/constants/resources";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = publicPageMetadata({
  title: "About FTC Open Library",
  description: siteConfig.description,
  path: "/about",
});

export default function AboutPage() {
  return (
    <main id="main-content">
      <PageHeader
        eyebrow={siteConfig.philosophy}
        title={siteConfig.name}
        description="An open-source knowledge platform for FIRST Tech Challenge teams — CAD, code, tutorials, and models in one catalog."
      />
      <Container width="narrow" className="flex min-w-0 flex-col gap-10 pb-16">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">What you can do here</h2>
          <p className="text-sm leading-7 text-ink-muted">
            Browse published resources without an account. Sign in with a verified email to preview
            files in the browser and download originals through short-lived signed URLs. Verified
            contributors submit drafts; Site Admins review them before anything becomes public.
          </p>
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Resource types</h2>
          <ul className="flex flex-col gap-3">
            {RESOURCE_TYPES.map((type) => (
              <li key={type} className="rounded-lg border border-line bg-surface p-4">
                <p className="font-mono text-xs uppercase tracking-wide text-accent">
                  {RESOURCE_TYPE_LABELS[type]}
                </p>
                <p className="mt-1 text-sm font-medium text-ink">{RESOURCE_TYPE_PURPOSE[type]}</p>
                <p className="mt-1 text-sm leading-6 text-ink-muted">{RESOURCE_TYPE_BLURBS[type]}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Not affiliated with FIRST</h2>
          <p className="text-sm leading-7 text-ink-muted">
            FTC Open Library is a community project. FIRST, FIRST Tech Challenge, and FTC are
            trademarks of FIRST.
          </p>
        </section>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/explore">Explore resources</ButtonLink>
          <ButtonLink href="/submit" variant="secondary">
            Contribute
          </ButtonLink>
        </div>
      </Container>
    </main>
  );
}
