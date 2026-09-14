/**
 * Build the Supabase TUS endpoint from the project's public URL.
 *
 * Cloud projects get the dedicated storage hostname
 * (`{ref}.storage.supabase.co`) which Supabase recommends for large uploads.
 * Local / self-hosted URLs keep their own origin. Nothing here hardcodes a
 * project id or production host.
 */
export function resumableUploadEndpoint(supabaseUrl: string): string {
  const url = new URL(supabaseUrl);
  const host = url.hostname;

  if (host.endsWith(".supabase.co") && !host.endsWith(".storage.supabase.co")) {
    const ref = host.slice(0, -".supabase.co".length);
    url.hostname = `${ref}.storage.supabase.co`;
  }

  url.pathname = "/storage/v1/upload/resumable";
  url.search = "";
  url.hash = "";
  return url.toString();
}
