import { isSupabaseConfigured } from "@/lib/env";

export function GET() {
  return Response.json({
    ok: true,
    service: "ftc-open-library",
    supabaseConfigured: isSupabaseConfigured(),
  });
}
