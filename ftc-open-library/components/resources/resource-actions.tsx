import { FavoriteButton } from "@/components/favorites/favorite-button";
import { FavoriteCount } from "@/components/favorites/favorite-count";
import { ResourceCopyLink } from "@/components/resources/resource-copy-link";
import { ButtonLink } from "@/components/ui/button";
import type { AccessSnapshot } from "@/lib/auth/permissions";
import { primaryDownloadAction } from "@/lib/resources/detail-ui";

export function ResourceActions({
  access,
  resourceId,
  resourceSlug,
  favoriteCount,
  initialSaved,
}: {
  access: AccessSnapshot;
  resourceId: string;
  resourceSlug: string;
  favoriteCount: number | null | undefined;
  initialSaved: boolean;
}) {
  const returnTo = `/resources/${resourceSlug}`;
  const download = primaryDownloadAction(access, returnTo);

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <ButtonLink
        href={download.href}
        variant={download.kind === "download" ? "primary" : "secondary"}
        className="w-full sm:w-auto"
      >
        {download.label}
      </ButtonLink>
      <ButtonLink href="#preview" variant="secondary" className="w-full sm:w-auto">
        View preview
      </ButtonLink>
      <FavoriteButton
        resourceId={resourceId}
        resourceSlug={resourceSlug}
        access={access}
        initialSaved={initialSaved}
      />
      <div className="w-full sm:w-auto">
        <ResourceCopyLink path={returnTo} />
      </div>
      <FavoriteCount count={favoriteCount} />
      {download.kind !== "download" ? (
        <p className="text-sm text-ink-muted sm:ml-1">
          {download.kind === "verify"
            ? "Verify your email to download published files."
            : "Sign in to download."}
        </p>
      ) : null}
    </div>
  );
}
