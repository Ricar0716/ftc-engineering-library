import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadTransportFor, type ResourceStorageBucket } from "@/lib/config/uploads";
import type { ResourceType } from "@/types/resources";
import { resumableUpload, type ResumableUploadHandle } from "./resumable-upload.ts";
import { standardUpload } from "./standard-upload.ts";
import type { TrustedUploadTicket, UploadProgressHandler, UploadTransportResult } from "./types.ts";

export type { UploadTransportResult, TrustedUploadTicket } from "./types.ts";
export type { ResumableUploadHandle } from "./resumable-upload.ts";

/**
 * Chooses standard vs TUS transport. Bucket and path must already come from a
 * trusted Upload Intent — this function never invents a Storage destination.
 */
export async function uploadResourceFile(input: {
  supabase: SupabaseClient;
  file: File;
  ticket: TrustedUploadTicket;
  resourceType: ResourceType;
  userId: string;
  onProgress?: UploadProgressHandler;
  onTouchIntent?: () => Promise<void>;
  registerHandle?: (handle: ResumableUploadHandle) => void;
}): Promise<UploadTransportResult> {
  const transport = uploadTransportFor(input.resourceType, input.file.name, input.file.size);
  const ticket: TrustedUploadTicket = {
    bucket: input.ticket.bucket as ResourceStorageBucket,
    path: input.ticket.path,
    expiresAt: input.ticket.expiresAt,
  };

  if (transport === "tus") {
    return resumableUpload({
      supabase: input.supabase,
      file: input.file,
      ticket,
      userId: input.userId,
      onProgress: input.onProgress,
      onTouchIntent: input.onTouchIntent,
      registerHandle: input.registerHandle,
    });
  }

  return standardUpload({
    supabase: input.supabase,
    file: input.file,
    ticket,
    onProgress: input.onProgress,
  });
}
