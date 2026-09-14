import { ButtonLink } from "@/components/ui/button";
import { RemoveFileButton } from "@/components/resources/remove-file-button";
import { formatBytes } from "@/lib/config/uploads";
import type { SubmissionFile } from "@/types/resources";

/**
 * Private file list for the contributor editor and the admin review page.
 * Downloads go through `/api/resource-files/[fileId]`, which re-checks
 * authorization and returns a short-lived signed URL for the private bucket.
 */
export function SubmissionFiles({
  resourceId,
  files,
  canRemove,
}: {
  resourceId: string;
  files: SubmissionFile[];
  canRemove: boolean;
}) {
  if (files.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-line px-4 py-3 text-sm text-ink-muted">
        No files yet. At least one file is required before this can be submitted for review.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
      {files.map((file) => (
        <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="break-all font-mono text-sm text-ink">{file.filename}</p>
            <p className="font-mono text-xs text-ink-muted">
              {file.fileType ?? "OTHER"} · {formatBytes(file.sizeBytes)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ButtonLink href={`/api/resource-files/${file.id}`} variant="secondary" size="sm">
              Download
              <span className="sr-only"> {file.filename}</span>
            </ButtonLink>
            {canRemove ? (
              <RemoveFileButton
                resourceId={resourceId}
                fileId={file.id}
                filename={file.filename}
              />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
