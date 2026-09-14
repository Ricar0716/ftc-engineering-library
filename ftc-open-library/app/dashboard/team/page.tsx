import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentAccess } from "@/lib/auth/session";
import { listOwnDashboardTeams } from "@/lib/dashboard/queries";
import { teamHref, teamIdentityLabel } from "@/lib/identity/paths";

export const metadata = {
  title: "Team",
  description: "Teams you belong to. Team management is not part of this workspace.",
};

const ROLE_LABELS = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
} as const;

export default async function DashboardTeamPage() {
  const access = await getCurrentAccess();
  const teams = access.userId ? await listOwnDashboardTeams(access.userId) : [];

  return (
    <>
      <DashboardHeader
        title="Team"
        description="Membership and published team resources. Creating or managing teams is a later step."
      />
      {teams.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {teams.map((team) => (
            <li key={team.teamId} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-medium text-ink">{team.teamName}</h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    {teamIdentityLabel(team.teamNumber)} · {ROLE_LABELS[team.role]} ·{" "}
                    {team.publishedCount}{" "}
                    {team.publishedCount === 1 ? "published resource" : "published resources"}
                  </p>
                </div>
                <ButtonLink href={teamHref(team.teamNumber)} variant="secondary" size="sm">
                  View team
                </ButtonLink>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="You are not on a team yet."
          description="When you belong to a team, your role and a link to its published resources will show here. Team management is not available in this workspace."
        />
      )}
    </>
  );
}
