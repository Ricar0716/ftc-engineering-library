import { Container } from "@/components/ui/container";

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <Container className="flex flex-col gap-2 py-8" width="wide">
      {eyebrow ? (
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-muted">{eyebrow}</p>
      ) : null}
      <h1 className="text-3xl font-medium tracking-tight text-ink">{title}</h1>
      {description ? (
        <p className="max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">{description}</p>
      ) : null}
    </Container>
  );
}
