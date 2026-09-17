import { ResourceGrid } from "@/components/resources/resource-grid";
import { ButtonLink } from "@/components/ui/button";
import type { ResourceSummary } from "@/types/resources";

export function PopularResources({ resources }: { resources: ResourceSummary[] }) {
  if (resources.length === 0) {
    return null;
  }

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-medium">Popular resources</h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            Popular CAD, code, tutorials, and engineering models from the FTC community.
          </p>
        </div>
        <ButtonLink href="/explore?sort=downloads" variant="ghost" size="sm" className="shrink-0">
          Explore popular
        </ButtonLink>
      </div>
      <ResourceGrid resources={resources} />
    </section>
  );
}
