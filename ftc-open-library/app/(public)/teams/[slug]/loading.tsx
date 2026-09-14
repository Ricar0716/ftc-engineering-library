import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function TeamLoading() {
  return (
    <main id="main-content">
      <Container width="wide" className="flex flex-col gap-4 py-10">
        <div className="flex gap-4">
          <Skeleton className="h-20 w-20" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-16 w-full max-w-xl" />
          </div>
        </div>
        <Skeleton className="mt-8 h-40 w-full" />
      </Container>
    </main>
  );
}
