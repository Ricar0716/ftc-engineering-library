"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { loginPath, returnPathAfterAuth } from "@/lib/auth/paths";
import type { AccessSnapshot } from "@/lib/auth/permissions";
import { canAccessAdmin } from "@/lib/auth/permissions";

export function HeaderAuthLinks({ access }: { access: AccessSnapshot }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextPath = returnPathAfterAuth(pathname, searchParams.toString());

  if (access.level === "guest") {
    return (
      <div className="hidden items-center gap-2 sm:flex">
        <ButtonLink href="/signup" variant="secondary" size="sm">
          Sign up
        </ButtonLink>
        <ButtonLink href={loginPath(nextPath)} size="sm">
          Sign in
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="hidden items-center gap-2 sm:flex">
      {canAccessAdmin(access) ? (
        <ButtonLink href="/admin" variant="secondary" size="sm">
          Admin
        </ButtonLink>
      ) : null}
      <ButtonLink href="/dashboard" variant="ghost" size="sm">
        Dashboard
      </ButtonLink>
      <form action={signOut}>
        <Button type="submit" variant="secondary" size="sm">
          Sign out
        </Button>
      </form>
    </div>
  );
}
