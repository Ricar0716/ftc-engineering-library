"use server";

/**
 * Resource moderation writes stay in `lib/admin/review-actions.ts` so there is
 * one `review_resource()` wrapper. This file is the STEP 8.1.2 import path.
 */
export { reviewResource } from "@/lib/admin/review-actions";
