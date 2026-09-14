import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MyResourcesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  if (notice) {
    redirect(`/dashboard/resources?notice=${encodeURIComponent(notice)}`);
  }
  redirect("/dashboard/resources");
}
