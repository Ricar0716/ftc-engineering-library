# FTC Open Library

The open-source engineering library for FIRST Tech Challenge teams.

> Find. Learn. Build. Share.

FTC Open Library is a public web app for discovering, previewing, and sharing engineering resources. A resource is the core object, not a raw file.

```text
Resources
├── CAD       Build it
├── CODE      Program it
├── TUTORIAL  Learn it
└── MODEL     Analyze it
```

This repository includes **public discovery**, **email authentication**, a **Site Admin category manager**, the **community contribution and moderation workflow**, **in-browser resource previews**, **saved resources**, **engineering discussion**, and **resource versioning**. Homepage, Explore, resource pages, teams, and public profiles do not require an account. Downloading original files, loading in-browser previews, and saving resources require a **verified** email. Verified users create drafts at `/submit`, upload files privately, and submit for review; Site Admins moderate first publishes at `/admin/resources` and later versions at `/admin/versions`. Published resources can receive a new version without unpublishing; that version stays private until a Site Admin approves it. Each upload is individually authorized by the database and bounded by per-user quotas, so a verified account is permission to contribute, not open access to Storage. Empty CAD / CODE / TUTORIAL / MODEL lists are valid.

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS v4
- Supabase (Postgres, Auth, Storage)
- Vercel + Supabase as the target production pairing

## Local setup

Requirements: Node.js 20+ and npm.

