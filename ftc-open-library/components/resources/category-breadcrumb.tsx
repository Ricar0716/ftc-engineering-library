import Link from "next/link";
import type { ResourceType } from "@/types/resources";

export function CategoryBreadcrumb({
  resourceType,
  items,
}: {
  resourceType: ResourceType;
  items: readonly { id: string; name: string }[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <>
      {items.map((item) => (
        <li key={item.id} className="flex min-w-0 items-center gap-x-2">
          <span aria-hidden="true">→</span>
          <Link
            href={`/explore?type=${resourceType}&category=${item.id}`}
            className="max-w-full break-words hover:text-ink"
          >
            {item.name}
          </Link>
        </li>
      ))}
    </>
  );
}
