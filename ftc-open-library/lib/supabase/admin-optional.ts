import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminSupabaseConfig } from "@/lib/env.server";

export function getConfiguredAdminClient() {
  try {
    requireAdminSupabaseConfig();
    return createAdminClient();
  } catch {
    return null;
  }
}
