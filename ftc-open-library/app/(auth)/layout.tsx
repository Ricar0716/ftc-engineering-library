import type { Metadata } from "next";
import { noIndexRobots } from "@/lib/seo/robots";

export const metadata: Metadata = {
  robots: noIndexRobots,
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
