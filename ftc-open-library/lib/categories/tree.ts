import type {
  Category,
  CategoryBreadcrumbItem,
  CategoryTreeNode,
} from "@/types/categories";

export const CATEGORY_TREE_MAX_DEPTH = 32;

export function compareCategories(
  left: Pick<Category, "sortOrder" | "name">,
  right: Pick<Category, "sortOrder" | "name">,
): number {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }
  return left.name.localeCompare(right.name, "en", { sensitivity: "base" });
}

export function findCategoryById(
  categories: readonly Category[],
  id: string | null | undefined,
): Category | null {
  if (!id) {
    return null;
  }
  return categories.find((category) => category.id === id) ?? null;
}

export function buildCategoryTree(
  categories: readonly Category[],
  options?: { activeOnly?: boolean },
): CategoryTreeNode[] {
  const activeOnly = options?.activeOnly ?? false;
  const byId = new Map<string, Category>();

  for (const category of categories) {
    if (!category.id) {
      continue;
    }
    if (activeOnly && !category.isActive) {
      continue;
    }
    byId.set(category.id, category);
  }

  const childrenByParent = new Map<string | null, Category[]>();

  function addChild(parentId: string | null, category: Category) {
    const list = childrenByParent.get(parentId) ?? [];
    list.push(category);
    childrenByParent.set(parentId, list);
  }

  for (const category of byId.values()) {
    const parentExists = Boolean(category.parentId && byId.has(category.parentId));
    if (category.parentId && !parentExists) {
      if (activeOnly) {
        continue;
      }
      addChild(null, category);
      continue;
    }
    addChild(parentExists ? category.parentId : null, category);
  }

  const visiting = new Set<string>();

  function toNode(category: Category, depth: number): CategoryTreeNode | null {
    if (depth > CATEGORY_TREE_MAX_DEPTH || visiting.has(category.id)) {
      return null;
    }
    visiting.add(category.id);
    const rawChildren = [...(childrenByParent.get(category.id) ?? [])].sort(compareCategories);
    const children: CategoryTreeNode[] = [];
    for (const child of rawChildren) {
      const node = toNode(child, depth + 1);
      if (node) {
        children.push(node);
      }
    }
    visiting.delete(category.id);
    return { ...category, children };
  }

  const roots = [...(childrenByParent.get(null) ?? [])].sort(compareCategories);
  const tree: CategoryTreeNode[] = [];
  for (const root of roots) {
    const node = toNode(root, 0);
    if (node) {
      tree.push(node);
    }
  }
  return tree;
}

export function flattenCategoryTree(nodes: readonly CategoryTreeNode[]): Category[] {
  const flat: Category[] = [];
  const stack = [...nodes];
  const seen = new Set<string>();

  while (stack.length > 0) {
    const node = stack.shift();
    if (!node || seen.has(node.id)) {
      continue;
    }
    seen.add(node.id);
    const { children, ...category } = node;
    flat.push(category);
    stack.unshift(...children);
  }

  return flat;
}

export function getCategoryAncestors(
  categories: readonly Category[],
  id: string,
): Category[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const chain: Category[] = [];
  const seen = new Set<string>();
  let current = byId.get(id) ?? null;

  while (current && !seen.has(current.id) && chain.length < CATEGORY_TREE_MAX_DEPTH) {
    seen.add(current.id);
    chain.push(current);
    current = current.parentId ? (byId.get(current.parentId) ?? null) : null;
  }

  chain.reverse();
  return chain;
}

export function getCategoryBreadcrumb(
  categories: readonly Category[],
  id: string | null | undefined,
): CategoryBreadcrumbItem[] {
  if (!id) {
    return [];
  }
  return getCategoryAncestors(categories, id).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    resourceType: category.resourceType,
  }));
}

export function getCategoryDescendants(
  categories: readonly Category[],
  id: string,
  options?: { includeSelf?: boolean },
): string[] {
  const includeSelf = options?.includeSelf ?? true;
  const childrenByParent = new Map<string, Category[]>();

  for (const category of categories) {
    if (!category.parentId) {
      continue;
    }
    const list = childrenByParent.get(category.parentId) ?? [];
    list.push(category);
    childrenByParent.set(category.parentId, list);
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  const queue: { id: string; depth: number }[] = [{ id, depth: 0 }];

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next || seen.has(next.id) || next.depth > CATEGORY_TREE_MAX_DEPTH) {
      continue;
    }
    seen.add(next.id);
    if (includeSelf || next.id !== id) {
      ids.push(next.id);
    }
    for (const child of childrenByParent.get(next.id) ?? []) {
      queue.push({ id: child.id, depth: next.depth + 1 });
    }
  }

  return ids;
}
