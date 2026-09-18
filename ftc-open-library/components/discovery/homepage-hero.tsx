import { SearchBar } from "@/components/search/search-bar";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/lib/config/site";
import { loginPath } from "@/lib/auth/paths";
import { canSubmitResource, contributeActionLabel, type AccessSnapshot } from "@/lib/auth/permissions";

export function HomepageHero({
  access,
  publishedCount,
}: {
  access: AccessSnapshot;
  publishedCount: number | null;
}) {
  const contributeHref =
    access.level === "unverified" ? "/verify?reason=submit" : canSubmitResource(access) ? "/submit" : loginPath("/submit");
  const contributeLabel = contributeActionLabel(access);

  return (
    <section className="border-b border-line bg-surface">
      <Container width="wide" className="flex min-w-0 flex-col gap-8 py-14 sm:py-16">
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex items-center rounded-full border border-line bg-background px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
            Open source • Community built
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-muted">
            {siteConfig.philosophy}
          </p>
          <h1 className="mt-3 text-4xl font-medium tracking-tight text-ink sm:text-5xl">
            {siteConfig.name}
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-ink-muted sm:text-lg">
            {siteConfig.description}
          </p>
          <p className="mt-4 max-w-xl text-base leading-7 text-ink">
            Share CAD. Learn mechanisms. Explore code. Build better robots.
          </p>
          {publishedCount != null && publishedCount > 0 ? (
            <p className="mt-3 font-mono text-xs text-ink-muted">
              {new Intl.NumberFormat("en-US").format(publishedCount)} published{" "}
              {publishedCount === 1 ? "resource" : "resources"}
            </p>
          ) : null}
        </div>
        <div className="flex min-w-0 max-w-xl flex-col gap-3 sm:flex-row sm:flex-wrap">
          <ButtonLink href="/explore" className="w-full sm:w-auto">
            Explore resources
          </ButtonLink>
          <ButtonLink href={contributeHref} variant="secondary" className="w-full sm:w-auto">
            {contributeLabel}
          </ButtonLink>
        </div>
        <div className="max-w-xl">
          <SearchBar size="lg" id="home-resource-search" />
        </div>
      </Container>
    </section>
  );
}
