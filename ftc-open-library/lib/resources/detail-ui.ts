import { loginPath } from "../auth/paths.ts";
import { canDownload, type AccessSnapshot } from "../auth/permissions.ts";
import { filePreviewKind, tooLargeForPreview } from "../previews/select.ts";
import type { ResourceFileSummary, ResourceType } from "../../types/resources.ts";

export const DETAIL_EMPTY = {
  preview: "No preview available.",
  files: "No downloadable files available.",
  related: "No related resources yet.",
  description: "No overview was provided for this resource.",
  discussion: "No discussion yet. Ask a technical question or share an improvement.",
  versionUnavailable: "That version is not available. Showing the latest published release.",
} as const;

export type FileDownloadKind = "download" | "signin" | "verify";

export function fileDownloadKind(access: Pick<AccessSnapshot, "level">): FileDownloadKind {
  if (canDownload(access)) {
    return "download";
  }
  if (access.level === "unverified") {
    return "verify";
  }
  return "signin";
}

export function fileDownloadLabel(kind: FileDownloadKind): string {
  if (kind === "download") {
    return "Download";
  }
  if (kind === "verify") {
    return "Verify your email to download";
  }
  return "Sign in to download";
}

export function fileDownloadHref(kind: FileDownloadKind, input: { fileId: string; returnTo: string }): string {
  if (kind === "download") {
    return `/api/downloads/${input.fileId}?next=${encodeURIComponent(input.returnTo)}`;
  }
  if (kind === "verify") {
    return "/verify?reason=download";
  }
  return loginPath(input.returnTo);
}

export function primaryDownloadAction(
  access: Pick<AccessSnapshot, "level">,
  returnTo: string,
): { href: string; label: string; kind: FileDownloadKind } {
  const kind = fileDownloadKind(access);
  if (kind === "download") {
    return { href: "#files", label: "Download files", kind };
  }
  if (kind === "verify") {
    return { href: "/verify?reason=download", label: "Verify your email to download", kind };
  }
  return { href: loginPath(returnTo), label: "Sign in to download", kind };
}

export function previewAvailabilityLabel(
  resourceType: ResourceType,
  file: Pick<ResourceFileSummary, "filename" | "sizeBytes">,
): string {
  const kind = filePreviewKind(resourceType, file);
  if (tooLargeForPreview(resourceType, file)) {
    return "Download to view";
  }
  if (kind === "video-download") {
    return "Private video · download";
  }
  if (kind === "none") {
    return "Download only";
  }
  return "Online preview";
}
