"use server";

import { revalidatePath } from "next/cache";
import { requireSiteAdmin } from "@/lib/auth/session";
import { RESOURCE_FILES_BUCKET, TUTORIAL_VIDEOS_BUCKET, uploadLimits } from "@/lib/config/uploads";
import { resolveResourceStorageBucket } from "@/lib/downloads/path";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/utils/logger";

/**
 * Orphan upload maintenance.
 *
 * Storage objects are not Postgres rows, so nothing in the database can delete
 * them directly. The split here is deliberate: `public.orphan_upload_objects()`
 * decides *which* keys are eligible (it is the only thing that can join
 * `storage.objects` against `resource_files` and open reservations), and this
 * module performs the deletion through the Storage API.
 */

export type UploadHygiene = {
  orphanCandidates: number;
  openIntents: number;
  abandonedIntents: number;
  leftoverObjects: number;
};

export async function getUploadHygiene(): Promise<UploadHygiene | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!(await requireSiteAdmin())) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upload_hygiene_summary");
  if (error || !data) {
    return null;
  }
  return {
    orphanCandidates: data.orphanCandidates,
    openIntents: data.openIntents,
    abandonedIntents: data.abandonedIntents,
    leftoverObjects: data.leftoverObjects ?? 0,
  };
}

export type CleanupResult = {
  ok: boolean;
  deleted: number;
  failed: number;
  message: string;
};

/**
 * Deletes objects the database has already cleared as orphans.
 *
 * Every safety condition — correct bucket, expected key shape, older than the
 * grace period, no `resource_files` row, no live reservation — is evaluated in
 * SQL. This function does not decide anything; it only removes what it was
 * given, and re-checks the bucket prefix before doing so.
 */
export async function cleanupOrphanUploads(): Promise<CleanupResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, deleted: 0, failed: 0, message: "Storage maintenance is unavailable." };
  }
  if (!(await requireSiteAdmin())) {
    return { ok: false, deleted: 0, failed: 0, message: "You do not have permission to do that." };
  }

  const result = await sweepOrphanUploads();
  revalidatePath("/admin");
  return result;
}

/**
 * Shared by the admin action and the scheduled route. Callers are responsible
 * for authorizing first.
 *
 * `trusted` selects the service-role client for the lookup, which is what the
 * scheduled sweep needs because it has no user session to be a Site Admin with.
 */
export async function sweepOrphanUploads(trusted = false): Promise<CleanupResult> {
  const supabase = trusted ? createAdminClient() : await createClient();
  const { data, error } = await supabase.rpc("orphan_upload_objects", { p_limit: 500 });

  if (error) {
    logger.warn("admin.storage", "Orphan lookup failed", { message: error.message });
    return { ok: false, deleted: 0, failed: 0, message: "The orphan list could not be read." };
  }

  const rows = (data ?? []).filter(
    (row) =>
      typeof row.storage_path === "string" &&
      row.storage_path.length > 0 &&
      !row.storage_path.includes(".."),
  );

  if (rows.length === 0) {
    return {
      ok: true,
      deleted: 0,
      failed: 0,
      message: `No unreferenced uploads older than ${uploadLimits.orphanGraceHours} hours.`,
    };
  }

  const byBucket = new Map<string, string[]>();
  for (const row of rows) {
    const bucket = resolveResourceStorageBucket(row.storage_bucket);
    if (bucket !== RESOURCE_FILES_BUCKET && bucket !== TUTORIAL_VIDEOS_BUCKET) {
      continue;
    }
    const list = byBucket.get(bucket) ?? [];
    list.push(row.storage_path);
    byBucket.set(bucket, list);
  }

  // Deleting Storage objects for other people's resources is exactly what the
  // service role is for; the decision to delete was already made in SQL.
  const admin = createAdminClient();
  let deleted = 0;
  let failed = 0;
  for (const [bucket, paths] of byBucket) {
    const { error: removeError } = await admin.storage.from(bucket).remove(paths);
    if (removeError) {
      logger.warn("admin.storage", "Orphan cleanup failed", {
        message: removeError.message,
        bucket,
        candidates: paths.length,
      });
      failed += paths.length;
    } else {
      deleted += paths.length;
    }
  }

  if (failed > 0 && deleted === 0) {
    return {
      ok: false,
      deleted: 0,
      failed,
      message: "The objects could not be removed. They remain eligible for the next sweep.",
    };
  }

  logger.info("admin.storage", "Orphan uploads removed", { deleted, failed });
  return {
    ok: failed === 0,
    deleted,
    failed,
    message:
      failed === 0
        ? `Removed ${deleted} unreferenced upload${deleted === 1 ? "" : "s"}.`
        : `Removed ${deleted} unreferenced upload${deleted === 1 ? "" : "s"}; ${failed} could not be deleted.`,
  };
}