```bash
git clone <repository-url>
cd ftc-open-library
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The UI still boots without Supabase credentials. Public discovery pages show empty states until a project is configured and migrations/seed are applied.

## Environment variables

See `.env.example`. Do not invent or commit real keys.

| Variable                               | Where it is used                                             | Public?                                 |
| -------------------------------------- | ------------------------------------------------------------ | --------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Browser and server Supabase clients                          | Yes                                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | Browser and server Supabase clients (anon / publishable key) | Yes                                     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Optional alias if `ANON_KEY` is unset                        | Yes                                     |
| `NEXT_PUBLIC_SITE_URL`                 | Canonical origin for metadata, sitemap, and robots           | Yes                                     |
| `NEXT_PUBLIC_DISCUSSION_ENABLED`       | Set to `true` to restore public discussion (Beta default off) | Yes                                     |
| `SUPABASE_SERVICE_ROLE_KEY`            | Server-only admin client                                     | **No. Never ship this to the browser.** |

## Supabase project setup

1. Create a project at [supabase.com](https://supabase.com) **or** run the local stack with Docker:
   ```bash
   npx supabase start
   ```
2. Copy the URL and anon (publishable) key into `.env.local`.
3. Put the service role key in `.env.local` as `SUPABASE_SERVICE_ROLE_KEY` only. Never prefix it with `NEXT_PUBLIC_`.
4. Enable email auth in the dashboard (email confirmation can stay on).

## Running migrations

Hosted:

```bash
npx supabase db push
```

Local (Docker required):

```bash
npx supabase start
npx supabase db reset
```

`db reset` applies every file in `supabase/migrations/` then `supabase/seed.sql`.

SQL files in order:

1. `20260902100000_extensions_and_helpers.sql`
2. `20260902100001_identity_and_catalog.sql`
3. `20260902100002_resources.sql`
4. `20260902100003_community.sql`
5. `20260902100004_rls.sql`
6. `20260902100005_storage.sql`
7. `20260902100006_profile_trigger.sql`
8. `20260902100007_phase1_hardening.sql` (integrity, RLS, Storage privacy)
9. `20260906120000_resource_type_algorithm_to_model.sql` (ALGORITHM → MODEL)
10. `20260906210000_category_taxonomy.sql` (dynamic category trees)
11. `20260906220000_auth_authorization.sql` (verified-user and Site Admin gates)
12. `20260907080000_lock_published_resources.sql` (published-content lock)
13. `20260907180000_category_admin.sql` (Site Admin category CRUD)
14. `20260908090000_resource_submission_moderation.sql` (submission states, review audit trail, moderation RPCs)
15. `20260908190000_upload_abuse_hardening.sql` (single-object upload reservations, narrowed Storage RLS, quotas, orphan detection)

## Generating database types

After migrations exist on a running instance:

```bash
npx supabase gen types typescript --local > types/database.ts
```

Hosted:

```bash
npx supabase gen types typescript --project-id <project-ref> > types/database.ts
```

Phase 1 includes a hand-written `types/database.ts` that matches the SQL. Prefer regenerating once the CLI can reach a database.

## Running seed data

`npx supabase db reset` loads `supabase/seed.sql`.

Manual:

```bash
psql "$DATABASE_URL" -f supabase/seed/01_reference.sql
psql "$DATABASE_URL" -f supabase/seed/02_identities.sql
psql "$DATABASE_URL" -f supabase/seed/03_resources.sql
psql "$DATABASE_URL" -f supabase/seed/04_files_and_social.sql
```

Seed users, teams, and resources are **fictional**. Details: `supabase/seed/README.md`.

Local seed login (not for production): `maya@example.test` / `dev-only-password`.

## Storage setup

Migrations insert these buckets and policies:

- `resource-files` (private ordinary originals, 100 MB object ceiling)
- `tutorial-videos` (private Tutorial MP4/WebM only, 1 GB object ceiling)
- `resource-previews`
- `resource-thumbnails`
- `avatars`
- `team-logos`

Path convention: `{resourceId|userId|teamId}/...`. First path segment must be a UUID; `..` and non-UUID folders are rejected by Storage helpers.

A 1 GB Tutorial video also needs the **project Global File Size Limit** ≥ 1 GB. Local CLI: `supabase/config.toml` `[storage] file_size_limit = "1GiB"`. Hosted: Supabase Dashboard. Bucket limits still apply (`tutorial-videos` 1 GB, `resource-files` 100 MB). Those Storage ceilings do not raise application quotas.

TUS can resume after a **network drop in the same session**. Closing the browser, refreshing the page, or switching accounts is not a guaranteed recover.

**Original files in `resource-files` and `tutorial-videos` are not publicly readable.** Published metadata may list filenames; bytes are served to **verified** users through `/api/downloads/[fileId]` (attachment) and `/api/previews/[fileId]` (inline JSON ticket) as 60-second signed URLs against the trusted `resource_files.storage_bucket`. Knowing `storage_path` does not grant Storage access. Guests never receive original Tutorial video bytes. CAD/code/image previews fetch that ticket and load bytes in the tab; they do not use public model URLs.

Phase 1 seed creates **metadata references only**. Files in `supabase/seed/assets/` are not uploaded into Storage by SQL. Do not treat seed `storage_path` values as proof that binaries exist in a bucket.

## RLS architecture

See `SECURITY.md`. Short version: guests browse published public metadata; drafts stay private; published rows are immutable to authors; verified users may download originals via signed URLs; Site Admins are verified users with `site_admins` rows (not emails); original Storage objects are not anonymously readable.

## Scripts

```bash
npm run dev          # Next.js dev server
npm run build        # Production build
npm run start        # Serve the production build
npm run lint         # ESLint
npm run typecheck    # TypeScript (`tsc --noEmit`)
npm run test         # node:test (taxonomy, auth, upload policy, moderation workflow)
npm run format       # Prettier
npm run format:check # Prettier check
```

## Project layout

```text
app/                 App Router pages and route handlers
components/          UI, layout, search, resource, and team components
lib/                 Config, Supabase clients, data mappers, utilities
types/               Domain types and Database types
supabase/migrations/ SQL migrations
supabase/seed/       Fictional seed SQL and tiny sample files
```

## Public discovery (Phase 2)

Server Components load published public rows through `lib/db/*` and the cookie-based server client. Signed original-file downloads use the service-role client only after a verified-user check.

| Route                     | Source of truth                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `/`                       | Homepage: hero, featured latest published resources, type sections, teams |
| `/explore`                | URL query params: `q` (or `query`), `type`, `category` (category UUID), `tag`, `season`, `sort`, `page` |
| `/about`                  | Mission and resource-type overview |
| `/resources/[slug]`       | Published public resource metadata, versions, file names; verified downloads |
| `/login`, `/signup`       | Email/password auth                                                          |
| `/admin`                  | Site Admin overview: real counts; existing category and review tools          |
| `/admin/categories`       | Site Admin category tree manager                                             |
| `/admin/resources`        | Site Admin first-publish moderation (`PENDING_REVIEW`, plus Approved / Rejected / Changes requested) |
| `/admin/resources/[id]`   | Site Admin first-publish decision page (preview + approve / reject / request changes) |
| `/admin/versions`         | Site Admin later-version moderation (Pending / Published / Rejected / Changes requested) |
| `/admin/versions/[versionId]` | Site Admin version decision page (submitted preview + approve / reject / request changes) |
| `/admin/review`           | Redirects to `/admin/versions` |
| `/submit`                 | Verified-user draft creation                                                 |
| `/dashboard`              | Signed-in workspace: own resources, versions, saves, discussion, profile, team |
| `/my/resources`           | Redirects to `/dashboard/resources`                                          |
| `/my/resources/[id]/edit` | Draft / revision editor (UUID, not public slug)                              |
| `/teams`, `/teams/[slug]` | Public team portfolio: number, name, country, published counts, paginated resources |
| `/profile/[username]`     | Public contributor profile: name, bio, join date, type counts, paginated published resources |

Search uses Postgres `search_vector` (title + description). Tags, categories, and seasons are filters, not extra FTS fields. Default sort is **Newest** (`published_at`). **Recently updated** uses `updated_at`. **Most relevant** reuses the same FTS filter plus newest ordering. Pagination is 20 per page. Homepage cards never load CAD models, videos, or signed file URLs — only metadata and a type placeholder (or a same-origin public thumbnail path).

Resource pages list file names. Guests see **Sign in to download**. Verified accounts receive a short-lived signed URL from the server. Guests can still browse and search without an account.

## Authentication

Public browsing does not require an account. Downloading original Resource files requires a verified email. Site Admins moderate first-publish submissions in `/admin/resources`. Later versions stay on `/admin/versions`. `/admin/review` redirects to version review. Admin membership is `public.site_admins` — see `docs/admin-bootstrap.md`.

A user account is permission to **contribute**, not permission to **publish**.

## Community contribution and moderation

```text
Verified User
      ↓ create draft at /submit
   DRAFT ──────────── edit metadata, upload private files
      ↓ submit for review
PENDING_REVIEW ────── frozen: contributor cannot edit
      ↓ Site Admin decision at /admin/resources/[id]
      ├── Approve          → PUBLISHED           (public, files still private)
      ├── Request changes  → CHANGES_REQUESTED   → contributor edits → resubmit
      └── Reject           → REJECTED            (private, read-only, files kept)

Site Admin may also move PUBLISHED ↔ ARCHIVED.
Approving a resource does not approve later versions.
```

| Status              | Public? | Contributor may edit? |
| ------------------- | ------- | --------------------- |
| `DRAFT`             | No      | Yes                   |
| `PENDING_REVIEW`    | No      | No                    |
| `CHANGES_REQUESTED` | No      | Yes                   |
| `PUBLISHED`         | Yes     | No (create a reviewed version instead) |
| `REJECTED`          | No      | No                    |
| `ARCHIVED`          | No      | No                    |

Contributor routes: `/submit`, `/dashboard`, `/my/resources/[id]/edit`.
Site Admin routes: `/admin`, `/admin/resources`, `/admin/resources/[id]`, `/admin/versions`, `/admin/versions/[versionId]`, `/admin/categories`. `/admin/review` redirects to version review.

Every first-publish decision is appended to `public.resource_reviews` (reviewer, decision, message, timestamp); history is never overwritten. Later-version decisions use the same table with `version_id` set. That table is the audit log — there is no separate analytics store. Review notes are private to the contributor and Site Admins and never appear on a public resource page or the personal dashboard list. Contributors watch status on `/dashboard/reviews` and `/dashboard/versions` and read notes on `/my/resources/[id]/edit`. Email notifications are not part of this step.

`/admin/resources` is the first-publish workflow. `/admin/versions` is the later-version workflow. Approving version 1 does not approve version 2. Approving version 2 does not unpublish version 1. Version review shows the version creator (`created_by`), not only the original resource author, and uses `submitted_at` (last time the version entered the queue) rather than draft `created_at`. Versions that already have review history cannot be deleted.

### File uploads

Files go **directly from the browser to a private Storage bucket** (never through Next.js / Vercel). `create_upload_intent()` (database) validates ownership, editable state, file type, size, and quota, chooses the bucket (`tutorial-videos` only for TUTORIAL MP4/WebM; otherwise `resource-files`), and mints the object key `<resource-id>/<version-id>/<file-id>_<safe-filename>`. The client cannot pick a bucket or a path. Small ordinary files use a standard Storage upload; files above 6 MiB and every Tutorial MP4/WebM use TUS resumable upload with progress and retry. Both transports call `complete_upload_intent()`. Storage RLS requires `can_edit_resource` **and** `has_open_upload_intent(bucket, exact key)`. Limits live in `lib/config/uploads.ts` and are mirrored by `public.upload_limit()`; SQL is authoritative. A verified user may hold 3 GB of unpublished storage; Tutorial video is capped at 1 GB per file and 2 GB per Tutorial (2.25 GB overall including attachments). The deployed Supabase **project** Global File Size Limit must also be ≥ 1 GB or large videos will be rejected regardless of application policy.

Draft and pending files are private. The contributor and Site Admin reviewers open them through `/api/resource-files/[fileId]`, which re-checks authorization and returns a 60-second signed URL. Published originals continue to use `/api/downloads/[fileId]`. In-browser previews use `/api/previews/[fileId]` (same authorization, inline ticket, no download event). Site Admins and resource managers may preview unpublished files there; guests and unrelated verified users cannot. Approval never makes a Storage object public.

## Resource preview

`/resources/[slug]` is the learning surface: hero, actions, type-specific preview card, overview, file explorer, contributor card, metadata, tags, and related resources.

`ResourcePreview` selects a viewer from Resource Type:

| Type | Viewer | What it shows |
| --- | --- | --- |
| CAD | `CADPreview` | Shared Three.js `ModelViewer` for `.glb`, `.gltf`, `.stl`, `.obj`, `.3mf` up to 25 MB. Default file is GLB, then glTF, STL, OBJ, 3MF. |
| CODE | `CodePreview` | Syntax-highlighted source (Java, Kotlin, C++, Python, …) up to 400 KB. Source files appear under a `Source/` tree; oversized files say “Download file to view”. Never executed. |
| TUTORIAL | `TutorialPreview` | Markdown/text notes and images. Uploaded MP4/WebM stay private downloads — no streaming. |
| MODEL | `ModelPreview` | Same 3D viewer for mesh files, plus package metadata and optional images. No inference or runtime. Blender files are not opened. |

Guests see filenames and sizes only. Verified users load preview bytes through a 60-second signed URL that is fetched immediately and not stored as a public model link. STEP/IGES/native CAD, ZIP archives, sidecar glTF (external `.bin`), and files over 25 MB remain download-only (“Large model. Download file for full resolution.”) instead of a broken canvas. The Resource Detail page still only mounts `ResourcePreview`; it does not import Three.js.

Related resources prefer `resource_relations`; if none exist, the page lists other published items of the same type and category.

The detail page layout lives in `components/resources/`: `ResourceHero`, `ResourceActions`, `ResourcePreviewCard` (existing `ResourcePreview` inside), `ResourceDescription`, `ResourceFileExplorer`, `ResourceAuthorCard`, `ResourceMetadata`, `VersionHistory`, `ResourceDiscussion` (hidden while Beta discussion is off), and `ResourceRelated`. Guests get a sign-in CTA instead of a download. Preview and downloads follow the selected published version (`?version=`).

## Discovery

The public journey is Home → Explore → Resource detail → contributor or team. `/` is a server-rendered homepage (`HomepageHero`, featured latest published resources, CAD/CODE/TUTORIAL/MODEL sections, teams, contribute CTA). `/explore` keeps search and filters in the URL (`q`, `type`, `category`, `tag`, `season`, `sort`, `page`) and paginates 20 results from the database. Only the unfiltered `/explore` URL is indexable; query combinations canonicalize to `/explore` and are `noindex`. Keywords match title and description (Postgres FTS) plus tags, category names, authors, and teams (bounded ILIKE, published rows only). Sort options are Newest, Recently updated, and Most downloaded (real `resource_stats.download_count`). Cards (`ResourceCard`) link to `/resources/[slug]` and show a type placeholder unless a same-origin public thumbnail path exists — never a Storage signed URL. Nav is Home, Explore, Contribute, About, and Teams.

`/profile/[username]` shows public identity (avatar or initials, display name, `@username`, bio, join date) and that contributor’s **published** resources, paginated. `/teams/[teamNumber]` is the FTC team portfolio (number, name, country if stored, published counts, seasons that actually appear, paginated resources). Resource pages link **Created by** to the profile and **Team {number}** to the team page. Email, drafts, and moderation state stay off these pages. Profile editing is later.

## Saved resources

Verified users can save a published public resource from the detail page (`☆ Save` / `★ Saved`) and reopen the list at `/dashboard/favorites`. Guests are sent to sign in; unverified accounts verify first. The existing `favorites` table is unique on `(user_id, resource_id)`. RLS allows a user to insert or delete only their own rows, and inserts also require `is_verified_user()` plus `resource_is_published_public()`. Public pages may show a save count from `resource_stats` (published public aggregates only). Resource cards do not include a favorite button. Collections, ratings, and followers are later.

## Discussion

Discussion code, `public.comments`, and historical posts remain in the project. **Public discussion is off for the initial Beta** (`NEXT_PUBLIC_DISCUSSION_ENABLED` is not `true`). Resource pages do not render the Discussion UI, dashboard nav hides Discussions, and `createDiscussion` / `updateDiscussion` refuse new posts. Set the env var to `true` to restore the surface. RLS is still the authorization layer — the flag only hides and pauses interaction.

When enabled, published public resources have an engineering **Discussion** on the detail page (Preview → Description → Files → Versions → Discussion → Related). It is not a social comment feed: no likes, reactions, or notifications.

Guests can read VISIBLE posts. Verified users can start a thread or reply one level deep. Authors can edit their own VISIBLE text (1–4000 characters). Site Admins hide or restore posts on that same page (`/resources/[slug]#discussion`); there is no separate discussion dashboard. The table is still `public.comments` (`parent_id`, status `VISIBLE | HIDDEN | DELETED`). Drafts and submissions under review have no public discussion. Unpublishing a resource hides its threads through `resource_is_published_public()`.

## Public SEO

Set `NEXT_PUBLIC_SITE_URL` to the production origin before launch (for example `https://example.com`). Do not hardcode a domain that is not owned. Local development uses `http://localhost:3000`. Vercel previews fall back to `https://$VERCEL_URL`.

Public pages emit titles, descriptions, canonical URLs, and Open Graph tags. Resource metadata comes from a lightweight `PUBLISHED` + `PUBLIC` query — no files, pending versions, moderation notes, or signed Storage URLs. Missing or unpublished slugs call `notFound()` from `generateMetadata` and use generic “not found” copy with `noindex`; they do not leak the private title. Historical `?version=` views stay shareable but canonicalize to `/resources/[slug]` so each resource is one index document.

`app/sitemap.ts` lists `/`, `/explore`, `/about`, `/teams`, published resources, and public profiles/teams that already have published resources. It never lists drafts, pending/rejected rows, admin, dashboard, or auth URLs. `app/robots.ts` disallows those private routes. **robots.txt is not access control** — those routes still require auth, RLS, and server gates. Admin, dashboard, auth, submit, and editor layouts also set `robots: noindex`.

## Public UI

The logo includes a small **Beta** badge. Empty Explore results explain how to widen the search and offer **Clear filters**. Missing resources never reveal pending or private status. Preview errors stay in the preview panel. Public Discussion stays off for Beta.

## Resource versions

Published resources keep a revision history on `public.resource_versions`. Files belong to a version, not directly to the resource. Existing rows were backfilled to **v1** (`version_number = 1`) without copying Storage objects.

```text
Resource (catalog: DRAFT → … → PUBLISHED)
 └── Version  v1.0 PUBLISHED
 │     └── Files
 └── Version  v1.1 DRAFT / PENDING_REVIEW / PUBLISHED / ARCHIVED
       └── Files
```

The public page shows the **latest published version** by default. Guests can open an older published release with `?version=`. Changelogs are plain text (no CAD/code diff). Contributors create a new version from `/my/resources/[id]/edit`; it does not replace public files until a Site Admin approves it with `review_resource_revision`. First-time publish still uses `review_resource`.

Migration: `supabase/migrations/20260909200000_resource_versioning.sql`.

## Personal dashboard

Signed-in users get a workspace at `/dashboard` (guests are sent to login). It reuses existing tables — no new migrations.

| Route | What it shows |
| ----- | ------------- |
| `/dashboard` | Counts of own published / draft / pending / saved / discussion posts |
| `/dashboard/resources` | Own resources, filterable, paginated |
| `/dashboard/drafts` | `DRAFT` and `CHANGES_REQUESTED` with continue-editing links |
| `/dashboard/reviews` | Own `PENDING_REVIEW` resources and versions |
| `/dashboard/versions` | Own `resource_versions` |
| `/dashboard/favorites` | Existing saved-resources query |
| `/dashboard/discussions` | Own VISIBLE posts on published public resources |
| `/dashboard/profile` | Read-only username, avatar, bio |
| `/dashboard/team` | Membership role and a link to the public team page |

Queries are server-side and scoped to `auth` user id (`author_id` or `user_id`). Other people’s drafts never load. Reviewer notes stay on `/my/resources/[id]/edit`, not the dashboard. Profile editing, team management, notifications, and analytics are not included.

## Admin overview

`/admin` is a Site Admin control-center homepage. Guests are sent to login; verified contributors and unverified accounts go to `/forbidden`. The page shows aggregated counts only (users, resources, published, pending first publishes, pending versions, VISIBLE discussion posts) from `getAdminOverviewStats()`. It does not list unpublished titles, emails, or files. Category management, the review queue, and upload hygiene stay available as existing tools. User management, discussion queues, featured resources, analytics, and settings are later.

## Resource types

Every public catalog item is a Resource with one of four types:

| Type     | Meaning    | Examples (uploaded later, not built into the app) |
| -------- | ---------- | ------------------------------------------------- |
| CAD      | Build it   | Mechanisms, assemblies, printable parts           |
| CODE     | Program it | TeleOp, autonomous, PID implementations           |
| TUTORIAL | Learn it   | Articles and guides                               |
| MODEL    | Analyze it | Calculators, simulators, and visualizers          |

MODEL uses the same Resource tables, filters (`/explore?type=MODEL`), badges, and empty states as the other types. There is no standalone Tools area and no first-party projectile calculator. Interactive models will be uploaded as MODEL Resources later and must not execute inside the main Next.js context without an isolated runtime.

## Category taxonomy

Resource Types are fixed. Categories are database rows:

```text
Resource Types
├── CAD
├── CODE
├── TUTORIAL
└── MODEL

Each type → dynamic category tree (`parent_id`) → Resource (optional `category_id`)
```

Explore shows a type’s category tree when `type` is set (`/explore?type=CAD&category=<uuid>`). Parent selection includes descendant categories. Zero categories and zero resources are both valid. Category names are not hardcoded in the app; seed taxonomy in `supabase/seed/01_reference.sql` is development-only. Tags remain a separate, non-hierarchical system; contributors may only attach existing tags, never create them. Site Admins manage the tree at `/admin/categories`.

The submission form offers only **active** categories of the selected Resource Type, shown with their full path (`Launching > Flywheel > Dual Flywheel`). A category is required at submission time only when the type actually has active categories, so a type with zero categories still accepts submissions.

## What is still later

- Reviewed-revision workflow for already-published resources
- Email notifications for review decisions
- Isolated/sandboxed MODEL execution for uploaded calculators and simulators
- Admin user manager and tag manager
- Admin-chosen preview file / thumbnail / featured image
- STEP / IGES / native CAD viewers and CAD conversion
- Tutorial video playback, transcoding, HLS/DASH, or external hosted video
- Ratings, collections, and social feeds
- Profile editing (bio, avatar, team membership UI)
- Followers, messaging, reputation, badges, and leaderboards
- Semantic / AI search (embeddings, vector ranking, natural-language recommendations)
- Physical Storage objects for seed files (metadata only)

Phase 1 hardening lives in `supabase/migrations/20260902100007_phase1_hardening.sql`. Upload abuse hardening lives in `supabase/migrations/20260908190000_upload_abuse_hardening.sql`; `SECURITY.md` explains the reservation model and `docs/deployment-hardening.md` covers the parts that belong to the deployment rather than the code.
