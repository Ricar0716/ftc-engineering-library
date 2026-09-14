import { notFoundMetadata } from "@/lib/seo/metadata";
import { NotFoundPanel } from "@/components/layout/not-found-panel";

export const metadata = notFoundMetadata("team");

export default function TeamNotFound() {
  return (
    <NotFoundPanel
      title="Team not found"
      description="This team is not available."
      secondaryHref="/teams"
      secondaryLabel="Browse teams"
    />
  );
}
