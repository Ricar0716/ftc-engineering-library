"use client";

import { Button, ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export function DiscoveryError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main id="main-content" className="py-16">
      <Container width="narrow" className="flex flex-col gap-4">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-muted">Error</p>
        <h1 className="text-3xl font-medium tracking-tight">Unable to load this page</h1>
        <p className="text-sm leading-6 text-ink-muted">
          Something went wrong while loading the library. You can try again, or go back to a public
          page.
        </p>
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button type="button" onClick={() => retry()}>
            Try again
          </Button>
          <ButtonLink href="/" variant="secondary">
            Back to home
          </ButtonLink>
          <ButtonLink href="/explore" variant="secondary">
            Explore resources
          </ButtonLink>
        </div>
      </Container>
    </main>
  );
}
