"use client";

import { useEffect, useMemo, useState } from "react";
import { PreviewAuthGate } from "@/components/previews/preview-auth-gate";
import { PreviewFallback } from "@/components/previews/preview-fallback";
import { formatBytes } from "@/lib/config/uploads";
import type { AccessSnapshot } from "@/lib/auth/permissions";
import { canDownload } from "@/lib/auth/permissions";
import { fetchPreviewBytes } from "@/lib/previews/client";
import { buildSourceFileTree, type SourceTreeNode } from "@/lib/previews/file-tree";
import { decodeText, highlightSource, looksBinary } from "@/lib/previews/highlight";
import { codeListedFiles, languageLabelFor, tooLargeForPreview } from "@/lib/previews/select";
import { cn } from "@/lib/utils/cn";
import type { ResourceFileSummary } from "@/types/resources";

export function CodePreview({
  files,
  access,
  resourceSlug,
}: {
  files: ResourceFileSummary[];
  access: AccessSnapshot;
  resourceSlug: string;
}) {
  const listed = useMemo(() => codeListedFiles(files), [files]);
  const tree = useMemo(() => buildSourceFileTree(listed), [listed]);
  const [selectedId, setSelectedId] = useState(listed[0]?.id ?? "");
  const selected = listed.find((file) => file.id === selectedId) ?? listed[0] ?? null;

  if (listed.length === 0) {
    return (
      <PreviewFallback
        title="This code resource does not have an online preview yet."
        description="Java, Kotlin, C++, Python, and related source files can be inspected here after you sign in. ZIP archives stay download-only."
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 lg:flex-row">
      <nav
        aria-label="Source files"
        className="max-h-64 min-w-0 overflow-auto rounded-lg border border-line bg-surface lg:max-h-[28rem] lg:w-64 lg:shrink-0"
      >
        <p className="border-b border-line bg-canvas px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-ink-muted">
          {tree.name}/
        </p>
        <SourceTreeChildren
          nodes={tree.children}
          selectedId={selected?.id ?? ""}
          onSelect={setSelectedId}
        />
      </nav>
      <div className="min-w-0 flex-1">
        {selected && tooLargeForPreview("CODE", selected) ? (
          <PreviewFallback
            title="Download file to view"
            description="This source file is too large to load in the browser. Use the download action in the file list."
          />
        ) : (
          <PreviewAuthGate access={access} resourceSlug={resourceSlug}>
            {selected && canDownload(access) ? <CodeFileView file={selected} /> : null}
          </PreviewAuthGate>
        )}
      </div>
    </div>
  );
}

function SourceTreeChildren({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: SourceTreeNode[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ul>
      {nodes.map((node, index) => {
        const branch = index === nodes.length - 1 ? "└── " : "├── ";
        if (node.kind === "folder") {
          return (
            <li key={`folder-${node.name}`}>
              <p className="truncate px-3 py-1 font-mono text-xs text-ink-muted">
                {branch}
                {node.name}/
              </p>
              <div className="pl-4">
                <SourceTreeChildren
                  nodes={node.children}
                  selectedId={selectedId}
                  onSelect={onSelect}
                />
              </div>
            </li>
          );
        }

        const oversized = tooLargeForPreview("CODE", node.file);
        return (
          <li key={node.file.id}>
            <button
              type="button"
              className={cn(
                "flex w-full min-w-0 flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-accent-soft",
                selectedId === node.file.id ? "bg-accent-soft" : "",
              )}
              onClick={() => onSelect(node.file.id)}
            >
              <span className="w-full truncate font-mono text-sm text-ink">
                {branch}
                {node.name}
              </span>
              <span className="font-mono text-[11px] text-ink-muted">
                {oversized ? "Download to view" : languageLabelFor(node.file.filename)}
                {node.file.sizeBytes != null ? ` · ${formatBytes(node.file.sizeBytes)}` : ""}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CodeFileView({ file }: { file: ResourceFileSummary }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Loading source…");
  const [html, setHtml] = useState("");
  const [lineCount, setLineCount] = useState(0);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus("loading");
      setMessage("Loading source…");
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
        setMessage("Download this file to view it. It does not look like source text.");
        return;
      }
      const source = decodeText(result.buffer);
      const lines = source.split(/\r\n|\n|\r/);
      setLineCount(lines.length);
      setHtml(highlightSource(file.filename, source));
      setStatus("ready");
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [file.id, file.filename, retryNonce]);

  if (status !== "ready") {
    return (
      <div className="rounded-lg border border-dashed border-line bg-surface px-4 py-8 text-sm text-ink-muted">
        <p>{message}</p>
        {status === "error" ? (
          <button
            type="button"
            className="mt-3 text-sm text-ink underline-offset-2 hover:underline"
            onClick={() => setRetryNonce((value) => value + 1)}
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <p className="min-w-0 truncate font-mono text-xs text-ink">{file.filename}</p>
        <p className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
          {languageLabelFor(file.filename)}
        </p>
      </div>
      <div className="max-h-[28rem] overflow-auto">
        <table className="w-full border-collapse font-mono text-[12px] leading-5">
          <tbody>
            <tr>
              <td className="select-none border-r border-line bg-canvas px-2 py-3 align-top text-right text-ink-muted">
                {Array.from({ length: lineCount }, (_, index) => (
                  <div key={index}>{index + 1}</div>
                ))}
              </td>
              <td className="px-3 py-3 align-top text-ink">
                <pre className="hljs whitespace-pre">
                  <code dangerouslySetInnerHTML={{ __html: html }} />
                </pre>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
