import { RESOURCE_TYPE_LABELS, RESOURCE_TYPE_PURPOSE } from "@/lib/constants/resources";
import { cn } from "@/lib/utils/cn";
import type { ResourceType } from "@/types/resources";

const tones: Record<ResourceType, string> = {
  CAD: "bg-cad/10 text-cad",
  CODE: "bg-code/10 text-code",
  TUTORIAL: "bg-tutorial/10 text-tutorial",
  MODEL: "bg-model/10 text-model",
};

export function ResourceTypePlaceholder({
  type,
  className,
}: {
  type: ResourceType;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex aspect-[16/9] w-full flex-col items-start justify-end gap-1 px-4 py-3",
        tones[type],
        className,
      )}
      aria-hidden="true"
    >
      <p className="font-mono text-[11px] uppercase tracking-wide">{RESOURCE_TYPE_LABELS[type]}</p>
      <p className="text-sm font-medium">{RESOURCE_TYPE_PURPOSE[type]}</p>
    </div>
  );
}
