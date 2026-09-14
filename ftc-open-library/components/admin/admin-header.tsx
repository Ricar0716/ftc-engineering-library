export function AdminHeader({
  title,
  description,
  eyebrow,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
}) {
  return (
    <header className="flex min-w-0 flex-col gap-1">
      {eyebrow ? (
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-muted">{eyebrow}</p>
      ) : null}
      <h1 className="text-2xl font-medium tracking-tight text-ink">{title}</h1>
      {description ? (
        <p className="max-w-2xl text-sm leading-6 text-ink-muted">{description}</p>
      ) : null}
    </header>
  );
}
