import { ResourceGrid } from "@/components/resources/resource-grid";
import { ButtonLink } from "@/components/ui/button";
import { RESOURCE_TYPE_LABELS } from "@/lib/constants/resources";
import type { ResourceSummary, ResourceType } from "@/types/resources";

const SECTION_TITLES: Record<ResourceType, string> = {
  CAD: "Latest CAD designs",
  CODE: "Latest programming resources",
  TUTORIAL: "Latest tutorials",
  MODEL: "Latest models",
};

export function CategorySection({
  type,
  resources,
}: {
  type: ResourceType;
  resources: ResourceSummary[];
}) {
  if (resources.length === 0) {
    return null;
  }

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 items-end justify-between gap-3">
        <h2 className="min-w-0 text-xl font-medium">{SECTION_TITLES[type]}</h2>
        <ButtonLink href={`/explore?type=${type}`} variant="ghost" size="sm">
          Explore {RESOURCE_TYPE_LABELS[type]}
        </ButtonLink>
      </div>
      <ResourceGrid resources={resources} />
    </section>
  );
}
