# Security

FTC Open Library treats uploaded files and user content as untrusted. Postgres RLS and Storage policies are authoritative. The UI only reflects access; it is not a security boundary.

## Access model

| Level | Who | Browse | Download originals | Create / submit | Review | `/admin` |
| ----- | --- | ------ | ------------------ | --------------- | ------ | -------- |
| Guest | No session | Yes (public catalog) | No | No | No | No |
| Unverified | Signed in, email not confirmed | Yes | No | No | No | No |
| Verified User | Signed in, `email_confirmed_at` set | Yes | Yes (signed URL) | Yes — drafts only, never publishes | No | No |
| Site Admin | Row in `public.site_admins` **and** verified | Yes | Yes | Yes | Yes | Yes |

An account is permission to **contribute**, not permission to **publish**.

Team `OWNER` / `ADMIN` / `MEMBER` are **not** Site Admin.

Email verification is enforced with `auth.users.email_confirmed_at` via `is_verified_user()` (RLS) and `supabase.auth.getUser()` (server). Do not trust client-only session flags.

Site Admin is verified email **and** `auth.uid() ∈ site_admins.user_id` through `is_site_admin()`. An unverified UUID in `site_admins` does not receive admin database privileges. Never authorize with a hardcoded email. First admin: `docs/admin-bootstrap.md`.

`app/robots.ts` `Disallow` entries and page `noindex` tags are crawler hints. They do not replace authentication, RLS, or server gates on `/admin`, `/dashboard`, or private files. Public metadata and the sitemap only query `PUBLISHED` + `PUBLIC` resources. Unpublished titles never appear in `<title>` or Open Graph. Signed Storage URLs are not emitted into metadata.

`site_admins` has RLS enabled, SELECT only for existing admins, and **no insert/update/delete policies**. Clients cannot self-promote.

## Moderation state machine

Publishing is moderated. Two triggers guard it, plus RLS:

- `resources_prevent_self_publish` (STEP 3) rejects any non-admin insert or update that lands on `PUBLISHED`.
- `resources_enforce_status_transition` (STEP 5) validates every transition against the caller's role, freezes the row while it is `PENDING_REVIEW`, and derives `submitted_at` / `reviewed_at` / `published_at` server-side — values supplied by a client are discarded.

| From | Contributor may move to | Site Admin may move to |
| --- | --- | --- |
| `DRAFT` | `PENDING_REVIEW` | `PENDING_REVIEW` |
| `PENDING_REVIEW` | `DRAFT` (withdraw only, no content edits) | `PUBLISHED`, `CHANGES_REQUESTED`, `REJECTED`, `DRAFT` |
| `CHANGES_REQUESTED` | `PENDING_REVIEW` | `PENDING_REVIEW` |
| `PUBLISHED` | — | `ARCHIVED` |
| `REJECTED` | — | — |
| `ARCHIVED` | — | `PUBLISHED` |

Anything else raises. A client calling the Supabase REST API directly hits the same trigger, so `UPDATE resources SET status = 'PUBLISHED'` fails for a normal user regardless of what the UI shows.

Decisions go through `review_resource(resource_id, decision, message)` — `SECURITY DEFINER`, fixed `search_path`, `is_site_admin()` required, execute revoked from `PUBLIC` and granted only to `authenticated`. It re-validates title, description, license, category, and file presence before publishing, then writes the status change and the `resource_reviews` row in one transaction. `reviewer_id` comes from `auth.uid()`; a client-supplied reviewer is impossible.

`submit_resource_for_review(resource_id, rights_acknowledged)` mirrors this for contributors: verified user, `can_manage_resource()`, editable state, rights acknowledgement, and the full publication checks.

`resource_reviews` has RLS enabled and only a `SELECT` policy (contributor or Site Admin). `authenticated` holds **no** INSERT/UPDATE/DELETE grant, so review history cannot be forged or rewritten from the client. Review notes are private and are never rendered on a public resource page.

## Auth and keys

