"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  allowedExtensions,
  formatBytes,
  uploadTransportFor,
  UPLOAD_GUIDANCE,
  uploadLimits,
  type ResourceStorageBucket,
} from "@/lib/config/uploads";
import {
  abandonResourceUpload,
  prepareResourceUpload,
  registerResourceFile,
  touchResourceUpload,
} from "@/lib/resources/actions";
import { resolveResourceStorageBucket } from "@/lib/downloads/path";
import { createClient } from "@/lib/supabase/client";
import { canResumeWithExpiry } from "@/lib/uploads/expiry";
import { uploadProgressPercent } from "@/lib/uploads/progress";
import { uploadResourceFile, type ResumableUploadHandle } from "@/lib/uploads/transport";
import type { ResourceType } from "@/types/resources";
import { useUploadActivity } from "./upload-activity";

type JobPhase =
  | "queued"
  | "preparing"
  | "uploading"
  | "finalizing"
  | "complete"
  | "failed"
  | "interrupted";

type FileJob = {
  id: string;
  file: File;
  phase: JobPhase;
  uploadedBytes: number;
  totalBytes: number;
  error: string | null;
  path: string | null;
  bucket: ResourceStorageBucket | null;
  expiresAt: string | null;
  canRetryFinalize: boolean;
};

const PHASE_LABELS: Record<JobPhase, string> = {
  queued: "Waiting",
  preparing: "Checking",
  uploading: "Uploading",
  finalizing: "Finishing",
  complete: "Uploaded",
  failed: "Failed",
  interrupted: "Interrupted",
};

function newJobId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isExpired(iso: string | null | undefined): boolean {
  return !canResumeWithExpiry(iso, Date.now());
}

function isActivePhase(phase: JobPhase): boolean {
  return phase === "preparing" || phase === "uploading" || phase === "finalizing";
}

/**
 * Direct-to-Storage upload.
 *
 * Each attempt asks the server for a fresh single-object authorization. The
 * browser then sends bytes to that exact key — standard upload for small files,
 * TUS for large files and Tutorial videos — so bytes never pass through Next.js.
 */
