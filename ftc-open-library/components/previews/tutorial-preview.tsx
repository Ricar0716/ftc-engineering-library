"use client";

import { useEffect, useMemo, useState } from "react";
import { FileDownloadButton } from "@/components/resources/file-download-button";
import { PreviewAuthGate } from "@/components/previews/preview-auth-gate";
import { PreviewFallback } from "@/components/previews/preview-fallback";
import { formatBytes } from "@/lib/config/uploads";
import type { AccessSnapshot } from "@/lib/auth/permissions";
import { canDownload } from "@/lib/auth/permissions";
import { fileDownloadHref, fileDownloadKind, fileDownloadLabel } from "@/lib/resources/detail-ui";
import { fetchPreviewBytes } from "@/lib/previews/client";
import { decodeText, highlightSource, looksBinary } from "@/lib/previews/highlight";
import { filePreviewKind } from "@/lib/previews/select";
import type { ResourceFileSummary } from "@/types/resources";
import { AuthorizedImage } from "@/components/previews/authorized-image";

export function TutorialPreview({
  files,
  access,
  resourceSlug,
}: {
  files: ResourceFileSummary[];
  access: AccessSnapshot;
  resourceSlug: string;
}) {
  const images = useMemo(
    () => files.filter((file) => filePreviewKind("TUTORIAL", file) === "image"),
    [files],
  );
  const notes = useMemo(
    () => files.filter((file) => filePreviewKind("TUTORIAL", file) === "markdown"),
    [files],
  );
  const videos = useMemo(
    () => files.filter((file) => filePreviewKind("TUTORIAL", file) === "video-download"),
    [files],
  );
  const [noteId, setNoteId] = useState(notes[0]?.id ?? "");
  const selectedNote = notes.find((file) => file.id === noteId) ?? notes[0] ?? null;

  if (images.length === 0 && notes.length === 0 && videos.length === 0) {
    return (
      <PreviewFallback
        title="This tutorial does not have an online preview yet."
        description="Read the write-up below and download attachments you are authorized to access. Uploaded videos stay private files, not a public stream."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {videos.length > 0 ? (
        <div className="rounded-lg border border-line bg-surface p-4">
          <h3 className="text-sm font-medium text-ink">Instructional video</h3>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            Video preview unavailable. Download the published file if you have access. Videos stay
            private files, not a public stream.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {videos.map((file) => {
              const kind = fileDownloadKind(access);
              const returnTo = `/resources/${resourceSlug}`;
              return (
                <li
                  key={file.id}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-2 font-mono text-sm"
                >
                  <span className="min-w-0 break-all text-ink sm:truncate">
                    {file.filename}
                    {file.sizeBytes != null ? ` · ${formatBytes(file.sizeBytes)}` : ""}
                  </span>
                  <FileDownloadButton
                    href={fileDownloadHref(kind, { fileId: file.id, returnTo })}
                    kind={kind}
                    label={kind === "download" ? "Download video" : fileDownloadLabel(kind)}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {images.length > 0 ? (
        <PreviewAuthGate access={access} resourceSlug={resourceSlug}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {images.map((file) => (
              <li key={file.id}>
                <AuthorizedImage file={file} />
              </li>
            ))}
          </ul>
        </PreviewAuthGate>
      ) : null}

      {notes.length > 0 ? (
        <div className="flex flex-col gap-3">
          {notes.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {notes.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  className="rounded-md border border-line px-2 py-1 font-mono text-xs hover:border-accent/40"
                  onClick={() => setNoteId(file.id)}
                >
                  {file.filename}
                </button>
              ))}
            </div>
          ) : null}
          <PreviewAuthGate access={access} resourceSlug={resourceSlug}>
            {selectedNote && canDownload(access) ? <MarkdownView file={selectedNote} /> : null}
          </PreviewAuthGate>
        </div>
      ) : null}
    </div>
  );
}

function MarkdownView({ file }: { file: ResourceFileSummary }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Loading notes…");
  const [html, setHtml] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await fetchPreviewBytes(file.id);
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setStatus("error");
        setMessage(result.message);
        return;
      }
      if (looksBinary(result.buffer)) {
        setStatus("error");
        setMessage("Download this file to view it.");
        return;
      }
      setHtml(highlightSource(file.filename, decodeText(result.buffer)));
      setStatus("ready");
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [file.id, file.filename]);

  if (status !== "ready") {
    return <p className="text-sm text-ink-muted">{message}</p>;
  }

  return (
    <div className="max-h-[28rem] overflow-auto rounded-lg border border-line bg-surface p-4">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-ink-muted">
        {file.filename}
      </p>
      <pre className="hljs whitespace-pre-wrap font-mono text-[13px] leading-6">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}
