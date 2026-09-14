import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function ResourceLoading() {
  return (
    <main id="main-content">
      <Container width="wide" className="flex flex-col gap-4 py-10">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-20 w-full max-w-3xl" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </Container>
    </main>
  );
}
