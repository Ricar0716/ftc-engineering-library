"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ResourceCopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const origin = window.location.origin;
    const url = `${origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => void copy()}>
      {copied ? "Link copied" : "Copy link"}
    </Button>
  );
}