export function FileUploader({
  resourceId,
  resourceType,
  fileCount,
  totalBytes,
  disabled,
  disabledReason,
}: {
  resourceId: string;
  resourceType: ResourceType;
  fileCount: number;
  totalBytes: number;
  disabled: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<ResumableUploadHandle | null>(null);
  const cancelRequested = useRef(false);
  const jobsRef = useRef<FileJob[]>([]);
  const { setBusy } = useUploadActivity();
  const [jobs, setJobs] = useState<FileJob[]>([]);
  const [running, setRunning] = useState(false);
  const [chooserError, setChooserError] = useState<string | null>(null);
  const inputId = useId();
  const statusId = useId();

  const quota = uploadLimits.totalBytesByType[resourceType];
  const accept = allowedExtensions(resourceType)
    .map((extension) => `.${extension}`)
    .join(",");
  const busy = running || jobs.some((job) => isActivePhase(job.phase));

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  useEffect(() => {
    setBusy(busy);
    return () => setBusy(false);
  }, [busy, setBusy]);

  useEffect(() => {
    if (!busy) {
      return;
    }
    function onLeave(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "An upload is still in progress.";
    }
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [busy]);

  function patchJob(id: string, update: Partial<FileJob>) {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...update } : job)));
  }

  async function processJob(job: FileJob, resume: boolean): Promise<boolean> {
    cancelRequested.current = false;
    abortRef.current = null;
    patchJob(job.id, { phase: "preparing", error: null, canRetryFinalize: false });

    let bucket = job.bucket;
    let path = job.path;
    const live = { expiresAt: job.expiresAt };
    const canReuse = Boolean(resume && bucket && path && !isExpired(live.expiresAt));

    const rememberExpiry = (next: string) => {
      live.expiresAt = next;
      patchJob(job.id, { expiresAt: next });
    };

    if (!canReuse) {
      const ticket = await prepareResourceUpload({
        resourceId,
        filename: job.file.name,
        sizeBytes: job.file.size,
        mimeType: job.file.type || null,
      });
      if (!ticket.ok) {
        patchJob(job.id, { phase: "failed", error: ticket.error });
        return false;
      }
      if (isExpired(ticket.expiresAt)) {
        await abandonResourceUpload({ path: ticket.path });
        patchJob(job.id, {
          phase: "failed",
          error: "Your upload authorization expired. Choose the file and upload it again.",
        });
        return false;
      }
      bucket = resolveResourceStorageBucket(ticket.bucket);
      path = ticket.path;
      rememberExpiry(ticket.expiresAt);
    }

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      patchJob(job.id, {
        phase: "failed",
        error: "Your session expired. Sign in again, then retry the upload.",
        path,
        bucket,
        expiresAt: live.expiresAt,
      });
      return false;
    }

    patchJob(job.id, {
      phase: "uploading",
      path,
      bucket,
      expiresAt: live.expiresAt,
      totalBytes: job.file.size,
    });

    const transported = await uploadResourceFile({
      supabase,
      file: job.file,
      ticket: {
        bucket: bucket!,
        path: path!,
        expiresAt: live.expiresAt!,
      },
      resourceType,
      userId: userData.user.id,
      onProgress: (uploadedBytes, total) => {
        patchJob(job.id, { uploadedBytes, totalBytes: total });
      },
      onTouchIntent: async () => {
        const touched = await touchResourceUpload({ path: path! });
        if (touched.ok) {
          rememberExpiry(touched.expiresAt);
        }
      },
      registerHandle: (handle) => {
        abortRef.current = handle;
      },
    });

    if (cancelRequested.current) {
      await abandonResourceUpload({ path: path! });
      patchJob(job.id, {
        phase: "failed",
        error: "Upload cancelled.",
        path: null,
        bucket: null,
        expiresAt: null,
      });
      return false;
    }

    if (!transported.ok) {
      const interrupted = transported.error.code === "network";
      if (!interrupted) {
        await abandonResourceUpload({ path: path! });
      }
      patchJob(job.id, {
        phase: interrupted ? "interrupted" : "failed",
        error: transported.error.message,
        uploadedBytes: transported.uploadedBytes,
        path: interrupted ? path : null,
        bucket: interrupted ? bucket : null,
        expiresAt: interrupted ? live.expiresAt : null,
      });
      return false;
    }

    return finalizeJob(job.id, path!);
  }

  async function finalizeJob(jobId: string, path: string): Promise<boolean> {
    patchJob(jobId, { phase: "finalizing", path, error: null, canRetryFinalize: false });
    const recorded = await registerResourceFile({ resourceId, path });
    if (!recorded.ok) {
      patchJob(jobId, {
        phase: "failed",
        error: `Upload received, but finalization failed. ${recorded.error}`,
        path,
        canRetryFinalize: true,
      });
      return false;
    }
    patchJob(jobId, {
      phase: "complete",
      error: null,
      canRetryFinalize: false,
      path,
    });
    return true;
  }

  async function onUpload() {
    const selected = inputRef.current?.files;
    if (!selected || selected.length === 0) {
      setChooserError("Choose a file to upload.");
      return;
    }

    setChooserError(null);

    const next: FileJob[] = Array.from(selected).map((file) => ({
      id: newJobId(),
      file,
      phase: "queued",
      uploadedBytes: 0,
      totalBytes: file.size,
      error: null,
      path: null,
      bucket: null,
      expiresAt: null,
      canRetryFinalize: false,
    }));

    setJobs(next);
    setRunning(true);

    let anyComplete = false;
    for (const job of next) {
      if (cancelRequested.current) {
        break;
      }
      const ok = await processJob(job, false);
      if (ok) {
        anyComplete = true;
      }
    }

    setRunning(false);
    abortRef.current = null;
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    if (anyComplete) {
      router.refresh();
    }
  }

  async function onCancel(job: FileJob) {
    cancelRequested.current = true;
    if (abortRef.current) {
      try {
        await abortRef.current.abort(true);
      } catch {
        await abortRef.current.abort(false);
      }
    }
    if (job.path) {
      await abandonResourceUpload({ path: job.path });
    }
    patchJob(job.id, {
      phase: "failed",
      error: "Upload cancelled.",
      path: null,
      bucket: null,
      expiresAt: null,
      canRetryFinalize: false,
    });
  }

  async function onRetryFinalize(job: FileJob) {
    if (!job.path) {
      return;
    }
    setRunning(true);
    const ok = await finalizeJob(job.id, job.path);
    setRunning(false);
    if (ok) {
      router.refresh();
    }
  }

  async function onRetryInterrupted(job: FileJob) {
    const latest = jobsRef.current.find((item) => item.id === job.id) ?? job;
    setRunning(true);
    const ok = await processJob(latest, true);
    setRunning(false);
    if (ok) {
      router.refresh();
    }
  }

  if (disabled) {
    return (
      <p className="rounded-md border border-line bg-canvas px-4 py-3 text-sm text-ink-muted">
        {disabledReason ?? "Files cannot be changed in this status."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          Add files
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept={accept}
          disabled={busy}
          aria-describedby={statusId}
          className="w-full max-w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink file:mr-3 file:rounded file:border-0 file:bg-canvas file:px-3 file:py-1 file:text-sm file:text-ink"
        />
        <p id={statusId} className="text-sm text-ink-muted">
          {UPLOAD_GUIDANCE[resourceType]}{" "}
          {resourceType === "TUTORIAL"
            ? `Attachments up to ${formatBytes(uploadLimits.maxFileBytesByType.TUTORIAL)}; MP4/WebM video up to ${formatBytes(uploadLimits.maxVideoBytes)} each and ${formatBytes(uploadLimits.totalVideoBytesTutorial)} total video.`
            : `Up to ${formatBytes(uploadLimits.maxFileBytesByType[resourceType])} per file.`}{" "}
          {uploadLimits.maxFilesPerResource} files maximum. Used {formatBytes(totalBytes)} of{" "}
          {formatBytes(quota)} ({fileCount}/{uploadLimits.maxFilesPerResource} files). Large files
          upload in chunks with progress; small files use a single request.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onUpload} disabled={busy} variant="secondary">
          {busy ? "Uploading…" : "Upload"}
        </Button>
      </div>

      {chooserError ? (
        <p role="status" className="text-sm text-danger">
          {chooserError}
        </p>
      ) : null}
      {jobs.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {jobs.map((job) => (
            <FileJobRow
              key={job.id}
              job={job}
              resourceType={resourceType}
              onCancel={() => void onCancel(job)}
              onRetryFinalize={() => void onRetryFinalize(job)}
              onRetryInterrupted={() => void onRetryInterrupted(job)}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function FileJobRow({
  job,
  resourceType,
  onCancel,
  onRetryFinalize,
  onRetryInterrupted,
}: {
  job: FileJob;
  resourceType: ResourceType;
  onCancel: () => void;
  onRetryFinalize: () => void;
  onRetryInterrupted: () => void;
}) {
  const percent = uploadProgressPercent(job.uploadedBytes, job.totalBytes);
  const transport = uploadTransportFor(resourceType, job.file.name, job.file.size);
  const active = isActivePhase(job.phase);

  return (
    <li className="rounded-md border border-line bg-canvas px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink" title={job.file.name}>
            {job.file.name || "File"}
          </p>
          <p className="text-xs text-ink-muted">
            {PHASE_LABELS[job.phase]}
            {job.phase === "uploading" || job.phase === "interrupted"
              ? ` · ${formatBytes(job.uploadedBytes)} / ${formatBytes(job.totalBytes)} · ${percent}%`
              : ` · ${formatBytes(job.file.size)}`}
            {job.phase === "uploading" ? ` · ${transport === "tus" ? "resumable" : "direct"}` : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          {active ? (
            <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          {job.canRetryFinalize ? (
            <Button type="button" size="sm" variant="secondary" onClick={onRetryFinalize}>
              Retry finish
            </Button>
          ) : null}
          {job.phase === "interrupted" ? (
            <Button type="button" size="sm" variant="secondary" onClick={onRetryInterrupted}>
              Resume
            </Button>
          ) : null}
        </div>
      </div>
      {job.phase === "uploading" || job.phase === "interrupted" ? (
        <progress
          className="mt-2 h-2 w-full"
          max={100}
          value={percent}
          aria-label={`${job.file.name} ${percent} percent uploaded`}
        />
      ) : null}
      {job.error ? (
        <p role="status" className="mt-1 text-sm text-danger">
          {job.error}
        </p>
      ) : null}
    </li>
  );
}
