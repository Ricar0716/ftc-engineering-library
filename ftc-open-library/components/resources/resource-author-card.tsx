import Link from "next/link";
import { UserAvatar } from "@/components/ui/user-avatar";
import { contributorHref, teamHref, teamIdentityLabel } from "@/lib/identity/paths";
import type { ResourceDetail } from "@/types/resources";

export function ResourceAuthorCard({ resource }: { resource: ResourceDetail }) {
  const name = resource.authorDisplayName ?? resource.authorUsername;
  if (!name || !resource.authorUsername) {
    return null;
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-sm font-medium">Contributor</h2>
      <div className="mt-3 flex min-w-0 items-start gap-3">
        <UserAvatar name={name} src={resource.authorAvatarUrl} />
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">
            <Link href={contributorHref(resource.authorUsername)} className="hover:text-accent">
              {name}
            </Link>
          </p>
          <p className="font-mono text-xs text-ink-muted">@{resource.authorUsername}</p>
          {resource.teamSlug ? (
            <p className="mt-1 truncate text-sm text-ink-muted">
              <Link href={teamHref(resource.teamSlug)} className="hover:text-ink">
                {teamIdentityLabel(resource.teamSlug)}
                {resource.teamName ? ` · ${resource.teamName}` : ""}
              </Link>
            </p>
          ) : null}
          {resource.authorPublishedCount != null ? (
            <p className="mt-2 font-mono text-xs text-ink-muted">
              {new Intl.NumberFormat("en-US").format(resource.authorPublishedCount)} published
              {resource.authorPublishedCount === 1 ? " resource" : " resources"}
            </p>
          ) : null}
        </div>
      </div>
      {resource.authorBio ? (
        <p className="mt-3 text-sm leading-6 text-ink-muted">{resource.authorBio}</p>
      ) : null}
    </section>
  );
}
