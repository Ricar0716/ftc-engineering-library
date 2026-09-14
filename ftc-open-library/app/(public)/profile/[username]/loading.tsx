import { Container } from "@/components/ui/container";
import { ResourceGridSkeleton } from "@/components/resources/resource-grid-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <main id="main-content">
      <Container width="wide" className="flex min-w-0 flex-col gap-4 py-10">
        <div className="flex gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-16 w-full max-w-xl" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <ResourceGridSkeleton />
      </Container>
    </main>
  );
}
