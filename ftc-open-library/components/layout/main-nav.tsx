"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { isPrimaryNavActive, primaryNav } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";

export function MainNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav
      aria-label="Primary"
      className={cn("flex min-w-0 items-center gap-0.5 overflow-x-auto", className)}
    >
      {primaryNav.map((item) => {
        const active = isPrimaryNavActive(item.href, pathname, searchParams);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-2 py-1.5 text-sm transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              active
                ? "bg-accent-soft font-medium text-accent"
                : "text-ink-muted hover:bg-canvas hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
