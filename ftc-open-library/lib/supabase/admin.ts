import "server-only";

import { createClient } from "@supabase/supabase-js";
import { requireAdminSupabaseConfig } from "@/lib/env.server";
import type { Database } from "@/types/database";

/**
 * Service-role client. Bypasses RLS. Use only in trusted server code
 * after an application-level authorization check.
 */
export function createAdminClient() {
  const { url, serviceRoleKey } = requireAdminSupabaseConfig();

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
