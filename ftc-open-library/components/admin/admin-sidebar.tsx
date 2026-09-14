"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNav, adminNavLater, isAdminNavActive } from "@/lib/admin/nav";
import { cn } from "@/lib/utils/cn";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <ul className="flex flex-col gap-1">
      {adminNav.map((item) => {
        const active = isAdminNavActive(item.href, pathname, item.exact);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "block rounded-md px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                active
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-ink-muted hover:bg-canvas hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
      {adminNavLater.map((label) => (
        <li key={label}>
          <p className="flex items-baseline justify-between gap-2 px-3 py-1.5 text-sm text-ink-muted">
            <span>{label}</span>
            <span className="font-mono text-[0.65rem] uppercase tracking-wide">Later</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

export function AdminSidebar() {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function closeMobileNav() {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  }

  return (
    <>
      <details ref={detailsRef} className="rounded-lg border border-line bg-surface lg:hidden">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink">Admin</summary>
        <nav aria-label="Admin" className="border-t border-line p-2">
          <NavLinks onNavigate={closeMobileNav} />
        </nav>
      </details>
      <aside className="hidden min-w-0 shrink-0 lg:block lg:w-56">
        <nav
          aria-label="Admin"
          className="sticky top-4 rounded-lg border border-line bg-surface p-2"
        >
          <p className="px-3 pb-2 pt-1 font-mono text-xs uppercase tracking-wide text-ink-muted">
            Admin Dashboard
          </p>
          <NavLinks />
        </nav>
      </aside>
    </>
  );
}
