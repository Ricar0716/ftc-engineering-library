import type { ResourceFileCategory, ResourceFileSummary } from "../../types/resources.ts";

const GROUP_ORDER: ResourceFileCategory[] = [
  "CAD",
  "SOURCE",
  "DOCUMENT",
  "IMAGE",
  "VIDEO",
  "VIDEO_LINK",
  "OTHER",
];

export type FileGroup = {
  key: string;
  label: string;
  files: ResourceFileSummary[];
};

const GROUP_LABELS: Record<string, string> = {
  CAD: "CAD",
  SOURCE: "Source",
  DOCUMENT: "Documentation",
  IMAGE: "Images",
  VIDEO: "Video",
  VIDEO_LINK: "Video links",
  OTHER: "Other files",
};

/**
 * Uploaded names are flat (the sanitizer strips folders). Group by trusted
 * file type instead of inventing a repository tree.
 */
export function groupResourceFiles(files: ResourceFileSummary[]): FileGroup[] {
  const buckets = new Map<string, ResourceFileSummary[]>();

  for (const file of files) {
    const key = file.fileType ?? "OTHER";
    const list = buckets.get(key) ?? [];
    list.push(file);
    buckets.set(key, list);
  }

  const orderedKeys = [
    ...GROUP_ORDER.filter((key) => buckets.has(key)),
    ...[...buckets.keys()].filter((key) => !GROUP_ORDER.includes(key as ResourceFileCategory)),
  ];

  return orderedKeys.map((key) => ({
    key,
    label: GROUP_LABELS[key] ?? key,
    files: (buckets.get(key) ?? []).slice().sort((a, b) => a.filename.localeCompare(b.filename)),
  }));
}
