import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import type { TeamSummary } from "@/types/teams";

export function TeamCard({ team }: { team: TeamSummary }) {
  return (
    <Card className="transition-colors hover:border-accent/40">
      <Link href={`/teams/${team.slug}`} className="block">
        <CardBody className="flex gap-3">
          {team.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={team.logoUrl}
              alt={`${team.name} logo`}
              className="h-12 w-12 shrink-0 rounded-md border border-line object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-line bg-accent-soft font-mono text-xs text-accent"
            >
              {team.teamNumber.slice(0, 4)}
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <p className="font-mono text-xs text-ink-muted">Team {team.teamNumber}</p>
            <h3 className="text-base font-medium text-ink">{team.name}</h3>
            {team.country ? <p className="text-sm text-ink-muted">{team.country}</p> : null}
            {team.description ? (
              <p className="line-clamp-2 text-sm leading-6 text-ink-muted">{team.description}</p>
            ) : null}
            {team.resourceCount != null ? (
              <p className="font-mono text-xs text-ink-muted">
                {team.resourceCount} {team.resourceCount === 1 ? "resource" : "resources"}
              </p>
            ) : null}
          </div>
        </CardBody>
      </Link>
    </Card>
  );
}
