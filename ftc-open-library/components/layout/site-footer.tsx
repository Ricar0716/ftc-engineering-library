import Link from "next/link";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/lib/config/site";
import { primaryNav } from "@/lib/constants/navigation";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <Container
        width="wide"
        className="flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="max-w-sm">
          <p className="text-sm font-medium text-ink">
            {siteConfig.name}{" "}
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
              {siteConfig.betaLabel}
            </span>
          </p>
          <p className="mt-1 font-mono text-xs text-ink-muted">{siteConfig.philosophy}</p>
          <p className="mt-3 text-sm leading-6 text-ink-muted">{siteConfig.tagline}</p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-col gap-2 text-sm">
            {primaryNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-ink-muted hover:text-ink">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <a href="/download.html" className="text-ink-muted hover:text-ink">
                Download source
              </a>
            </li>
          </ul>
        </nav>
      </Container>
      <Container width="wide" className="border-t border-line py-4">
        <p className="text-xs leading-5 text-ink-muted">
          FTC Open Library is a community project and is not affiliated with FIRST. FIRST, FIRST
          Tech Challenge, and FTC are trademarks of FIRST.
        </p>
      </Container>
    </footer>
  );
}
