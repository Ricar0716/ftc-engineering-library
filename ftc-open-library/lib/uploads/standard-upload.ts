import type { SupabaseClient } from "@supabase/supabase-js";
import { transportErrorFromUnknown } from "./errors.ts";
import type { TrustedUploadTicket, UploadProgressHandler, UploadTransportResult } from "./types.ts";

/**
 * Small-file transport. Passes the browser File/Blob straight to Storage.
 * Never reads the whole file into a string or ArrayBuffer.
 */
export async function standardUpload(input: {
  supabase: SupabaseClient;
  file: File;
  ticket: TrustedUploadTicket;
  onProgress?: UploadProgressHandler;
}): Promise<UploadTransportResult> {
  const { supabase, file, ticket, onProgress } = input;
  onProgress?.(0, file.size);

  const { error } = await supabase.storage.from(ticket.bucket).upload(ticket.path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });

  if (error) {
    return {
      ok: false,
      transport: "standard",
      uploadedBytes: 0,
      error: transportErrorFromUnknown(error),
    };
  }

  onProgress?.(file.size, file.size);
  return {
    ok: true,
    transport: "standard",
    uploadedBytes: file.size,
    bucket: ticket.bucket,
    path: ticket.path,
  };
}
