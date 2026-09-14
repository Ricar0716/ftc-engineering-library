import { Container } from "@/components/ui/container";
import { ResourceGridSkeleton } from "@/components/resources/resource-grid-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function PublicLoading() {
  return (
    <main id="main-content">
      <Container width="wide" className="flex flex-col gap-6 py-10">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <ResourceGridSkeleton />
      </Container>
    </main>
  );
}