- Email/password through Supabase Auth. No OAuth in this phase.
- Browser and server clients use the anon / publishable key only (`lib/supabase/client.ts`, `lib/supabase/server.ts`).
- The service role client (`lib/supabase/admin.ts`) is `server-only`. It reads `SUPABASE_SERVICE_ROLE_KEY` from `lib/env.server.ts` and must never be imported into Client Components.
- There is no `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.
- Passwords stay in GoTrue. `profiles` has no email or password columns.
- Callback `/callback` exchanges PKCE codes and rejects external `next` redirects (`lib/auth/paths.ts`).
- `proxy.ts` refreshes the session. It is not the only authorization check.

## RLS

RLS is enabled on every user-facing table. Missing policies deny access.

Public (`anon` + `authenticated`) may `SELECT`:

- published **and** public resources (`status = PUBLISHED` AND `visibility = PUBLIC`)
- related public metadata (versions, files, tags, hardware, relations)
- catalogs (categories, tags, seasons, licenses, hardware)
- teams, team members, and public profiles
- visible discussion posts (`comments`, status `VISIBLE`) and ratings on public resources
- `resource_stats` aggregates for public resources

They cannot `SELECT` drafts, unlisted, or archived resources unless they are the author or a team admin.

Catalog tables including `categories` are readable by `anon` and `authenticated`. Category INSERT/UPDATE/DELETE policies require `is_site_admin()`. Verified normal users cannot mutate taxonomy. Guests cannot. `is_active` is enforced in the application for public navigation, not RLS, so a resource page can still show the name of an inactive primary category. `resource_type` cannot change after insert. Hard delete is rejected when the category has children or any `resources.category_id` reference (`ON DELETE SET NULL` still means the application and trigger refuse that path). Prefer `is_active = false`.

Authenticated **verified** users may insert their own resources as **drafts** and may edit or delete resources they own or team-admin while the status is `DRAFT` or `CHANGES_REQUESTED`. `can_edit_resource()` is the shared gate for resource metadata, tags, hardware, relations, and first-publish files. STEP 5 widened it from `DRAFT` to `DRAFT + CHANGES_REQUESTED` and nothing else. STEP 7.3 adds `can_edit_version()` so a published resource can receive a new DRAFT version without unlocking the published files.

**PENDING_REVIEW, PUBLISHED, REJECTED, and ARCHIVED resource rows remain immutable to contributors.** Published version files cannot be replaced. A contributor who wants to change published content creates a new version (`start_resource_revision`); Storage writes require `can_write_storage_object` plus an open Upload Intent on that version’s key. Site Admins moderate with `review_resource` (first publish at `/admin/resources`) or `review_resource_revision` (later versions at `/admin/versions`). Version review attributes the revision to `resource_versions.created_by` (username / display name only) and uses `submitted_at` written by `submit_resource_revision` / a database trigger — never a client-supplied clock. After a version has a `resource_reviews` row, contributors cannot `DELETE` it (`can_delete_version()` and `resource_versions_protect_reviewed`). Never-reviewed later DRAFT versions remain deletable. Published historical versions stay immutable.

`author_id` cannot be changed after insert and is always taken from the session, never from a form. `team_id` changes require team-admin on the previous team (and on the new team when assigning one). Resource UPDATE cannot attach a resource to a team the caller does not admin.

Site Admins gained `SELECT` on submissions and their child rows so they can review them. Guests and unrelated users are unchanged: `PUBLISHED` + `PUBLIC` only. Public list and detail queries filter on status explicitly, so drafts, pending, changes-requested, rejected, and archived resources never appear in `/explore`, `/`, or `/resources/[slug]`.

Favorites and downloads are **own-rows only**. Download inserts require `is_verified_user()`. Download history is not publicly listable; counts go through `resource_stats`.

Discussion (`public.comments`) is readable by guests only when `status = 'VISIBLE'` and the resource is published and public. Inserts require `is_verified_user()`, own `user_id`, `VISIBLE`, and `resource_is_published_public()`. Authors may UPDATE only their own VISIBLE `body`. Site Admins may UPDATE `status` (hide/restore). There is no DELETE policy. Unpublished resources do not leak through discussion SELECT.

Users cannot insert themselves as team `OWNER`. Creating a team assigns `OWNER` via a security-definer trigger. Further membership changes require an existing admin/owner.

## Uploads

**Owning a DRAFT does not grant Storage directory access.** Every object must be individually authorized, and the authorization covers exactly one key. This is the rule the whole upload design exists to enforce; before STEP 5.1 it was not true, because the Storage write policy accepted any key whose first folder was a resource the caller could edit.

```text
Browser picks a file
        ↓
