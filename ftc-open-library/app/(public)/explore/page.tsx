import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceFilters } from "@/components/search/resource-filters";
import { SearchResults } from "@/components/search/search-results";
import { listCategories, listSeasons, listTags } from "@/lib/db/catalog";
import { listPublishedResources } from "@/lib/db/resources";
import { RESOURCE_TYPE_LABELS } from "@/lib/constants/resources";
import { parseExploreSearchParams } from "@/lib/search/params";
import { exploreIsIndexable, publicPageMetadata } from "@/lib/seo/metadata";
import { isUuid } from "@/lib/utils/id";
import { buildCategoryTree, findCategoryById } from "@/lib/categories/tree";

type ExplorePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const EXPLORE_DESCRIPTION =
  "Search and filter published FTC CAD, code, tutorials, and models.";

export async function generateMetadata({ searchParams }: ExplorePageProps): Promise<Metadata> {
  const query = await searchParams;
  const indexable = exploreIsIndexable(query);

  return publicPageMetadata({
    title: "Explore FTC Robotics Resources",
    description: EXPLORE_DESCRIPTION,
    path: "/explore",
    index: indexable,
  });
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const filters = parseExploreSearchParams(await searchParams);
  const typeLabel = filters.type ? RESOURCE_TYPE_LABELS[filters.type] : null;

  const [categories, tags, seasons, list] = await Promise.all([
    listCategories(filters.type),
    listTags(),
    listSeasons(),
    listPublishedResources({
      query: filters.q,
      resourceType: filters.type,
      categoryId: filters.category && isUuid(filters.category) ? filters.category : null,
      tagSlug: filters.tag,
      seasonLabel: filters.season,
      sort: filters.sort,
      page: filters.page,
    }),
  ]);

  const categoryTree = buildCategoryTree(categories, { activeOnly: true });
  const selectedCategory = findCategoryById(categories, filters.category);
  const categoryLabel = selectedCategory?.name ?? null;
  const tagLabel = tags.find((item) => item.slug === filters.tag)?.name ?? null;

  return (
    <main id="main-content">
      <PageHeader
        eyebrow="Library"
        title={typeLabel ?? "Explore"}
        description="Search published CAD, code, tutorials, and models. Filters stay in the URL so results can be shared."
      />
      <Container width="wide" className="grid min-w-0 gap-8 pb-16 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="min-w-0">
          <div className="hidden lg:block">
            <ResourceFilters
              filters={filters}
              categoryTree={categoryTree}
              tags={tags}
              seasons={seasons}
            />
          </div>
          <details className="rounded-lg border border-line bg-surface p-4 lg:hidden">
            <summary className="cursor-pointer text-sm font-medium">Filters</summary>
            <div className="mt-4">
              <ResourceFilters
                filters={filters}
                categoryTree={categoryTree}
                tags={tags}
                seasons={seasons}
              />
            </div>
          </details>
        </aside>
        <section className="flex min-w-0 flex-col gap-4">
          <SearchResults
            filters={filters}
            list={list}
            categoryLabel={categoryLabel}
            tagLabel={tagLabel}
          />
        </section>
      </Container>
    </main>
  );
}
