import { VersionCard } from "@/components/versioning/version-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { ResourceVersionSummary } from "@/types/resources";

export function VersionHistory({
  slug,
  versions,
  selectedId,
}: {
  slug: string;
  versions: ResourceVersionSummary[];
  selectedId: string | null;
}) {
  if (versions.length === 0) {
    return (
      <section id="versions" className="flex min-w-0 scroll-mt-20 flex-col gap-3">
        <h2 className="text-lg font-medium">Versions</h2>
        <EmptyState
          title="No published versions yet."
          description="Released revisions will appear here with their changelogs."
        />
      </section>
    );
  }

  const latestId = versions[0]?.id ?? null;

  return (
    <section id="versions" className="flex min-w-0 scroll-mt-20 flex-col gap-3">
      <div>
        <h2 className="text-lg font-medium">Versions</h2>
        <p className="mt-1 text-sm text-ink-muted">
          History of published releases. Preview and downloads follow the version you select. This is
          not a git diff.
        </p>
      </div>
      <ol className="flex min-w-0 flex-col gap-3">
        {versions.map((version) => (
          <li key={version.id}>
            <VersionCard
              version={version}
              slug={slug}
              latest={version.id === latestId}
              selected={version.id === selectedId}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
