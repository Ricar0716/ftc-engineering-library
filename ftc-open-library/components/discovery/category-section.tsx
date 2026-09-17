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

const SECTION_BLURBS: Record<ResourceType, string> = {
  CAD: "Recently published robot mechanisms, assemblies, and parts.",
  CODE: "Recently published TeleOp, autonomous, and control examples.",
  TUTORIAL: "Recently published guides for building, CAD, and programming.",
  MODEL: "Recently published calculators, simulators, and engineering visualizers.",
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
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-medium">{SECTION_TITLES[type]}</h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">{SECTION_BLURBS[type]}</p>
        </div>
        <ButtonLink href={`/explore?type=${type}`} variant="ghost" size="sm" className="shrink-0">
          Explore {RESOURCE_TYPE_LABELS[type]}
        </ButtonLink>
      </div>
      <ResourceGrid resources={resources} />
    </section>
  );
}
