import type { ResourceStorageBucket, UploadTransport } from "@/lib/config/uploads";
import type { TransportError } from "./errors.ts";

export type TrustedUploadTicket = {
  bucket: ResourceStorageBucket;
  path: string;
  expiresAt: string;
};

export type UploadTransportSuccess = {
  ok: true;
  transport: UploadTransport;
  uploadedBytes: number;
  bucket: ResourceStorageBucket;
  path: string;
};

export type UploadTransportFailure = {
  ok: false;
  transport: UploadTransport;
  uploadedBytes: number;
  error: TransportError;
};

export type UploadTransportResult = UploadTransportSuccess | UploadTransportFailure;

export type UploadProgressHandler = (uploadedBytes: number, totalBytes: number) => void;