prepareResourceUpload() — preflight only, for a readable error message
        ↓
create_upload_intent()  [SECURITY DEFINER]
    verified user · can_manage_resource() · resource_is_editable()
    blocked-extension list · per-type allowlist · per-file size
    open-upload caps · file-count quota · per-resource bytes · per-user bytes
        ↓
    the DATABASE builds the key and records a 15-minute reservation:
    <resource-id>/<version-id>/<generated-uuid>_<safe-filename>
        ↓
Browser uploads that one key to the private bucket with its own session
        ↓  small files: standard Storage upload
        ↓  large files and Tutorial videos: TUS resumable upload
        ↓
Storage INSERT/UPDATE policy: verified · can_edit_resource(first folder) · has_open_upload_intent(bucket, name)
        ↓
complete_upload_intent()  [SECURITY DEFINER]
    reads the real row from storage.objects in the intent's bucket — the recorded
    size is what Storage holds, not what the browser claimed
    re-checks editable state and quotas · inserts resource_files · burns the reservation
```

`create_upload_intent()` takes a resource id, a filename, and an optional MIME type. It does **not** take a bucket or a path. Tutorial MP4/WebM files are routed to the private `tutorial-videos` bucket; everything else goes to `resource-files`. CAD, CODE, and MODEL cannot obtain a `tutorial-videos` reservation.

**TUS does not bypass Upload Intent authorization.** Resumability is a transport feature, not an authorization feature.

```text
Verified User
      ↓
trusted Upload Intent (exact bucket + path)
      ↓
TUS or standard upload to that one key
      ↓
