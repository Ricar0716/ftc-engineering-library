"use client";

import { DiscoveryError } from "@/components/layout/discovery-error";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DiscoveryError error={error} retry={reset} />;
}
