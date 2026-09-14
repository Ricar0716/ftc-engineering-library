import { AdminHeader } from "@/components/admin/admin-header";
import { CategoryManager } from "@/components/admin/category-manager";
import { CATEGORY_NOTICES, parseAdminCategorySearch } from "@/lib/admin/category-search";
import { countCategoryResources, listCategories } from "@/lib/db/catalog";
import { findCategoryById, buildCategoryTree } from "@/lib/categories/tree";
import { RESOURCE_TYPE_LABELS } from "@/lib/constants/resources";

export const metadata = {
  title: "Categories",
  description: "Manage Resource Type category trees.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminCategoriesPage({ searchParams }: PageProps) {
  const parsed = parseAdminCategorySearch(await searchParams);
  const categories = await listCategories(parsed.resourceType);
  const tree = buildCategoryTree(categories);
  const selected = findCategoryById(categories, parsed.selectedId);
  const parentPreset = findCategoryById(categories, parsed.parentId);
  const mode = parsed.mode === "create" || categories.length === 0 ? "create" : "edit";
  const childCount = selected ? categories.filter((category) => category.parentId === selected.id).length : 0;
  const resourceCount = selected ? await countCategoryResources(selected.id) : 0;

  return (
    <>
      <AdminHeader
        title="Categories"
        description={`${RESOURCE_TYPE_LABELS[parsed.resourceType]} has its own tree. Inactive rows stay in the database and are hidden from public browsing.`}
      />
      {parsed.notice ? (
        <p role="status" className="text-sm text-ink">
          {CATEGORY_NOTICES[parsed.notice]}
        </p>
      ) : null}
      <CategoryManager
        resourceType={parsed.resourceType}
        categories={categories}
        tree={tree}
        selected={mode === "create" ? null : selected}
        mode={mode}
        defaultParentId={parentPreset?.id ?? null}
        childCount={childCount}
        resourceCount={resourceCount}
      />
    </>
  );
}
