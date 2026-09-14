import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export function NotFoundPanel({
  title,
  description,
  secondaryHref = "/explore",
  secondaryLabel = "Explore resources",
}: {
  title: string;
  description: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <main id="main-content" className="py-16">
      <Container width="narrow" className="flex flex-col gap-4">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-muted">404</p>
        <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
        <p className="text-sm leading-6 text-ink-muted">{description}</p>
        <div className="flex min-w-0 flex-wrap gap-2">
          <ButtonLink href="/">Back to home</ButtonLink>
          <ButtonLink href={secondaryHref} variant="secondary">
            {secondaryLabel}
          </ButtonLink>
        </div>
      </Container>
    </main>
  );
}
