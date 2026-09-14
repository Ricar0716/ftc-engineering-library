import { ResourceCard } from "@/components/resources/resource-card";
import { cn } from "@/lib/utils/cn";
import type { ResourceSummary } from "@/types/resources";

export function ResourceGrid({
  resources,
  className,
}: {
  resources: ResourceSummary[];
  className?: string;
}) {
  return (
    <ul className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {resources.map((resource) => (
        <li key={resource.id}>
          <ResourceCard resource={resource} />
        </li>
      ))}
    </ul>
  );
}
