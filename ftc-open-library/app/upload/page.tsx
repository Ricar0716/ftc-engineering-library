import { permanentRedirect } from "next/navigation";
import { noIndexRobots } from "@/lib/seo/robots";

/**
 * `/upload` was the placeholder route before contribution existed. Submission
 * now lives at `/submit`, and there is only one contribution flow.
 */
export const metadata = {
  robots: noIndexRobots,
};

export default function UploadPage() {
  permanentRedirect("/submit");
}
