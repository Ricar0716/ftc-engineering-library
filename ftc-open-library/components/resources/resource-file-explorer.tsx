import { FileDownloadButton } from "@/components/resources/file-download-button";
import { EmptyState } from "@/components/ui/empty-state";
import { fileExtension, formatBytes } from "@/lib/config/uploads";
import { groupResourceFiles } from "@/lib/previews/groups";
import {
  DETAIL_EMPTY,
  fileDownloadHref,
  fileDownloadKind,
  fileDownloadLabel,
  previewAvailabilityLabel,
} from "@/lib/resources/detail-ui";
import type { AccessSnapshot } from "@/lib/auth/permissions";
import type { ResourceFileSummary, ResourceType } from "@/types/resources";

export function ResourceFileExplorer({
  files,
  access,
  resourceSlug,
  resourceType,
}: {
  files: ResourceFileSummary[];
  access: AccessSnapshot;
  resourceSlug: string;
  resourceType: ResourceType;
}) {
  const returnTo = `/resources/${resourceSlug}`;
  const groups = groupResourceFiles(files);
  const kind = fileDownloadKind(access);

  if (files.length === 0) {
    return (
      <EmptyState
        title={DETAIL_EMPTY.files}
        description="This published version has no downloadable files."
      />
    );
  }

  return (
    <div className="min-w-0 overflow-x-auto rounded-lg border border-line bg-surface">
      {groups.map((group) => (
        <section key={group.key} className="border-b border-line last:border-b-0">
          <h3 className="flex items-center gap-2 border-b border-line bg-canvas px-4 py-2 font-mono text-[11px] uppercase tracking-wide text-ink-muted">
            <span aria-hidden="true" className="text-ink">
              ▸
            </span>
            {group.label}
          </h3>
          <ul>
            {group.files.map((file) => {
              const extension = fileExtension(file.filename) || "file";
              const sizeLabel = file.sizeBytes != null ? formatBytes(file.sizeBytes) : null;
              const previewLabel = previewAvailabilityLabel(resourceType, file);

              return (
                <li
                  key={file.id}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <FileTypeMark filename={file.filename} />
                    <div className="min-w-0 flex-1">
                      <p className="break-all font-mono text-sm text-ink sm:truncate" title={file.filename}>
                        {file.filename}
                      </p>
                      <p className="font-mono text-xs text-ink-muted">
                        .{extension}
                        {sizeLabel ? ` · ${sizeLabel}` : ""}
                        {` · ${previewLabel}`}
                      </p>
                    </div>
                  </div>
                  <FileDownloadButton
                    href={fileDownloadHref(kind, { fileId: file.id, returnTo })}
                    kind={kind}
                    label={kind === "download" && sizeLabel ? `Download · ${sizeLabel}` : fileDownloadLabel(kind)}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FileTypeMark({ filename }: { filename: string }) {
  const extension = (fileExtension(filename) || "file").slice(0, 4);

  return (
    <span
      aria-hidden="true"
      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-canvas font-mono text-[10px] uppercase leading-none text-ink-muted"
    >
      {extension}
    </span>
  );
}
