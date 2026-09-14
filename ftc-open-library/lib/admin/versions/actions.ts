"use server";

/**
 * Version moderation writes stay in `lib/versioning/actions.ts` so there is one
 * `review_resource_revision()` wrapper. This file is the STEP 8.1.3 import path.
 */
export { reviewResourceRevision } from "@/lib/versioning/actions";
