import { createBrowserClient } from "@supabase/ssr";
import { requirePublicSupabaseConfig } from "@/lib/env";
import type { Database } from "@/types/database";

export function createClient() {
  const { url, anonKey } = requirePublicSupabaseConfig();
  return createBrowserClient<Database>(url, anonKey);
}
