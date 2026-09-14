import type { SupabaseClient } from "@supabase/supabase-js";
import * as tus from "tus-js-client";
import {
  TUS_CHUNK_SIZE_BYTES,
  TUS_INTENT_TOUCH_INTERVAL_MS,
  TUS_RETRY_DELAYS_MS,
} from "@/lib/config/uploads";
import { requirePublicSupabaseConfig } from "@/lib/env";
import { resumableUploadEndpoint } from "./endpoint.ts";
import {
  SignedOutError,
  TRANSPORT_ERROR_MESSAGES,
  transportErrorFromUnknown,
  UploadCancelledError,
} from "./errors.ts";
import { tusResumeFingerprint } from "./fingerprint.ts";
import type { TrustedUploadTicket, UploadProgressHandler, UploadTransportResult } from "./types.ts";

export type ResumableUploadHandle = {
  abort: (terminate: boolean) => Promise<void>;
};

/**
 * Large-file transport. The File/Blob is handed to tus-js-client; it is never
 * base64-encoded or copied as a giant ArrayBuffer. Destination comes only from
 * the trusted Upload Intent ticket.
 */
export async function resumableUpload(input: {
  supabase: SupabaseClient;
  file: File;
  ticket: TrustedUploadTicket;
  userId: string;
  onProgress?: UploadProgressHandler;
  onTouchIntent?: () => Promise<void>;
  registerHandle?: (handle: ResumableUploadHandle) => void;
}): Promise<UploadTransportResult> {
  const { supabase, file, ticket, userId, onProgress, onTouchIntent, registerHandle } = input;
  const { url, anonKey } = requirePublicSupabaseConfig();
  const endpoint = resumableUploadEndpoint(url);
  const fingerprint = tusResumeFingerprint({
    userId,
    bucket: ticket.bucket,
    path: ticket.path,
    filename: file.name,
    sizeBytes: file.size,
  });

  let uploadedBytes = 0;
  let lastTouchAt = 0;
  let cancelled = false;

  async function accessToken(): Promise<string> {
    const current = await supabase.auth.getSession();
    let session = current.data.session;
    const expiresAtMs = (session?.expires_at ?? 0) * 1000;
    if (!session || expiresAtMs < Date.now() + 60_000) {
      const refreshed = await supabase.auth.refreshSession();
      session = refreshed.data.session ?? session;
    }
    if (!session?.access_token) {
      throw new SignedOutError();
    }
    return session.access_token;
  }

  return new Promise<UploadTransportResult>((resolve) => {
    const upload = new tus.Upload(file, {
      endpoint,
      retryDelays: [...TUS_RETRY_DELAYS_MS],
      chunkSize: TUS_CHUNK_SIZE_BYTES,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      fingerprint: async () => fingerprint,
      metadata: {
        bucketName: ticket.bucket,
        objectName: ticket.path,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      headers: {
        apikey: anonKey,
        "x-upsert": "false",
      },
      onBeforeRequest: async (req) => {
        const token = await accessToken();
        req.setHeader("Authorization", `Bearer ${token}`);
        req.setHeader("apikey", anonKey);
      },
      onShouldRetry: (error) => {
        const status = error.originalResponse?.getStatus() ?? 0;
        if (status === 401 || status === 403 || status === 413 || status === 404) {
          return false;
        }
        return true;
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        uploadedBytes = bytesUploaded;
        onProgress?.(bytesUploaded, bytesTotal);
        const now = Date.now();
        if (onTouchIntent && now - lastTouchAt >= TUS_INTENT_TOUCH_INTERVAL_MS) {
          lastTouchAt = now;
          void onTouchIntent();
        }
      },
      onError: (error) => {
        if (cancelled) {
          resolve({
            ok: false,
            transport: "tus",
            uploadedBytes,
            error: { code: "cancelled", message: TRANSPORT_ERROR_MESSAGES.cancelled },
          });
          return;
        }
        resolve({
          ok: false,
          transport: "tus",
          uploadedBytes,
          error: transportErrorFromUnknown(error),
        });
      },
      onSuccess: () => {
        onProgress?.(file.size, file.size);
        resolve({
          ok: true,
          transport: "tus",
          uploadedBytes: file.size,
          bucket: ticket.bucket,
          path: ticket.path,
        });
      },
    });

    registerHandle?.({
      abort: async (terminate) => {
        cancelled = true;
        await upload.abort(terminate);
      },
    });

    upload
      .findPreviousUploads()
      .then((previous) => {
        const match = previous.find(
          (item) =>
            item.metadata.bucketName === ticket.bucket && item.metadata.objectName === ticket.path,
        );
        if (match) {
          upload.resumeFromPreviousUpload(match);
        }
        lastTouchAt = Date.now();
        if (onTouchIntent) {
          void onTouchIntent();
        }
        upload.start();
      })
      .catch((error: unknown) => {
        resolve({
          ok: false,
          transport: "tus",
          uploadedBytes,
          error: error instanceof UploadCancelledError || error instanceof SignedOutError
            ? { code: error.code, message: error.message }
            : transportErrorFromUnknown(error),
        });
      });
  });
}
