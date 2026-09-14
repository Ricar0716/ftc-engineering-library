import Link from "next/link";
import { displayVersionName } from "@/lib/versioning/validation";
import type { ResourceVersionSummary } from "@/types/resources";
import { cn } from "@/lib/utils/cn";

export function VersionSelector({
  slug,
  versions,
  selectedId,
}: {
  slug: string;
  versions: ResourceVersionSummary[];
  selectedId: string | null;
}) {
  if (versions.length <= 1) {
    return null;
  }

  const latestId = versions[0]?.id ?? null;

  return (
    <nav aria-label="Published versions" className="flex min-w-0 flex-wrap gap-2">
      {versions.map((version) => {
        const selected = version.id === selectedId;
        const href =
          version.id === latestId
            ? `/resources/${slug}`
            : `/resources/${slug}?version=${version.versionNumber}`;
        return (
          <Link
            key={version.id}
            href={href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "rounded-md border px-2.5 py-1 font-mono text-xs",
              selected
                ? "border-accent bg-accent-soft text-accent"
                : "border-line text-ink-muted hover:border-accent/40 hover:text-ink",
            )}
          >
            {displayVersionName(version)}
            {version.id === latestId ? " · Latest" : ""}
          </Link>
        );
      })}
    </nav>
  );
}
