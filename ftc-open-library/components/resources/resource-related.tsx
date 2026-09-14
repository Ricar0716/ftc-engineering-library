import { ResourceGrid } from "@/components/resources/resource-grid";
import type { ResourceSummary } from "@/types/resources";

export function ResourceRelated({ resources }: { resources: ResourceSummary[] }) {
  if (resources.length === 0) {
    return null;
  }

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h2 className="text-lg font-medium">Related resources</h2>
      <ResourceGrid resources={resources} />
    </section>
  );
}
