import { ResourceGrid } from "@/components/resources/resource-grid";
import { ButtonLink } from "@/components/ui/button";
import type { ResourceSummary } from "@/types/resources";

export function FeaturedResources({ resources }: { resources: ResourceSummary[] }) {
  if (resources.length === 0) {
    return null;
  }

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-medium">Featured resources</h2>
          <p className="mt-1 text-sm text-ink-muted">Latest published work from the library.</p>
        </div>
        <ButtonLink href="/explore" variant="ghost" size="sm">
          Explore resources
        </ButtonLink>
      </div>
      <ResourceGrid resources={resources} />
    </section>
  );
}
