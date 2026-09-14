import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { requireSignedInPage } from "@/lib/auth/session";
import { noIndexRobots } from "@/lib/seo/robots";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: noIndexRobots,
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSignedInPage("/dashboard");

  return (
    <main id="main-content">
      <Container width="wide" className="flex min-w-0 flex-col gap-4 py-8 lg:flex-row lg:items-start">
        <DashboardSidebar />
        <div className="flex min-w-0 flex-1 flex-col gap-6 pb-16">{children}</div>
      </Container>
    </main>
  );
}
