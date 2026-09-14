# Site Admin bootstrap

Site Admin membership lives in `public.site_admins` and is keyed by the authenticated user's UUID. It is **not** based on email in application code. Database and application privileges still require a **verified** email (`is_verified_user()` plus a `site_admins` row).

Team `OWNER` / `ADMIN` / `MEMBER` are unrelated.

## STEP A

Register on FTC Open Library (`/signup`) with the email you control.

## STEP B

Open the confirmation email and verify the address. `/verify` should then show that the account is verified.

## STEP C

In the Supabase SQL editor (or another trusted `postgres` / service-role session), run this **once**, substituting your real email. Do not commit that email to git.

```sql
INSERT INTO public.site_admins (user_id)
SELECT id
FROM auth.users
WHERE lower(email) = lower('YOUR_EMAIL@example.com')
ON CONFLICT (user_id) DO NOTHING;
```

## STEP D

Confirm the row:

```sql
SELECT u.email, sa.user_id, sa.created_at
FROM public.site_admins sa
JOIN auth.users u ON u.id = sa.user_id;
```

Sign out and sign back in (or refresh) so the session picks up the new membership.

## STEP E

Open `/admin`. You should see the Site Admin landing page. A normal verified user hitting `/admin` is sent to `/forbidden`.

To remove an admin later (trusted SQL only):

```sql
DELETE FROM public.site_admins sa
USING auth.users u
WHERE sa.user_id = u.id
  AND lower(u.email) = lower('YOUR_EMAIL@example.com');
```