trusted complete_upload_intent()
```

The 15-minute create window is unchanged. An in-progress TUS transfer may call `touch_upload_intent()` to slide that same intent's `expires_at` forward while it stays `PENDING` and the Resource stays editable. The action returns that database timestamp; the browser must keep it and must not invent a new expiry. An already-EXPIRED intent cannot be revived; Storage TUS URLs may live up to ~24 hours on the platform, but every PATCH still requires `has_open_upload_intent()`. Bytes travel Browser → Supabase Storage, never through Next.js or Vercel.

Application policy (1 GB Tutorial video) is not enough by itself. The **project Global File Size Limit** and the **bucket** `file_size_limit` must both be ≥ the object you intend to accept. Local CLI uses `[storage] file_size_limit = "1GiB"` in `supabase/config.toml`; hosted projects are set in the Dashboard. Those ceilings do not change per-resource or per-user quotas.

Nothing about this depends on the frontend. **Frontend validation is not security**. **Client-provided paths and buckets are not trusted.**

Quota reservation is concurrency-safe: `upload_lock_quota()` takes transaction-scoped advisory locks plus `FOR UPDATE` on the caller's `profiles` row and the target `resources` row before any count is read. A second request waits, then re-checks the updated totals.

Held storage is counted once per object:

- if a Storage object exists for the intent (any status except `COMPLETED`) → actual size
- else if the intent is `PENDING` and unexpired → expected size
- else → 0

`CANCELLED` and `EXPIRED` therefore do **not** make existing bytes disappear from quota. `cancel_upload_intent()` refuses with `ftc:object_still_present` when the object is still in Storage; the app must delete that exact intent path through the Storage API, then retry. A failed delete leaves the object in quota accounting. Postgres cannot delete Storage objects as if they were rows; that limitation is why cancel is refuse-then-cleanup rather than a pretend-atomic delete.

Submitting for review refuses while a `PENDING` unexpired intent exists (`ftc:upload_in_progress`). It no longer blindly marks reservations `CANCELLED`, which would have hidden leftover objects.

Reservations are single-use: `complete_upload_intent()` marks the row `COMPLETED` inside the same transaction that inserts the file, and a `PENDING` row past `expires_at` satisfies neither the Storage policy nor finalization. A repeated finalize returns the file that already exists rather than inserting a second one, backed by a unique index on `(storage_bucket, storage_path)`.

What a verified user can do directly against Storage with their own session:

| Operation | Allowed? |
| --- | --- |
| `INSERT` a key they hold an open reservation for, in that reservation's bucket | Yes, once |
| `INSERT` any other key, in their own resource or anyone else's | No |
| `INSERT` into a `PENDING_REVIEW` / `PUBLISHED` / `REJECTED` / `ARCHIVED` resource | No — reservations are refused and `can_edit_resource` is false |
| `UPDATE` (overwrite) an object | Only with an open reservation, which never points at an already-registered object |
| `DELETE` an object in a resource they may edit | Yes — needed to remove a file or a draft, and not an abuse vector |
| Write to `resource-previews` / `resource-thumbnails` | No — Site Admin only, until a contributor preview flow is built |

### Limits

All of these live in `lib/config/uploads.ts` and are mirrored by `public.upload_limit()` and the `upload_allowed_extension` / `upload_blocked_extension` tables. The SQL copy is the enforced one; `lib/config/upload-policy.test.ts` fails the build if the two drift apart.

| Limit | Value |
| --- | --- |
| Ordinary attachment | 100 MB (CAD / TUTORIAL / MODEL); 50 MB (CODE). Also the `resource-files` `file_size_limit`. |
| Tutorial video | 1 GB per MP4/WebM object. Also the `tutorial-videos` `file_size_limit`. |
| Files per resource | 20, counting open reservations |
| Bytes per resource | CAD 250 MB · CODE 100 MB · MODEL 250 MB · TUTORIAL 2.25 GB overall, of which at most 2 GB may be video |
| Bytes per user, unpublished work | 3 GB, counting registered files, leftover unregistered objects, and live reservations (each object once) |
| Active resources per user | 10 (`DRAFT` + `PENDING_REVIEW` + `CHANGES_REQUESTED`) |
| Resources created per hour | 20 |
| Open reservations | 5 per user, 3 per resource |
| Reservation lifetime | 15 minutes |
| Orphan grace period | 24 hours |

The two resource-creation limits are a `BEFORE INSERT` trigger, so they apply to a REST call as much as to the form. Reservations count against the file and byte quotas precisely so that many simultaneous prepare calls cannot oversubscribe a resource.

The extension policy is a deny list of executables, installers, OS scripts, and browser-renderable documents (`.html`, `.svg`, `.jar`, macro-enabled Office files), checked before a per-resource-type allowlist. Uploaded content is stored as data and is never executed, imported, or rendered inline — storing source code is not running it.

### Orphans

An orphan is an object in `resource-files` or `tutorial-videos` that has no matching `resource_files` row (`storage_bucket` + `storage_path`) and no live `PENDING` unexpired reservation. Registration can still be in flight right after an upload, so an object is only eligible **24 hours** after it was created.

`public.orphan_upload_objects()` decides eligibility. It never scans avatars, logos, or preview buckets. Deletion happens in `lib/admin/storage-actions.ts` through the Storage API, grouped by the trusted bucket from SQL. Cancelled or expired intents whose objects still exist are counted as leftover objects on the `/admin` hygiene card and still consume user quota until they are actually removed.

Two ways to run it: the **Upload hygiene** card on `/admin`, and `POST /api/maintenance/orphan-uploads`, which accepts a Site Admin session or a `CRON_SECRET` bearer token for a platform scheduler. If `CRON_SECRET` is unset the token path is disabled rather than open. Nothing runs automatically until that schedule is configured — see `docs/deployment-hardening.md`.

Immediate cleanup still applies where it can: the app deletes the Storage object **before** cancelling the reservation. If delete fails, cancel is refused and the bytes stay in quota. Anything left behind becomes an orphan candidate after the grace period.

## Downloads

Two routes, both service-role signed URLs after an application-level check, both 60 seconds. The bucket is taken from the trusted `resource_files.storage_bucket` column (`resource-files` or `tutorial-videos`). Clients cannot pass `?bucket=` or a Storage path.

| Route | Who | What |
| --- | --- | --- |
| `/api/downloads/[fileId]` | Verified users | `PUBLISHED` + `PUBLIC` resources only; records a `downloads` row |
| `/api/previews/[fileId]` | Verified users | Same publication and path checks; **inline** 60s URL as JSON; does not record a download |
| `/api/resource-files/[fileId]` | The resource's manager or a Site Admin | Any status, for editing and review; records nothing |

Approval does not move, copy, or republish a Storage object. A published original is still a private object reachable only through a signed URL.

```text
User requests /api/downloads/[fileId]
        ↓
getUser() — must be signed in
        ↓
email confirmed
        ↓
