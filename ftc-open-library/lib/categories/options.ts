import { buildCategoryTree } from "@/lib/categories/tree";
import type { Category, CategoryTreeNode } from "@/types/categories";

export type CategoryOption = {
  id: string;
  /** Full hierarchical path, e.g. `Launching > Flywheel > Dual Flywheel`. */
  label: string;
  depth: number;
};

/**
 * Flattens a taxonomy into depth-first select options that keep their
 * hierarchical context. Names come from the database; nothing is hardcoded, and
 * an empty taxonomy yields an empty list.
 */
export function categoryPathOptions(
  categories: readonly Category[],
  options?: { activeOnly?: boolean },
): CategoryOption[] {
  const tree = buildCategoryTree(categories, { activeOnly: options?.activeOnly ?? true });
  const flat: CategoryOption[] = [];

  function walk(nodes: readonly CategoryTreeNode[], trail: string[]) {
    for (const node of nodes) {
      const path = [...trail, node.name];
      flat.push({ id: node.id, label: path.join(" > "), depth: path.length - 1 });
      walk(node.children, path);
    }
  }

  walk(tree, []);
  return flat;
}
