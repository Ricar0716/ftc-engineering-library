import { NextResponse } from "next/server";
import { loginPath } from "@/lib/auth/paths";
import { getCurrentAccess } from "@/lib/auth/session";
import { getConfiguredServerClient } from "@/lib/db/client";
import {
  resolveResourceStorageBucket,
  SIGNED_DOWNLOAD_TTL_SECONDS,
  storagePathBelongsToResource,
} from "@/lib/downloads/path";
import { getConfiguredAdminClient } from "@/lib/supabase/admin-optional";
import { isUuid } from "@/lib/utils/id";
import { logger } from "@/lib/utils/logger";

/**
 * Private file access for a submission's own contributor and for Site Admin
 * reviewers.
 *
 * `/api/downloads/[fileId]` stays the only route for published originals and is
 * untouched: it still refuses anything that is not PUBLISHED + PUBLIC and records
 * a download event. This route is the review-time counterpart — it never touches
 * published public files, never records a public download, and issues the same
 * short-lived signed URL against the private bucket.
 */
type RouteContext = { params: Promise<{ fileId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { fileId } = await context.params;
  const url = new URL(request.url);

  if (!isUuid(fileId)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const access = await getCurrentAccess();
  if (access.level === "guest") {
    return NextResponse.redirect(new URL(loginPath("/my/resources"), url.origin));
  }
  if (access.level === "unverified") {
    return NextResponse.redirect(new URL("/verify?reason=download", url.origin));
  }

  const supabase = await getConfiguredServerClient();
  const admin = getConfiguredAdminClient();
  if (!supabase || !admin) {
    return NextResponse.json({ error: "File access is unavailable." }, { status: 503 });
  }

  // RLS on resource_files already limits this read to the contributor, a team
  // admin, or a Site Admin. A miss is reported as 404 so the route cannot be used
  // to probe for file ids.
  const { data: file, error: fileError } = await supabase
    .from("resource_files")
    .select("id, resource_id, filename, storage_path, storage_bucket")
    .eq("id", fileId)
    .maybeSingle();

  if (fileError) {
    logger.error("resource-files", "Failed to load file metadata", { message: fileError.message });
    return NextResponse.json({ error: "Unable to open the file." }, { status: 500 });
  }
  if (!file) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { data: manageable, error: manageError } = await supabase.rpc("can_manage_resource", {
    p_resource_id: file.resource_id,
  });
  if (manageError) {
    logger.error("resource-files", "Authorization check failed", { message: manageError.message });
    return NextResponse.json({ error: "Unable to open the file." }, { status: 500 });
  }
  if (!manageable && !access.isSiteAdmin) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (!storagePathBelongsToResource(file.storage_path, file.resource_id)) {
    logger.warn("resource-files", "Storage path did not match resource id");
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const bucket = resolveResourceStorageBucket(file.storage_bucket);

  const { data: signed, error: signError } = await admin.storage
    .from(bucket)
    .createSignedUrl(file.storage_path, SIGNED_DOWNLOAD_TTL_SECONDS, {
      download: file.filename,
    });

  if (signError || !signed?.signedUrl) {
    logger.error("resource-files", "Failed to sign private file", { message: signError?.message });
    return NextResponse.json({ error: "Unable to open the file." }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
