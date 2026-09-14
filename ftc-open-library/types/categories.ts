import type { ResourceType } from "@/types/resources";

export type Category = {
  id: string;
  name: string;
  slug: string;
  resourceType: ResourceType;
  parentId: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type CategoryTreeNode = Category & {
  children: CategoryTreeNode[];
};

export type CategoryBreadcrumbItem = {
  id: string;
  name: string;
  slug: string;
  resourceType: ResourceType;
};
