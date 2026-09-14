import "server-only";

import { z } from "zod";
import { requirePublicSupabaseConfig } from "@/lib/env";

const adminConfigSchema = z.object({
  serviceRoleKey: z.string().min(20),
});

/**
 * Service-role config. Import only from server modules.
 * Never import this file from Client Components or `lib/supabase/client.ts`.
 */
export function requireAdminSupabaseConfig() {
  const publicConfig = requirePublicSupabaseConfig();
  const parsed = adminConfigSchema.safeParse({
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      "Supabase service role is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server only.",
    );
  }

  return {
    ...publicConfig,
    serviceRoleKey: parsed.data.serviceRoleKey,
  };
}
