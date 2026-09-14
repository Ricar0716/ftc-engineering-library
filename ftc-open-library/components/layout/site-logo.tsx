import Link from "next/link";
import { siteConfig } from "@/lib/config/site";
import { cn } from "@/lib/utils/cn";

export function SiteLogo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("flex min-w-0 items-center gap-2 text-ink no-underline sm:gap-2.5", className)}
    >
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface font-mono text-[11px] font-medium text-accent"
      >
        FTC
      </span>
      <span className="min-w-0 truncate text-sm font-medium tracking-tight max-[22rem]:hidden sm:text-[15px]">
        {siteConfig.name}
      </span>
      <span className="shrink-0 rounded-sm border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
        {siteConfig.betaLabel}
      </span>
    </Link>
  );
}
