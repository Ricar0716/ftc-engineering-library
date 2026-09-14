import { UserAvatar } from "@/components/ui/user-avatar";
import { formatDisplayDate } from "@/lib/utils/dates";
import type { PublicUserProfile } from "@/types/users";

export function ProfileHeader({ profile }: { profile: PublicUserProfile }) {
  const joined = formatDisplayDate(profile.joinedAt);

  return (
    <header className="flex min-w-0 flex-col gap-4 border-b border-line pb-8 sm:flex-row sm:items-start">
      <UserAvatar name={profile.displayName} src={profile.avatarUrl} size="lg" />
      <div className="min-w-0">
        <p className="font-mono text-xs text-ink-muted">@{profile.username}</p>
        <h1 className="mt-1 break-words text-3xl font-medium tracking-tight">{profile.displayName}</h1>
        {profile.bio ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">{profile.bio}</p>
        ) : null}
        {joined ? (
          <p className="mt-3 font-mono text-xs text-ink-muted">Joined {joined}</p>
        ) : null}
      </div>
    </header>
  );
}
