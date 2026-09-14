"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isDashboardNavActive, visibleDashboardNav } from "@/lib/dashboard/nav";
import { cn } from "@/lib/utils/cn";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <ul className="flex flex-col gap-1">
      {visibleDashboardNav().map((item) => {
        const active = isDashboardNavActive(item.href, pathname, item.exact);
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
    </ul>
  );
}

export function DashboardSidebar() {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function closeMobileNav() {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  }

  return (
    <>
      <details ref={detailsRef} className="rounded-lg border border-line bg-surface lg:hidden">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink">
          Workspace
        </summary>
        <nav aria-label="Dashboard" className="border-t border-line p-2">
          <NavLinks onNavigate={closeMobileNav} />
        </nav>
      </details>
      <aside className="hidden min-w-0 shrink-0 lg:block lg:w-56">
        <nav
          aria-label="Dashboard"
          className="sticky top-4 rounded-lg border border-line bg-surface p-2"
        >
          <p className="px-3 pb-2 pt-1 font-mono text-xs uppercase tracking-wide text-ink-muted">
            My Dashboard
          </p>
          <NavLinks />
        </nav>
      </aside>
    </>
  );
}
