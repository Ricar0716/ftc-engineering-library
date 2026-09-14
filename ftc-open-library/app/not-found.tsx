import { notFoundMetadata } from "@/lib/seo/metadata";
import { NotFoundPanel } from "@/components/layout/not-found-panel";

export const metadata = notFoundMetadata("page");

export default function NotFound() {
  return (
    <NotFoundPanel
      title="Page not found"
      description="The page may have moved, been removed, or may not be publicly available."
    />
  );
}
