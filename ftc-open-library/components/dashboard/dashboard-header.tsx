export function DashboardHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="flex min-w-0 flex-col gap-1">
      <h1 className="text-2xl font-medium tracking-tight text-ink">{title}</h1>
      {description ? (
        <p className="max-w-2xl text-sm leading-6 text-ink-muted">{description}</p>
      ) : null}
    </header>
  );
}
