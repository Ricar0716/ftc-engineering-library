import Link from "next/link";
import { CATEGORY_TREE_MAX_DEPTH } from "@/lib/categories/tree";
import { RESOURCE_TYPE_LABELS } from "@/lib/constants/resources";
import { explorePathWith, type ExploreSearchParams } from "@/lib/search/params";
import type { CategoryTreeNode } from "@/types/categories";
import type { ResourceType } from "@/types/resources";

function CategoryTreeItems({
  nodes,
  filters,
  depth,
}: {
  nodes: readonly CategoryTreeNode[];
  filters: ExploreSearchParams;
  depth: number;
}) {
  if (nodes.length === 0 || depth > CATEGORY_TREE_MAX_DEPTH) {
    return null;
  }

  return (
    <ul className={depth === 0 ? "flex flex-col gap-0.5" : "mt-0.5 flex flex-col gap-0.5 border-l border-line pl-3"}>
      {nodes.map((node) => {
        const selected = filters.category === node.id;
        return (
          <li key={node.id} className="min-w-0">
            <Link
              href={explorePathWith(filters, { category: node.id, type: node.resourceType })}
              aria-current={selected ? "page" : undefined}
              className={
                selected
                  ? "block truncate rounded-md bg-accent-soft px-2 py-1 text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  : "block truncate rounded-md px-2 py-1 text-sm text-ink-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              }
            >
              {node.name}
            </Link>
            {node.children.length > 0 ? (
              <CategoryTreeItems nodes={node.children} filters={filters} depth={depth + 1} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function CategoryTree({
  resourceType,
  nodes,
  filters,
}: {
  resourceType: ResourceType;
  nodes: readonly CategoryTreeNode[];
  filters: ExploreSearchParams;
}) {
  return (
    <nav
      aria-label={`${RESOURCE_TYPE_LABELS[resourceType]} categories`}
      className="min-w-0 overflow-x-auto"
    >
      <p className="mb-2 text-sm font-medium text-ink">Categories</p>
      {nodes.length === 0 ? (
        <p className="text-sm text-ink-muted">No categories yet.</p>
      ) : (
        <>
          <Link
            href={explorePathWith(filters, { category: null, type: resourceType })}
            className={
              !filters.category
                ? "mb-1 block rounded-md bg-accent-soft px-2 py-1 text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                : "mb-1 block rounded-md px-2 py-1 text-sm text-ink-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            }
          >
            All {RESOURCE_TYPE_LABELS[resourceType]}
          </Link>
          <CategoryTreeItems nodes={nodes} filters={filters} depth={0} />
        </>
      )}
    </nav>
  );
}
