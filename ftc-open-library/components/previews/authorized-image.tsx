"use client";

import { useEffect, useState } from "react";
import { fetchPreviewBytes } from "@/lib/previews/client";
import type { ResourceFileSummary } from "@/types/resources";

export function AuthorizedImage({ file }: { file: ResourceFileSummary }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function load() {
      const result = await fetchPreviewBytes(file.id);
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const blob = new Blob([result.buffer], { type: result.mimeType ?? "image/png" });
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    }

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file.id, retryNonce]);

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-line px-3 py-6 text-sm text-ink-muted">
        <p>{error}</p>
        <button
          type="button"
          className="mt-2 text-sm text-ink underline-offset-2 hover:underline"
          onClick={() => {
            setError(null);
            setRetryNonce((value) => value + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!src) {
    return (
      <p className="rounded-lg border border-dashed border-line px-3 py-6 text-sm text-ink-muted">
        Loading image…
      </p>
    );
  }

  return (
    <figure className="overflow-hidden rounded-lg border border-line bg-surface">
      {/* blob: URLs only; originals stay behind signed preview authorization */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={file.filename} className="h-auto w-full object-contain" />
      <figcaption className="truncate px-3 py-2 font-mono text-[11px] text-ink-muted">
        {file.filename}
      </figcaption>
    </figure>
  );
}
