"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function ResourcePreviewCard({ children }: { children: React.ReactNode }) {
  const hostRef = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    function onChange() {
      setFullscreen(document.fullscreenElement === hostRef.current);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    const host = hostRef.current;
    if (!host || typeof document === "undefined" || !document.fullscreenEnabled) {
      return;
    }
    try {
      if (document.fullscreenElement === host) {
        await document.exitFullscreen();
      } else {
        await host.requestFullscreen();
      }
    } catch {
      // Fullscreen can be denied; the preview remains usable in-page.
    }
  }

  return (
    <section
      ref={hostRef}
      id="preview"
      className="scroll-mt-20 overflow-hidden rounded-lg border border-line bg-surface [:fullscreen]:min-h-dvh [:fullscreen]:rounded-none [:fullscreen]:bg-canvas"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="text-lg font-medium text-ink">Preview</h2>
        <Button type="button" variant="secondary" size="sm" onClick={() => void toggleFullscreen()}>
          {fullscreen ? "Exit fullscreen" : "Fullscreen"}
        </Button>
      </div>
      <div className="min-w-0 p-4">{children}</div>
    </section>
  );
}
