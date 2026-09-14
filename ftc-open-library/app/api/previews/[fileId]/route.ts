/**
 * Shared authorization for preview signed URLs.
 *
 * This is not a download. It uses the same identity, publication, and path
 * checks as `/api/downloads`, then signs an inline URL. The client must not
 * pass a bucket or path.
 */
import { NextResponse } from "next/server";
import { canDownload } from "@/lib/auth/permissions";
import { getCurrentAccess } from "@/lib/auth/session";
import { getConfiguredAdminClient } from "@/lib/supabase/admin-optional";
import { getConfiguredServerClient } from "@/lib/db/client";
import {
  resolveResourceStorageBucket,
  SIGNED_DOWNLOAD_TTL_SECONDS,
  storagePathBelongsToResource,
} from "@/lib/downloads/path";
import { isUuid } from "@/lib/utils/id";
import { logger } from "@/lib/utils/logger";

type RouteContext = { params: Promise<{ fileId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { fileId } = await context.params;

  if (!isUuid(fileId)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const access = await getCurrentAccess();
  if (access.level === "guest") {
    return NextResponse.json({ error: "Sign in to preview." }, { status: 401 });
  }
  if (access.level === "unverified") {
    return NextResponse.json({ error: "Verify your email to preview." }, { status: 403 });
  }
  if (!canDownload(access) || !access.userId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const supabase = await getConfiguredServerClient();
  const admin = getConfiguredAdminClient();
  if (!supabase || !admin) {
    return NextResponse.json({ error: "Previews are unavailable." }, { status: 503 });
  }

  const { data: file, error: fileError } = await supabase
    .from("resource_files")
    .select("id, resource_id, filename, mime_type, storage_path, storage_bucket, version_id")
    .eq("id", fileId)
    .maybeSingle();

  if (fileError) {
    logger.error("previews", "Failed to load file metadata", { message: fileError.message });
    return NextResponse.json({ error: "Unable to start preview." }, { status: 500 });
  }
  if (!file) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { data: resource, error: resourceError } = await supabase
    .from("resources")
    .select("id, status, visibility")
    .eq("id", file.resource_id)
    .maybeSingle();

  if (resourceError) {
    logger.error("previews", "Failed to load resource for preview", {
      message: resourceError.message,
    });
    return NextResponse.json({ error: "Unable to start preview." }, { status: 500 });
  }
  if (!resource) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const publishedPublic = resource.status === "PUBLISHED" && resource.visibility === "PUBLIC";

  const { data: version, error: versionError } = await supabase
    .from("resource_versions")
    .select("id, status")
    .eq("id", file.version_id)
    .maybeSingle();

  if (versionError) {
    logger.error("previews", "Failed to load version for preview", {
      message: versionError.message,
    });
    return NextResponse.json({ error: "Unable to start preview." }, { status: 500 });
  }
  if (!version) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const unpublishedVersion = version.status !== "PUBLISHED";
  const catalogPreview = publishedPublic && !unpublishedVersion;
  let reviewPreview = false;
  if (!catalogPreview) {
    const { data: manageable, error: manageError } = await supabase.rpc("can_manage_resource", {
      p_resource_id: file.resource_id,
    });
    if (manageError) {
      logger.error("previews", "Authorization check failed", { message: manageError.message });
      return NextResponse.json({ error: "Unable to start preview." }, { status: 500 });
    }
    reviewPreview = Boolean(manageable) || access.isSiteAdmin;
    if (!reviewPreview) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
  }

  if (!storagePathBelongsToResource(file.storage_path, file.resource_id)) {
    logger.warn("previews", "Storage path did not match resource id");
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const bucket = resolveResourceStorageBucket(file.storage_bucket);

  const { data: signed, error: signError } = await admin.storage
    .from(bucket)
    .createSignedUrl(file.storage_path, SIGNED_DOWNLOAD_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    logger.error("previews", "Failed to sign preview", { message: signError?.message });
    return NextResponse.json({ error: "Unable to start preview." }, { status: 500 });
  }

  return NextResponse.json({
    filename: file.filename,
    mimeType: file.mime_type,
    expiresIn: SIGNED_DOWNLOAD_TTL_SECONDS,
    url: signed.signedUrl,
  });
}
