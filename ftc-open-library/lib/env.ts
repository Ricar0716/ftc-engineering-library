import { z } from "zod";

const publicConfigSchema = z.object({
  url: z.string().url(),
  anonKey: z.string().min(20),
});

export type PublicSupabaseConfig = z.infer<typeof publicConfigSchema>;

function readAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig | null {
  const parsed = publicConfigSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: readAnonKey(),
  });

  return parsed.success ? parsed.data : null;
}

export function requirePublicSupabaseConfig(): PublicSupabaseConfig {
  const config = getPublicSupabaseConfig();

  if (!config) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return config;
}

export function isSupabaseConfigured(): boolean {
  return getPublicSupabaseConfig() !== null;
}
