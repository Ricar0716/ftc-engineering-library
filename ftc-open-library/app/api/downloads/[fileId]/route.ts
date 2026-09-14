import { NextResponse } from "next/server";
import { canDownload } from "@/lib/auth/permissions";
import { loginPath } from "@/lib/auth/paths";
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

export async function GET(request: Request, context: RouteContext) {
  const { fileId } = await context.params;
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("next");

  if (!isUuid(fileId)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const access = await getCurrentAccess();
  if (access.level === "guest") {
    return NextResponse.redirect(new URL(loginPath(returnTo ?? "/"), url.origin));
  }
  if (access.level === "unverified") {
    return NextResponse.redirect(new URL("/verify?reason=download", url.origin));
  }
  if (!canDownload(access) || !access.userId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const supabase = await getConfiguredServerClient();
  const admin = getConfiguredAdminClient();
  if (!supabase || !admin) {
    return NextResponse.json({ error: "Downloads are unavailable." }, { status: 503 });
  }

  const { data: file, error: fileError } = await supabase
    .from("resource_files")
    .select("id, resource_id, filename, storage_path, storage_bucket, version_id")
    .eq("id", fileId)
    .maybeSingle();

  if (fileError) {
    logger.error("downloads", "Failed to load file metadata", { message: fileError.message });
    return NextResponse.json({ error: "Unable to start download." }, { status: 500 });
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
    logger.error("downloads", "Failed to load resource for download", {
      message: resourceError.message,
    });
    return NextResponse.json({ error: "Unable to start download." }, { status: 500 });
  }
  if (!resource) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const publishedPublic = resource.status === "PUBLISHED" && resource.visibility === "PUBLIC";
  if (!publishedPublic) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { data: version, error: versionError } = await supabase
    .from("resource_versions")
    .select("id, status")
    .eq("id", file.version_id)
    .maybeSingle();

  if (versionError) {
    logger.error("downloads", "Failed to load version for download", {
      message: versionError.message,
    });
    return NextResponse.json({ error: "Unable to start download." }, { status: 500 });
  }
  if (!version || version.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (!storagePathBelongsToResource(file.storage_path, file.resource_id)) {
    logger.warn("downloads", "Storage path did not match resource id");
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const bucket = resolveResourceStorageBucket(file.storage_bucket);

  const { data: signed, error: signError } = await admin.storage
    .from(bucket)
    .createSignedUrl(file.storage_path, SIGNED_DOWNLOAD_TTL_SECONDS, {
      download: file.filename,
    });

  if (signError || !signed?.signedUrl) {
    logger.error("downloads", "Failed to sign download", { message: signError?.message });
    return NextResponse.json({ error: "Unable to start download." }, { status: 500 });
  }

  const { error: logError } = await supabase.from("downloads").insert({
    resource_id: file.resource_id,
    file_id: file.id,
    user_id: access.userId,
  });
  if (logError) {
    logger.warn("downloads", "Failed to record download event", { message: logError.message });
  }

  return NextResponse.redirect(signed.signedUrl);
}
