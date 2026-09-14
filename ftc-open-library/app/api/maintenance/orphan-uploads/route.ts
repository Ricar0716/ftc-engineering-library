import { NextResponse } from "next/server";
import { requireSiteAdmin } from "@/lib/auth/session";
import { sweepOrphanUploads } from "@/lib/admin/storage-actions";
import { isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/utils/logger";

/**
 * Scheduled orphan sweep.
 *
 * Accepts either a Site Admin session or a `CRON_SECRET` bearer token, so the
 * same endpoint serves a manual retry and a platform scheduler (Vercel Cron
 * sends `Authorization: Bearer $CRON_SECRET`). If `CRON_SECRET` is unset the
 * token path is disabled entirely rather than defaulting to open.
 *
 * The eligibility rules live in `public.orphan_upload_objects()`; this route
 * only decides who may ask for a sweep.
 */
export const dynamic = "force-dynamic";

function hasValidCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 16) {
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) {
    return false;
  }
  const provided = header.slice(prefix.length);
  // Length check first so the comparison below cannot leak length by timing.
  return provided.length === expected.length && provided === expected;
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Maintenance is unavailable." }, { status: 503 });
  }

  const scheduled = hasValidCronSecret(request);
  if (!scheduled && !(await requireSiteAdmin())) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const result = await sweepOrphanUploads(scheduled);
  logger.info("maintenance", "Orphan sweep finished", {
    scheduled,
    deleted: result.deleted,
    failed: result.failed,
  });

  return NextResponse.json(
    { deleted: result.deleted, failed: result.failed },
    { status: result.ok ? 200 : 500 },
  );
}
