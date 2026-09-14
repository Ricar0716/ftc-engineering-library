import Link from "next/link";
import type { ResourceTag } from "@/types/resources";

export function ResourceTags({ tags }: { tags: readonly ResourceTag[] | undefined }) {
  if (!tags || tags.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li key={tag.slug}>
          <Link
            href={`/explore?tag=${encodeURIComponent(tag.slug)}`}
            className="rounded-md border border-line bg-surface px-2 py-1 font-mono text-xs text-ink-muted hover:border-accent/40 hover:text-ink"
          >
            {tag.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
