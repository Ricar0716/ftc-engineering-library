"use client";

import { useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { SearchBar } from "@/components/search/search-bar";
import { signOut } from "@/lib/auth/actions";
import { loginPath, returnPathAfterAuth } from "@/lib/auth/paths";
import type { AccessSnapshot } from "@/lib/auth/permissions";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { isPrimaryNavActive, primaryNav } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";

export function MobileNav({ access }: { access: AccessSnapshot }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nextPath = returnPathAfterAuth(pathname, searchParams.toString());

  function close() {
    dialogRef.current?.close();
    setOpen(false);
  }

  function openMenu() {
    dialogRef.current?.showModal();
    setOpen(true);
  }

  return (
    <div className="md:hidden">
      <Button
        variant="secondary"
        size="sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openMenu}
      >
        Menu
      </Button>
      <dialog
        ref={dialogRef}
        className="m-0 ml-auto h-full max-h-none w-[min(20rem,100%)] max-w-none border-l border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40"
        onClose={close}
        aria-labelledby="mobile-nav-title"
      >
        <div className="flex h-14 items-center justify-between border-b border-line px-4">
          <h2 id="mobile-nav-title" className="text-sm font-medium">
            Navigation
          </h2>
          <Button variant="ghost" size="sm" onClick={close}>
            Close
          </Button>
        </div>
        <div className="flex flex-col gap-5 p-4">
          <SearchBar id="mobile-resource-search" />
          <nav aria-label="Mobile primary" className="flex flex-col gap-1">
            {primaryNav.map((item) => {
              const active = isPrimaryNavActive(item.href, pathname, searchParams);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-2 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    active ? "bg-accent-soft font-medium text-accent" : "text-ink hover:bg-canvas",
                  )}
                >
                  {item.label}
                </a>
              );
            })}
            {access.level !== "guest" ? (
              <a
                href="/dashboard"
                onClick={close}
                className="rounded-md px-2 py-2 text-sm text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Dashboard
              </a>
            ) : null}
            {canAccessAdmin(access) ? (
              <a
                href="/admin"
                onClick={close}
                className="rounded-md px-2 py-2 text-sm text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Admin
              </a>
            ) : null}
          </nav>
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            {access.level === "guest" ? (
              <>
                <ButtonLink href={loginPath(nextPath)} variant="secondary" onClick={close}>
                  Sign in
                </ButtonLink>
                <ButtonLink href="/signup" variant="primary" onClick={close}>
                  Sign up
                </ButtonLink>
              </>
            ) : (
              <>
                <ButtonLink href="/dashboard" variant="secondary" onClick={close}>
                  Dashboard
                </ButtonLink>
                <form action={signOut}>
                  <Button type="submit" variant="ghost" className="w-full" onClick={close}>
                    Sign out
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}
