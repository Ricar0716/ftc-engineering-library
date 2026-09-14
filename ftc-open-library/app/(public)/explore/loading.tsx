import { Container } from "@/components/ui/container";
import { ResourceGridSkeleton } from "@/components/resources/resource-grid-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function ExploreLoading() {
  return (
    <main id="main-content">
      <Container width="wide" className="grid min-w-0 gap-8 py-10 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="hidden lg:flex lg:flex-col lg:gap-3">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Skeleton className="h-10 w-full sm:hidden" />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Skeleton className="h-10 min-w-0 flex-1" />
            <Skeleton className="h-10 w-full sm:w-56" />
          </div>
          <ResourceGridSkeleton />
        </div>
      </Container>
    </main>
  );
}