Load file by id; load resource; require PUBLISHED + PUBLIC
        ↓
storage_bucket must be a known private resource bucket
        ↓
storage_path first folder must equal resource_id (no arbitrary paths)
        ↓
Service-role createSignedUrl on that trusted bucket (60s, Content-Disposition attachment)
        ↓
Redirect; optionally insert downloads row
```

In-browser CAD, code, and image previews use `/api/previews/[fileId]` with the same identity, publication, bucket, and path checks. The signed URL is **inline** (not `Content-Disposition: attachment`) and is returned as JSON so the viewer can `fetch()` it immediately. Guests receive `401` JSON rather than a login redirect. Preview tickets are not logged and are not inserted into `downloads`.

Do not log signed URLs. Guests downloading files are sent to `/login`. Unverified users are sent to `/verify`. Preview `fetch()` calls must not follow a login HTML page as if it were a model.

## Storage

| Bucket                | Public bucket flag | Read                                                                                          | Write |
| --------------------- | ------------------ | --------------------------------------------------------------------------------------------- | ----- |
| `resource-files`      | private            | Verified **managers** and verified Site Admins only. Guests and generic authenticated users have no SELECT. | INSERT/UPDATE need `can_edit_resource` **and** `has_open_upload_intent(bucket, exact key)`; DELETE needs `can_edit_resource` |
| `tutorial-videos`     | private            | Same as `resource-files`. Never anonymous. Used only for TUTORIAL MP4/WebM. | Same exact-path reservation model as `resource-files` |
| `resource-previews`   | private            | Anon if resource is published-public; managers otherwise                                      | Site Admin only |
| `resource-thumbnails` | private            | Same as previews                                                                              | Site Admin only |
| `avatars`             | public             | Anyone                                                                                        | Own `avatars/{userId}/...` |
| `team-logos`          | public             | Anyone                                                                                        | Team admins |

Object paths must start with a UUID folder (`{resourceId}/...`, `{userId}/...`, `{teamId}/...`). `storage_first_folder_uuid` returns NULL for non-UUID first segments (including `..`), so writes fail.

`resource_files.storage_path` on published rows is **metadata**. Knowing the path does not grant Storage bytes.

## Profile privacy

- Email is not on `profiles` and is not selected by public queries in the data layer.
- Usernames are public identifiers.

## Future MODEL execution

MODEL Resources may later contain interactive calculators, simulators, or visualizations. Uploaded executable web content must not be imported into the main Next.js application context. Future MODEL execution should use an isolated/sandboxed runtime:

```text
MODEL Resource → uploaded model package → validation → isolated / sandboxed runtime
```

That runtime is not implemented yet. There is no first-party in-app calculator.

## Known gaps (later phases)

- Storage policies cannot stop someone who already knows a UUID path in a **public** bucket; avatars and team logos are public by design.
- Rating rows include `user_id`. Aggregates are preferred for UI.
- No rate limiting on downloads or comments yet.
- Seed auth users and `dev-only-password` are local/dev only.
- Live RLS/Storage verification needs `npx supabase db reset` (Docker) or a hosted project. SQL was reviewed; this environment may not have a running database.
- `SECURITY DEFINER` helpers run as the migration owner and bypass RLS on purpose (avoid policy recursion). `search_path` is `pg_catalog, public`. Role checks always use `auth.uid()`, never a client-supplied user id.
- Email notifications for review decisions are not implemented. Status changes are visible in `/dashboard` only.
- `rights_acknowledged_at` is a self-assertion recorded at submission time. It is evidence of what the contributor claimed, not verification of the claim.
- Orphaned Storage objects are still possible if a Storage delete fails after its metadata row is gone. They are logged, and the sweep in the previous section is the backstop — but that sweep only runs when an admin clicks it or a schedule calls the maintenance route.
- Application quotas are **not** distributed rate limiting. They bound what one account can hold, not how fast a botnet can create accounts or issue requests. Edge/WAF rate limiting and bot protection are deployment concerns; see `docs/deployment-hardening.md`.
- `complete_upload_intent()` and `orphan_upload_objects()` read `storage.objects` as the migration owner. If a deployment restricts that schema from the owner role, both will need an explicit grant.
- Site Admins manage category trees at `/admin/categories`. Public Explore reads those rows; no code change is required to add a category.
