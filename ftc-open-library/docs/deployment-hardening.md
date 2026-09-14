# Deployment hardening

Application quotas bound what a single account can hold. They do not bound how many accounts exist or how fast requests arrive. Those are deployment concerns, and they are not configured by this repository.

## Schedule the orphan sweep

Nothing deletes unreferenced uploads on a timer until you configure one. Without a schedule, cleanup only happens when a Site Admin opens `/admin` and uses the **Upload hygiene** card.

Set a long random `CRON_SECRET` in the server environment (never `NEXT_PUBLIC_`), then schedule a daily `POST` to `/api/maintenance/orphan-uploads` with `Authorization: Bearer $CRON_SECRET`. On Vercel:

```json
{
  "crons": [{ "path": "/api/maintenance/orphan-uploads", "schedule": "0 4 * * *" }]
}
```

Vercel Cron sends `CRON_SECRET` as a bearer token automatically. If the variable is unset, the route rejects token callers entirely and only accepts a Site Admin session, so a missing secret fails closed rather than open.

The sweep needs `SUPABASE_SERVICE_ROLE_KEY`, because deleting another user's Storage object is exactly what the service role is for. Eligibility is still decided in SQL.

## Large file / Tutorial video Storage checklist

Application limits (1 GB Tutorial video, 100 MB ordinary files) are not enough by themselves. Before enabling large Tutorial uploads in production, confirm in the Supabase dashboard:

- Project **Global File Size Limit** ≥ 1 GB (otherwise TUS/standard uploads fail with a project-level 413 even when the app would allow the file).
- `tutorial-videos` bucket max object size = 1 GB.
- `resource-files` bucket max object size = 100 MB.
- Both buckets remain **private**.
- Storage capacity and egress/bandwidth cost for multi-hundred-MB videos are understood.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are set. The service role is never sent to the browser; TUS authenticates with the user session.

This repository cannot safely read those dashboard settings at runtime. A 413 from Storage is shown as: “This file exceeds the current storage limit configured for FTC Open Library.”

Local `supabase start` uses `supabase/config.toml` `[storage] file_size_limit = "1GiB"` so a 1 GB object is not blocked by the CLI default 50MiB. Restart local Supabase after changing that value.

## Rate limiting and bot protection

The database enforces 10 active resources and 20 resource creations per hour per account, 5 open upload reservations per user, and 3 GB of unpublished storage including leftover unregistered objects. A single account cannot do much damage. Many accounts still can. Application quotas are not a substitute for edge/WAF rate limiting, Auth sign-up limits, or bot protection.

Recommended before opening a public beta wider than a small invite group:

- Edge or WAF rate limiting on `/submit`, `/signup`, `/login`, and the Server Action endpoints. Vercel Firewall rules or an equivalent work; this repository has no in-process limiter, and an in-memory one would be per-instance and therefore misleading on serverless.
- Supabase Auth rate limits for sign-up and email sending, configured in the dashboard.
- Supabase project-level and bucket-level Storage limits as a final ceiling.
- Bot protection (CAPTCHA or similar) on sign-up **only if abuse actually appears**. No provider is integrated, deliberately.

## Monitoring

Watch the counts on the `/admin` Upload hygiene card. A persistently rising orphan count means uploads are failing between the Storage write and finalization; a persistently high abandoned-reservation count means users are starting uploads they never finish. Neither is dangerous on its own, and both are cheap signals that something upstream is broken.
