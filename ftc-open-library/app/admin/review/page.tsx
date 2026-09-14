import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Version review",
  description: "New versions of published resources awaiting Site Admin review.",
};

/** Previous mixed queue. First publishes live on /admin/resources; versions on /admin/versions. */
export default function ReviewQueueRedirectPage() {
  redirect("/admin/versions");
}
