import { notFoundMetadata } from "@/lib/seo/metadata";
import { NotFoundPanel } from "@/components/layout/not-found-panel";

export const metadata = notFoundMetadata("resource");

export default function ResourceNotFound() {
  return (
    <NotFoundPanel
      title="Resource not found"
      description="This resource is not available."
    />
  );
}
