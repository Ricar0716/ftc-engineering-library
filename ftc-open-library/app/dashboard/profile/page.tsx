import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentAccess } from "@/lib/auth/session";
import { getOwnDashboardProfile } from "@/lib/dashboard/queries";
import { formatDisplayDate } from "@/lib/utils/dates";

export const metadata = {
  title: "Profile",
  description: "Your public profile details. Editing comes later.",
};

export default async function DashboardProfilePage() {
  const access = await getCurrentAccess();
  const profile = access.userId ? await getOwnDashboardProfile(access.userId) : null;

  return (
    <>
      <DashboardHeader
        title="Profile"
        description="This is a read-only view of the same profile visitors see. Full profile editing is not part of this step."
      />
      {profile ? (
        <section className="flex min-w-0 flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-start">
          <UserAvatar name={profile.displayName} src={profile.avatarUrl} size="lg" />
          <dl className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="font-mono text-xs text-ink-muted">Username</dt>
              <dd className="text-sm text-ink">@{profile.username}</dd>
            </div>
            <div>
              <dt className="font-mono text-xs text-ink-muted">Display name</dt>
              <dd className="text-sm text-ink">{profile.displayName}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-mono text-xs text-ink-muted">Bio</dt>
              <dd className="text-sm leading-6 text-ink-muted">
                {profile.bio?.trim() ? profile.bio : "No bio yet."}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs text-ink-muted">Joined</dt>
              <dd className="text-sm text-ink">{formatDisplayDate(profile.joinedAt) ?? "Unknown"}</dd>
            </div>
          </dl>
        </section>
      ) : (
        <EmptyState
          title="Profile is not available yet."
          description="Your profile row is created when you sign up. Try refreshing after verifying email."
        />
      )}
      {profile ? (
        <div>
          <ButtonLink href={`/profile/${profile.username}`} variant="secondary" size="sm">
            View public profile
          </ButtonLink>
        </div>
      ) : null}
    </>
  );
}
