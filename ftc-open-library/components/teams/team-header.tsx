import type { TeamDetail } from "@/types/teams";

export function TeamHeader({ team }: { team: TeamDetail }) {
  return (
    <header className="flex min-w-0 flex-col gap-4 border-b border-line pb-8 sm:flex-row sm:items-start sm:gap-6">
      {team.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.logoUrl}
          alt={`${team.name} logo`}
          className="h-20 w-20 shrink-0 rounded-md border border-line object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-md border border-line bg-accent-soft font-mono text-sm text-accent"
        >
          {team.teamNumber}
        </span>
      )}
      <div className="flex min-w-0 flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-muted">
          Team {team.teamNumber}
        </p>
        <h1 className="text-3xl font-medium tracking-tight">{team.name}</h1>
        {team.country ? <p className="text-sm text-ink-muted">{team.country}</p> : null}
        {team.description ? (
          <p className="max-w-2xl text-sm leading-6 text-ink-muted">{team.description}</p>
        ) : null}
        {team.websiteUrl ? (
          <p>
            <a
              href={team.websiteUrl}
              className="text-sm text-accent hover:text-accent-hover"
              rel="noreferrer"
              target="_blank"
            >
              Team website
            </a>
          </p>
        ) : null}
      </div>
    </header>
  );
}
