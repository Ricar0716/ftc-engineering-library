import { notFoundMetadata } from "@/lib/seo/metadata";
import { NotFoundPanel } from "@/components/layout/not-found-panel";

export const metadata = notFoundMetadata("profile");

export default function ProfileNotFound() {
  return (
    <NotFoundPanel
      title="Profile not found"
      description="This profile is not available."
    />
  );
}
