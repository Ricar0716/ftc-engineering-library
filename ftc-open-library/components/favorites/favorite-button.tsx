"use client";

import { useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { addFavorite, removeFavorite } from "@/lib/favorites/actions";
import { loginPath } from "@/lib/auth/paths";
import type { AccessSnapshot } from "@/lib/auth/permissions";
import { canFavorite } from "@/lib/auth/permissions";

export function FavoriteButton({
  resourceId,
  resourceSlug,
  access,
  initialSaved,
}: {
  resourceId: string;
  resourceSlug: string;
  access: AccessSnapshot;
  initialSaved: boolean;
}) {
  const returnTo = `/resources/${resourceSlug}`;

  if (access.level === "guest") {
    return (
      <ButtonLink
        href={loginPath(returnTo)}
        variant="secondary"
        className="w-full sm:w-auto"
        aria-label="Sign in to save this resource"
      >
        ☆ Save
      </ButtonLink>
    );
  }

  if (!canFavorite(access)) {
    return (
      <ButtonLink
        href="/verify?reason=save"
        variant="secondary"
        className="w-full sm:w-auto"
        aria-label="Verify your email to save this resource"
      >
        Verify to save
      </ButtonLink>
    );
  }

  return <FavoriteToggle resourceId={resourceId} initialSaved={initialSaved} />;
}

function FavoriteToggle({
  resourceId,
  initialSaved,
}: {
  resourceId: string;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) {
      return;
    }
    const next = !saved;
    setSaved(next);
    setError(null);

    startTransition(async () => {
      const result = next ? await addFavorite(resourceId) : await removeFavorite(resourceId);
      if (!result.ok) {
        setSaved(!next);
        setError(result.error);
      }
    });
  }

  const label = pending ? (saved ? "Saving…" : "Removing…") : saved ? "★ Saved" : "☆ Save";

  return (
    <div className="flex min-w-0 flex-col gap-1 sm:w-auto">
      <Button
        type="button"
        variant="secondary"
        className="w-full sm:w-auto"
        disabled={pending}
        aria-pressed={saved}
        aria-label={saved ? "Remove this resource from saved items" : "Save this resource"}
        onClick={toggle}
      >
        {label}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
