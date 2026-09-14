# Architecture

FTC Open Library is a Next.js App Router application with Supabase as the data, auth, and storage backend. There is no separate API service.

## Phase 0 decisions

### Framework

Next.js 16.3 App Router, React 19, TypeScript, Tailwind CSS v4. This matches the current stable Next.js release used by `create-next-app` and deploys cleanly to Vercel.

### No `src/` directory

Routes, components, and libraries live at the repository root as specified in the product plan. Import alias: `@/*`.

### Design system before pages

Pages compose shared primitives (`Button`, `Card`, `Input`, `Select`, `EmptyState`, `ResourceCard`, `SearchBar`, `FilterPanel`) instead of one-off layouts. Color and type live in `app/globals.css` `@theme` tokens so later pages cannot drift into a second visual language.

Typography is IBM Plex Sans + IBM Plex Mono: technical, readable, and distinct from generic Inter/Geist marketing sites.

### Supabase clients

Three clients, no browser access to the service role:

| Module                   | Runtime                                           | Key                          |
| ------------------------ | ------------------------------------------------- | ---------------------------- |
| `lib/supabase/client.ts` | Browser                                           | anon / publishable           |
| `lib/supabase/server.ts` | Server Components, Server Actions, Route Handlers | anon / publishable + cookies |
| `lib/supabase/admin.ts`  | Trusted server only (`server-only`)               | service role                 |

`lib/supabase/proxy.ts` plus root `proxy.ts` refresh the Auth session on each matched request. Next.js 16 renamed the old `middleware.ts` convention to `proxy.ts`; this project follows that file name.

If `NEXT_PUBLIC_SUPABASE_URL` and the anon key are missing, the proxy is a no-op and the UI still boots. Calling `createClient()` without config throws instead of failing silently.

Public env vars are validated with Zod in `lib/env.ts`. The service role key is read only from `lib/env.server.ts` (`server-only`), which `lib/supabase/admin.ts` imports. The public key is read from `NEXT_PUBLIC_SUPABASE_ANON_KEY`, with `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as a fallback so either dashboard label works. There is no `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.

### Search URLs

Explore search and filters are ordinary query parameters parsed in `lib/search/params.ts`. That URL is the source of truth (refresh, share, and back/forward all restore the same query).

```text
/explore?q=mecanum&type=CAD&category=<category-uuid>&tag=drivetrain&season=IntoDeep&sort=newest&page=2
```

`q` is the keyword (`query` is accepted as an alias). `category` is the category **id** (UUID), not a slug, because slugs may repeat under different parents or Resource Types. `sort=newest` is stored as `latest`. Type browsing lives on the homepage cards and Explore filters.

Default sort is `latest` (`published_at`, labeled Newest). `updated` sorts by `updated_at`. `downloads` orders by real `resource_stats.download_count` (capped scan). `relevance` remains a URL alias that reuses FTS plus newest order. Unknown `sort` values fall back to latest. Pagination uses `page` with 20 results per page.

### Search strategy

Public search is database filtering in `listPublishedResources`. There is no embeddings index, vector database, or external search engine.

1. **Title and description** use the generated `tsvector` `resources.search_vector` (title A, description B) with a GIN index and sanitized plain-English `textSearch`.
2. **Tags, category names, author names, and team names** are resolved with bounded ILIKE lookups (`lib/db/search-expand.ts`) and unioned with FTS matches. Extra ids are always re-filtered with `status = PUBLISHED` and `visibility = PUBLIC`.
3. **Facets** (type, category tree including descendants, tag slug, season label) AND with the keyword. Category names are loaded from `categories`, never hardcoded.
4. When keyword expansion returns extra ids, matching is capped (500) and paginated in the server. Title-only queries keep SQL `range` pagination.

AI / semantic search is later work. Do not add it to this listing path.

### Domain vs database types

`types/resources.ts`, `types/users.ts`, and `types/teams.ts` are the UI contracts. `types/database.ts` matches the Phase 1 SQL schema. UI components should keep depending on domain types; `lib/db/mappers.ts` converts rows.

### Auth callback

`app/(auth)/callback/route.ts` exchanges a PKCE `code` (or OTP `token_hash`) for a session, then redirects. `next` values that are not same-origin relative paths are ignored to prevent open redirects.

### Upload limits

`lib/config/uploads.ts` is the TypeScript copy of upload rules: per-file size, file count, per-resource-type quotas (including Tutorial video), the blocked-extension deny list, the per-type allowlist, extension → `file_type` / MIME mapping, filename sanitization, and bucket routing. Server actions, the browser uploader, and UI copy all read from it. Trusted enforcement is in Postgres (`public.upload_limit()`, extension tables, and the upload RPCs). `lib/config/upload-policy.test.ts` fails if the two copies drift. The private `resource-files` bucket has a 100 MB `file_size_limit`; `tutorial-videos` has a 1 GB `file_size_limit`. Neither is public.

### Logging

`lib/utils/logger.ts` writes to stdout and strips common secret field names. It does not replace a later structured logger.

## Phase 1 — database

Schema SQL lives in `supabase/migrations/`. Seed SQL is fictional development data only.

```text
auth.users
    │
    ↓  (trigger handle_new_user)
profiles
    │
    ├── team_members ── teams
    │
    └── resources
            │
            ├── resource_versions
            │       └── resource_files
            │
            ├── resource_tags ── tags
            ├── resource_hardware ── hardware
            ├── favorites
            ├── ratings
            ├── comments
            ├── downloads
            └── resource_relations
```

Catalog tables (`seasons`, `categories`, `licenses`) attach to `resources` by foreign key. `parent_resource_id` on `resources` is reserved for later forks.

### RLS strategy

RLS is on for all user-facing tables. Policies are summarized in `SECURITY.md`. Helpers (`is_team_admin`, `is_verified_user`, `is_site_admin`, `resource_is_published_public`, `can_manage_resource`, `can_edit_resource`) are `SECURITY DEFINER` so child-table policies do not recurse.

Public reads require `status = PUBLISHED` and `visibility = PUBLIC`. Authors and team admins can see their unpublished rows, and Site Admins can see submissions they moderate. Downloads are own-row; `resource_stats` exposes aggregates for public resources only.

`author_id` is immutable after insert. `team_id` can only be changed by an admin of the old team (and assigned only to a team the caller admins). Resource `UPDATE` WITH CHECK no longer lets an author attach an arbitrary team.

### Storage strategy

Five buckets: `resource-files` (private originals), `resource-previews`, `resource-thumbnails`, `avatars`, `team-logos`. First path folder is a UUID (resource, user, or team). Non-UUID first segments (including `..`) map to NULL and fail writes.

Original objects are **not** readable by anonymous users or by arbitrary authenticated users just because the resource is published. Managers who are verified may still SELECT their own originals. Public downloads go through `/api/downloads/[fileId]`, which checks a verified session and mints a 60-second signed URL with the service-role client. Preview/thumbnail objects for published-public resources may be read without an account.

### Search strategy

Stored generated `tsvector` `resources.search_vector` (title A, description B) plus GIN. Keyword expansion for tags, category names, authors, and teams is application-side ILIKE plus published-id union (`lib/db/search-expand.ts`). Facet filters stay as joins. Explore URLs remain query parameters.

### Profile / auth

`profiles.id` is `auth.users.id`. `handle_new_user` creates a unique username from metadata or the email local part. Email is not copied onto `profiles`.

### Resource / version / file

A resource has many `resource_versions`. Files belong to a version and a resource. A composite foreign key `(version_id, resource_id) → resource_versions (id, resource_id)` prevents a file from pointing at another resource’s version. Downloads use the same pattern: `(file_id, resource_id) → resource_files`. The UI may show only the current (highest) version until a version picker exists.

Team URLs: domain `slug` is `team_number` (text), e.g. `/teams/10001`.

## Phase 2 — public discovery

Read-only public pages fetch through `lib/db/resources.ts`, `lib/db/teams.ts`, `lib/db/catalog.ts`, and `lib/db/profiles.ts`. They use `createClient()` from `lib/supabase/server.ts` (anon key + cookies). If env vars are missing, lists render as empty states instead of throwing.

Queries always constrain `status = PUBLISHED` and `visibility = PUBLIC` in addition to RLS. Drafts (`secret-intake-sketch` in seed) and archived rows are not listed.

Search is `textSearch` on `resources.search_vector` (plain English, sanitized) unioned with published rows whose tags, category names, authors, or teams match the keyword. Tag and season filters resolve slugs/labels to ids first; category filters resolve a UUID and then include descendant category ids. Unknown values yield no rows rather than a 500.

Most-downloaded / most-rated sorts load matching ids (capped at 500), order by `resource_stats`, then fetch that page. Latest/oldest sort in Postgres with `range` unless keyword expansion produced extra ids, in which case the matched-id cap applies.

Resource detail shows file **names** from `resource_files`. Original bytes are not public URLs. Verified users download through `/api/downloads/[fileId]` and preview through `/api/previews/[fileId]`.

## Phase 6 — resource preview

The public Resource page is the learning interface. Preview selection is centralized in `lib/previews/select.ts` and `components/previews/resource-preview.tsx`:

```text
ResourcePreview
 ├── CAD        CADPreview     MeshPreview → ModelViewer
 ├── CODE       CodePreview    highlighted source, never executed
 ├── TUTORIAL   TutorialPreview  notes + images; video is download-only
 └── MODEL      ModelPreview   MeshPreview → ModelViewer (+ images; no runtime)
```

CAD and MODEL share one WebGL implementation in `components/viewer/` (`ModelViewer`, `ModelControls`, `model-loader`, `viewer-utils`). Formats: GLB, glTF, STL, OBJ, 3MF. Priority when several candidates exist: GLB → glTF → STL → OBJ → 3MF; the user picks a file rather than loading every mesh. The canvas is dynamically imported (`ssr: false`) and constructed only after the preview section is visible, so Three.js does not load on Explore. Camera fits model bounds. Rotate / zoom / pan / reset are OrbitControls; a grid helper is optional. Code uses `highlight.js` on escaped text and lists files under a `Source/` tree (nested only if a `/` remains in the filename). Large meshes stay behind “Large model. Download file for full resolution.” (25 MB); large code stays behind “Download file to view” (400 KB).

Authorization matches downloads for the public catalog: verified or Site Admin, `PUBLISHED` + `PUBLIC`, **version `PUBLISHED`**, storage path first folder equals resource id, bucket from trusted `resource_files.storage_bucket`. Unpublished files may also be previewed when `can_manage_resource()` is true or the caller is a Site Admin, including a pending revision of a published resource — that is what `/admin/resources/[id]` and `/admin/versions/[versionId]` use. `/api/previews/[fileId]` returns JSON `{ url, filename, mimeType, expiresIn }` with a 60-second **inline** signed URL (no `download:` disposition, no `downloads` row). Guests get **401 JSON**, not a login HTML redirect, so `fetch()` cannot treat a login page as a model. The client loads bytes immediately; signed URLs are not persisted in page HTML.

Tutorial MP4/WebM are not played in an HTML5 player (that would need a long-lived URL or a full blob of a 1 GB file). They use the existing download route. `tutorial-videos` stays private.

Related resources: explicit `resource_relations` first; otherwise up to four other published resources of the same type and category. No recommendation model.

There is no preview metadata table. Behavior is derived from Resource Type, filenames, and sizes. Admin-chosen preview files and ResourceCard mesh thumbnails remain later work (`lib/previews/mesh-thumbnail.ts` is a deferred interface only). STEP/IGES/Fusion stay download-only.

## Phase 6.1 — resource detail experience

The public Resource page is assembled from focused UI components. Preview security is unchanged.

```text
/resources/[slug]
 ├── ResourceHero            title, type badge, breadcrumb, author, dates, tags
 ├── ResourceActions         download / preview / copy link (permission-aware)
 ├── ResourcePreviewCard     VersionSelector + existing ResourcePreview
 ├── ResourceDescription     overview from `description`; selected version changelog
 ├── ResourceFileExplorer    files of the selected published version
 ├── ResourceAuthorCard      contributor / team, published count
 ├── ResourceMetadata        competition, hardware, selected version, download count
 ├── VersionHistory          published releases and changelogs
 ├── ResourceDiscussion      engineering discussion (STEP 7.2)
 └── ResourceRelated         relations or same type+category; empty state if none
```

Guests still see metadata and filenames. The primary download action is **Sign in to download**. Unverified accounts see **Verify your email to download**. Verified users follow a same-origin `<a href="/api/downloads/[fileId]">` so the browser can follow the signed Storage redirect; the client does not `fetch` the route or read the `Location` header. The explorer never renders bucket names, storage paths, or signed URLs. Views are not shown because `resource_stats` has no view column. Software/SDK fields are not invented; hardware chips are whatever contributors attached. Resource Actions include Save; counts come from `resource_stats.favorite_count`.

## Phase 6.2 — homepage and discovery

Public discovery is server-rendered. The homepage never loads CAD canvases, tutorial videos, or signed file URLs.

```text
/                          HomepageHero, BrowseByType, FeaturedResources, CategorySection ×4
/explore                   ResourceFilters + SearchResults (toolbar, active filters, ResourceGrid, Pagination)
/about                     Mission and resource types
ResourceCard               slug link, type placeholder or same-origin thumbnail
```

Lists always use `status = PUBLISHED` and `visibility = PUBLIC`. Featured resources are the latest published rows (no featured table). Published count is the real `listPublishedResources` total, shown only when greater than zero.

## Phase 6.3 — search and advanced filtering

Explore is the search surface. State lives in the URL (`lib/search/params.ts`); the server fetches a page of published rows. Keyword highlighting is omitted.

```text
SearchBar                 GET /explore?q=
ResourceFilters           type, DB categories, tags, seasons (sidebar / mobile drawer)
ActiveFilters             remove one or clear all
SortSelector              Newest, Recently updated, Most downloaded
SearchResults             query + count + ResourceGrid + empty/error/loading
```

`listPublishedResources` remains the only public list query. Cards stay `ResourceCard`. Drafts, pending review, and rejected rows never appear. Semantic / AI search is not implemented.

## Phase 6.4 — contributor and team identity

Public identity pages reuse `profiles`, `teams`, and `resources.author_id` / `resources.team_id`. No new tables. Email is not on `profiles` and is never selected.

```text
/profile/[username]        ProfileHeader, ProfileStats, paginated ProfileResources
/teams/[teamNumber]        TeamHeader, TeamStats, paginated TeamResources
ResourceHero               Created by → /profile/[username]; Team N → /teams/N
ResourceAuthorCard         same links; published count from PUBLISHED + PUBLIC rows
```

Counts are HEAD queries filtered to `PUBLISHED` + `PUBLIC`, split by Resource Type. Team season labels come from seasons that actually have published team resources. Pagination is 20 per page via `listPublishedResources`. Avatars use the existing `avatars` bucket URL or initials. Profile editing, followers, and team management are later.

## Phase 6.5 — CAD / MODEL 3D viewer

Visualization only. No CAD editing, no conversion farm, no MODEL execution.

```text
Resource Detail
 └── ResourcePreview            unchanged public interface
      ├── CADPreview            MeshPreview (CAD)
      └── ModelPreview          package copy + MeshPreview (MODEL) + images
           └── ModelViewer      Three.js, ssr: false, visible-section load
                ├── signed preview ticket   /api/previews/[fileId]
                └── temporary bytes         never a public Storage URL
```

Guests still see filenames, format, and size. Bytes load only after a verified session receives a 60-second inline signed URL. Private `resource-files` / `tutorial-videos` stay private. glTF with external buffers, Draco-compressed GLB, STEP, IGES, Fusion, SolidWorks, and Blender are not viewers. Upload allowlists add `glb`/`gltf` for CAD and mesh extensions for MODEL (`20260909160000_preview_mesh_formats.sql`); that is not a preview table.

## Phase 7.1 — favorites

Reuses Phase 1 `public.favorites` (`PRIMARY KEY (user_id, resource_id)`). No second table and no collections.

```text
Resource Detail          FavoriteButton (optimistic ☆ Save / ★ Saved)
Dashboard                Saved resources card
/dashboard/favorites     paginated ResourceCard grid
```

Inserts require a verified session, `user_id = auth.uid()`, and `resource_is_published_public()`. Deletes and selects are own-row only. Public save counts use `resource_stats.favorite_count`. If a resource is later unpublished, existing rows remain but listing joins `PUBLISHED` + `PUBLIC` so they never appear. Index: `favorites_user_created_at_idx`. RPCs: `list_own_published_favorites`, `count_own_published_favorites` (`SECURITY INVOKER`). Resource cards do not host a favorite button.

## Phase 7.2 — engineering discussion

Reuses Phase 1 `public.comments`. No forums, channels, or private messages. The UI label is **Discussion**.

```text
Resource Detail
 └── ResourceDiscussion
      ├── DiscussionComposer     guest → login, unverified → verify
      └── threads (20 / page)
           └── DiscussionItem    Author / Team Owner badges (visibility only)
                └── DiscussionReply   one level via parent_id
```

| Who | Read VISIBLE on published public | Create / reply | Edit own body | Hide / restore |
| --- | --- | --- | --- | --- |
| Guest | Yes | No | No | No |
| Unverified | Yes | No | No | No |
| Verified | Yes | Yes | Yes (VISIBLE only) | No |
| Site Admin | Yes (all statuses) | Yes | Own body | Yes, on the resource page |

Drafts, pending review, and unpublished resources have no public discussion. RLS requires `resource_is_published_public()` for guest/author SELECT and for INSERT. `parent_id` may only point at a VISIBLE root on the same resource (no nested trees). Body is 1–4000 characters. Hard DELETE is denied; Hide sets `HIDDEN`, Restore sets `VISIBLE`. `DELETED` is reserved. No likes, reactions, or notification rows — `id` / `parent_id` / `user_id` remain available for a later “someone replied” feature.

The initial Beta keeps this implementation and data, but **public Discussion UI is off** unless `NEXT_PUBLIC_DISCUSSION_ENABLED=true`. `isDiscussionEnabled()` is a product switch, not authorization.

## Phase 7.3 — resource versioning

Reuses Phase 1 `public.resource_versions`. No second table, no git history, no CAD/code diff. `resources.status` remains the catalog gate so a published page, favorites, search, and discussion stay live while a revision is reviewed.

```text
Resource Detail
 ├── VersionSelector     ?version=  (published only)
 ├── ResourcePreview     files of the selected published version
 ├── ResourceFileExplorer
 └── VersionHistory      changelog cards, latest first
```

Contributor: `/my/resources/[id]/edit` → Create new version → upload to that DRAFT version → submit. Admin: `/admin/versions`, `review_resource_revision`. First-publish stays on `/admin/resources`. Version review names `resource_versions.created_by` (Submitted by), not `resources.author_id`. Queue time is `submitted_at`, not `created_at`.

| Version status | Public? | Contributor may edit files? |

| Version status | Public? | Contributor may edit files? |
| -------------- | ------- | --------------------------- |
| `DRAFT` | No | Yes (own resource, verified) |
| `PENDING_REVIEW` | No | No (withdraw instead) |
| `PUBLISHED` | Yes, if the resource is published public | No |
| `ARCHIVED` | No | No |

Migration backfill: every existing version gets `status` from the parent resource (`PUBLISHED`/`ARCHIVED` → version `PUBLISHED` + `released_at`). Files keep `version_id`. Storage keys stay `<resource-id>/<version-id>/…`.

RPCs: `start_resource_revision`, `submit_resource_revision`, `withdraw_resource_revision`, `review_resource_revision`. First publish still uses `submit_resource_for_review` / `review_resource`, which sync version 1. Uploads target `upload_target_version_id()` (the DRAFT version) through existing Upload Intent. `can_edit_resource()` is unchanged. A reviewed version cannot be hard-deleted; `resource_reviews.version_id` stays attributable.

## Phase 7.4 — personal dashboard

Reuses profiles, resources, resource_versions, favorites, comments, and team_members. No migration.

```text
/dashboard                 Overview counts + published ResourceCard preview
/dashboard/resources       Own catalog rows (?status=) paginated
/dashboard/drafts          DRAFT + CHANGES_REQUESTED → /my/resources/[id]/edit
/dashboard/reviews         PENDING_REVIEW resources and versions
/dashboard/versions        Own versions
/dashboard/favorites       listOwnPublishedFavorites (unchanged RPCs)
/dashboard/discussions     Own VISIBLE comments on published public resources
/dashboard/profile         Read-only identity
/dashboard/team            Role + public team link
```

Guests hitting `/dashboard/*` go to login (`requireSignedInPage`). Saved resources still require a verified email. Layout sidebar collapses under a Workspace disclosure on small screens. `/my/resources` redirects to `/dashboard/resources`. The editor stays at `/my/resources/[id]/edit`. Counts are `count(*)` / RPC totals, not invented analytics. Reviewer messages are not selected.

## Phase 8.1.1 — admin overview

No migration. `/admin` layout still uses `requireAdminPage` (guest → login, non-admin → `/forbidden`). The homepage loads `getAdminOverviewStats()` through the cookie client after `requireSiteAdmin()`; it returns six `count(*)` totals and never selects emails, bodies, or storage paths. The service role is not used. Sidebar lists Overview plus the existing Review queue and Categories routes; Resources, Versions, Users, Discussions, and Settings are labeled Later and are not linked. Upload hygiene remains on the overview.

## Resource types

The catalog is one Resource system with four types:

```text
Resources
├── CAD       Build it
├── CODE      Program it
├── TUTORIAL  Learn it
└── MODEL     Analyze it
```

MODEL is not a separate product. It uses `resources`, versions, files, tags, licenses, ratings, favorites, and comments like every other type. `/explore?type=MODEL` is the listing URL. Actual MODEL content (projectile calculators, gear-ratio tools, PID simulators, and similar) will be uploaded later. Empty MODEL results are expected.

There is no standalone `/tools` application area.

Future MODEL packages that include interactive web content must be validated and executed in an isolated/sandboxed runtime, not imported into the Next.js app context:

```text
MODEL Resource → uploaded model package → validation → isolated / sandboxed runtime
```

That runtime is not implemented in this phase.

## Category taxonomy

Resource Types are stable (`CAD | CODE | TUTORIAL | MODEL`). Everything under a type is a **dynamic category tree** stored in `categories`, not TypeScript enums or UI hardcoding.

```text
Resource Types
├── CAD
├── CODE
├── TUTORIAL
└── MODEL

Each Resource Type
        ↓
Dynamic Category Tree  (database rows, parent_id, arbitrary depth)
        ↓
Resource.category_id   (nullable primary category)
```

- Load all rows for a Resource Type in one query (`lib/db/catalog.ts`), then build the tree in memory (`lib/categories/tree.ts`).
- Public Explore navigation shows **active** categories only. Zero categories is valid (`No categories yet.`).
- Selecting a category on `/explore?type=CAD&category=<id>` includes resources whose primary category is that node **or any descendant**.
- Resource cards show the immediate category name. Resource detail breadcrumbs walk ancestors: `CAD / … / leaf`.
- Tags stay a separate cross-cutting list (`resource_tags`). Do not merge tags into the hierarchy.
- `resources.category_id` is the primary/canonical category. A future `resource_category_links` join table can add multi-category assignment without replacing this column.
- Site Admins manage the tree at `/admin/categories`. New categories are database rows only; public UI reads them without a code change. `resource_type` is immutable after insert.

Seed category names in `supabase/seed/01_reference.sql` are **development-only**. Application logic must not depend on them.

## Authentication / authorization

Three effective access levels. Team `OWNER` / `ADMIN` / `MEMBER` are not Site Admin.

```text
Guest
      ↓
Browse public catalog only

Verified User
      ↓
Browse
Download originals (signed URL)
Create drafts, upload files, submit for review
Future export

Site Admin  (verified email + public.site_admins.user_id)
      ↓
Verified User permissions
+ /admin
+ /admin/categories
+ /admin/resources  (first-publish approve / request changes / reject)
+ /admin/versions   (new version approve / request changes / reject)
```

An account grants the ability to contribute, never the ability to publish.

Email/password is implemented (`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify`, `/callback`). OAuth is not. Email confirmation is required before downloading, exporting, or submitting.

`lib/auth/session.ts` uses `supabase.auth.getUser()` (not client-only state). UI hiding is not a security boundary.

Site Admin bootstrap is manual trusted SQL: `docs/admin-bootstrap.md`. Application code never checks a hardcoded email.

Every `/admin` route, including `/admin/resources` and `/admin/versions`, is protected in `app/admin/layout.tsx`. Guests go to login. Unverified and verified non-admins go to `/forbidden`. `/admin` shows aggregated counts (`lib/admin/queries.ts`) plus links to resource review, version review, the category manager, and orphan sweep. `/admin/review` redirects to `/admin/versions`. Category and moderation mutations are Server Actions that call `requireSiteAdmin()` / `canAccessAdmin()` again, then write through the cookie client under RLS (`is_site_admin()`). The service role key is not used for taxonomy, overview counts, or moderation writes.

## Contribution and moderation

```text
Verified User
    ↓  /submit
  DRAFT ──────── edit metadata, upload private files  (/my/resources/[id]/edit)
    ↓  submit_resource_for_review()
PENDING_REVIEW ── frozen for the contributor
    ↓  Site Admin at /admin/resources/[id] → review_resource()
    ├── APPROVED          → PUBLISHED
    ├── CHANGES_REQUESTED → contributor edits → resubmit → PENDING_REVIEW
    └── REJECTED          → private, read-only

Approving a resource does not approve later versions.
Those stay on /admin/versions and use review_resource_revision().

Site Admin also: PUBLISHED ↔ ARCHIVED via set_resource_archived()
```

Version moderation (resource already PUBLISHED):

```text
vN PUBLISHED  (public, immutable)
    ↓  start_resource_revision()
vN+1 DRAFT ── upload files for that version only
    ↓  submit_resource_revision()
vN+1 PENDING_REVIEW
    ↓  Site Admin at /admin/versions/[versionId] → review_resource_revision()
    ├── APPROVED          → vN+1 PUBLISHED (latest by version_number); vN stays PUBLISHED
    ├── CHANGES_REQUESTED → vN+1 DRAFT; vN stays public
    └── REJECTED          → vN+1 ARCHIVED; vN stays public

The resource row stays PUBLISHED. There is no current_version_id flag;
latest is the highest published version_number.
```

### Where the rules live

| Layer | Responsibility |
| --- | --- |
| `lib/resources/transitions.ts` | UI mirror of the state machine; unit-tested, not a security boundary |
| Server Actions (`lib/resources/actions.ts`, `lib/admin/review-actions.ts`, `lib/versioning/actions.ts`) | Re-check the session, parse with Zod, call the RPCs |
| RLS | Who may read/write which row in which status |
| `resources_enforce_status_transition` | Which transitions exist, and server-derived timestamps |
| `submit_resource_for_review` / `review_resource` | Full publication validation, atomic decision + history |

The trigger and RPCs are authoritative. Everything above them is convenience.

First-publish decisions append one `resource_reviews` row (`reviewer_id` from `auth.uid()`, decision, optional message, timestamp). That table is the audit log. Notes are visible to the contributor and Site Admins, never on a public resource page. Email notifications are not sent.

### Routes

| Route | Who |
| --- | --- |
| `/submit` | Verified user; guests redirect to login, unverified see a verification prompt |
| `/dashboard` | Signed-in workspace; guests redirect to login |
| `/dashboard/resources` | Own resources, paginated; `/my/resources` redirects here |
| `/my/resources/[id]/edit` | Addressed by UUID, gated by `can_manage_resource()` |
| `/admin` | Site Admin overview (counts) and existing tools; guests redirect to login, others to `/forbidden` |
| `/admin/categories` | Site Admin category tree manager |
| `/admin/resources` | Site Admin first-publish queue: Pending, Approved, Rejected, Changes requested |
| `/admin/resources/[id]` | Site Admin first-publish decision page (preview + `review_resource`) |
| `/admin/versions` | Site Admin later-version queue: Pending, Published, Rejected, Changes requested |
| `/admin/versions/[versionId]` | Site Admin version decision page (submitted preview + `review_resource_revision`) |
| `/admin/review` | Redirects to `/admin/versions` |
| `/admin/review/[resourceId]` | Redirects to resource or version moderation |
| `/api/resource-files/[fileId]` | Private signed URL for the manager or a reviewer |
| `/api/maintenance/orphan-uploads` | Site Admin session or `CRON_SECRET`; sweeps unreferenced uploads |
| `/upload` | Permanent redirect to `/submit` (one contribution flow, not two) |

### File uploads

```text
create_upload_intent()   database: authorize, check every quota, build the key,
                                   record a 15-minute single-object reservation
        ↓
browser transport (independent of bucket):
   ≤ 6 MiB ordinary files → standard Storage upload
   > 6 MiB, or any Tutorial MP4/WebM → TUS resumable upload
        ↓
Storage INSERT policy: can_edit_resource AND has_open_upload_intent(bucket, name)
        ↓
complete_upload_intent() database: read the real size from storage.objects
                                   in the intent's bucket, insert resource_files,
                                   burn the reservation
```

**Storage class and upload transport are independent:**

| Example | Bucket | Transport |
| --- | --- | --- |
| CAD 80 MB STEP | `resource-files` | TUS |
| TUTORIAL 500 MB MP4 | `tutorial-videos` | TUS |
| TUTORIAL 2 MB PDF | `resource-files` | Standard |

Bytes never pass through the Next.js server, and the browser never chooses a path or a bucket — `create_upload_intent()` has no path or bucket parameter. Tutorial MP4/WebM files land in private `tutorial-videos`; everything else lands in private `resource-files`. Keys are `<resource-id>/<version-id>/<file-id>_<safe-filename>` so `storage_first_folder_uuid()` can resolve the owning resource.

TUS uses `tus-js-client` against `${SUPABASE_URL}` (cloud hosts rewritten to `{ref}.storage.supabase.co`), 6 MiB chunks as required by Supabase Storage, the user's access token (refreshed if needed), retry delays `0 / 1s / 3s / 5s / 10s`, and a local fingerprint scoped to `user + bucket + path`. Completed uploads drop that fingerprint. The global intent TTL stays 15 minutes; `touch_upload_intent()` only slides expiry for a still-live PENDING intent during an active transfer, and the client stores the **database** `expires_at` returned by that call (it does not compute a local TTL).

Resume is supported for a **network interruption during the same browser session** while the Upload Intent is still PENDING. Closing the tab, a full page refresh, or switching accounts is **not** guaranteed to recover the transfer — TUS localStorage may still hold a fingerprint, but the UI does not restore an in-flight job after a restart.

Application video limits (1 GB per Tutorial video) are independent of Storage infrastructure. Both of these must also allow the object:

- project **Global File Size Limit** (hosted: Dashboard; local: `supabase/config.toml` `[storage] file_size_limit`, 1GiB)
- bucket `file_size_limit` (`tutorial-videos` = 1 GB, `resource-files` = 100 MB)

Raising the Storage ceiling does not raise application quotas.

The reservation is what makes this safe rather than merely tidy. `can_edit_resource()` alone would authorize *any* key under a resource the caller can edit, which is directory-wide write access in exchange for owning one draft. Requiring a matching reservation narrows it to one server-chosen key in one server-chosen bucket, once, for fifteen minutes.

Quota checks serialize on the caller and the target resource (`upload_lock_quota()`: advisory transaction locks plus `FOR UPDATE` on `profiles` and `resources`) so concurrent `create_upload_intent()` / `complete_upload_intent()` calls cannot oversubscribe. Cancel and complete lock the intent row. An existing Storage object continues to consume quota after the intent is `EXPIRED` or until it is actually deleted; `cancel_upload_intent()` refuses while the object is still present.

`lib/resources/actions.ts` is a thin wrapper: it produces friendlier errors and revalidates caches, but every check it performs is repeated in SQL. The service role is used only for signing download URLs and for the orphan sweep, never for uploads or moderation writes.

Large Tutorial videos create Storage and bandwidth cost. Future architecture may accept YouTube / Bilibili (or similar) URLs or derived streaming versions; that is not implemented here. Uploaded originals remain private files.

### Upload quotas and orphans

Quotas are a `BEFORE INSERT` trigger on `resources` (10 active submissions, 20 created per hour) plus checks inside `create_upload_intent()` and `complete_upload_intent()` (files per resource, bytes per resource including Tutorial video sub-quota, bytes per user, open reservations per user and per resource). Held bytes count leftover unregistered objects plus live reservations, never both for the same object. The numbers live in `lib/config/uploads.ts` and are mirrored by `public.upload_limit()`, with a test asserting the two agree. SQL is authoritative.

Storage objects are not Postgres rows, so nothing can delete them transactionally. `public.orphan_upload_objects()` decides which keys are eligible — wrong bucket, wrong shape, younger than 24 hours, referenced by a file, or covered by a live reservation all disqualify a key — and `lib/admin/storage-actions.ts` deletes them through the Storage API from `resource-files` and `tutorial-videos` only. It runs from the `/admin` card or from `POST /api/maintenance/orphan-uploads` on a schedule.

### Published immutability

`can_edit_resource()` still returns false for `PUBLISHED`, so catalog metadata, tags, and published files stay locked. A new version is a `resource_versions` row in `DRAFT`; Storage writes use `can_edit_version()` on that version UUID in the object key. Approving a revision does not call `review_resource` and does not unpublish the resource.

## Phase 8.2.1 — public SEO

`NEXT_PUBLIC_SITE_URL` is the canonical origin (`lib/seo/site-url.ts`). Root metadata uses `FTC Open Library` and `%s | FTC Open Library`. Public pages add canonical URLs and Open Graph. Resource `generateMetadata` uses `getPublicResourceSeo()` (`PUBLISHED` + `PUBLIC` only, no files or versions) and calls `notFound()` for unpublished or missing slugs so a private title never reaches `<title>`. Explore query strings are `noindex` with canonical `/explore`. `?version=` canonicalizes to `/resources/[slug]`. `app/sitemap.ts` and `app/robots.ts` cover public URLs only. Private layouts set `robots: noindex`. Structured data is optional `CreativeWork` JSON-LD with real name/description/url/author/dates — no ratings, offers, or download counts.

If the catalog grows past a few thousand published rows, split the sitemap by type. The current 5,000-row cap per list is enough for Beta.

## Phase 8.2.2 — public UI polish

Empty catalog and search results use honest copy, not placeholders. Missing or unpublished resources share a generic not-found page (Home + Explore). Preview failures stay on the resource page with one retry. Public Discussion remains off unless `NEXT_PUBLIC_DISCUSSION_ENABLED=true`. A small **Beta** badge sits next to the site name.

## Out of scope until later phases

| Phase | Deliverable                                       |
| ----- | ------------------------------------------------- |
| 8     | Ratings, collections                               |
| Later | Admin user management, discussion queue, settings, analytics |
| Later | Email notifications for review decisions           |
| Later | Full profile editor and team management from `/dashboard` |
| Later | Git-like diffs, CAD geometry comparison, branching |
| Later | Admin-chosen preview file / server mesh thumbnail  |
| Later | STEP / IGES / native CAD viewers and conversion    |
| Later | Draco / external-buffer glTF / animation playback  |
| Later | Tutorial video playback, transcoding, HLS/DASH, external hosted video |
| Later | Isolated MODEL execution                           |

Three.js ships only through the CAD/MODEL preview client bundle (dynamic import, visible-section load). Explore, Home, profile, and team pages must not import it.

## Known limitations

- Applying migrations still requires Docker (`npx supabase start` / `db reset`) or a hosted project (`db push`).
- `types/database.ts` is hand-written until `supabase gen types` can run against a live database.
- Phase 1 seed creates **database metadata only**. Tiny sample files in `supabase/seed/assets/` are not uploaded to Storage.
- Public search covers title and description, not tag names (use the tag filter).
- Most-downloaded / most-rated consider at most 500 matches.
- No automated RLS test suite yet. Auth helpers, the state machine, the upload policy, storage-path construction, and the moderation and upload SQL are unit-tested; live policy behaviour still needs `npx supabase db reset` or a hosted project.
- Storage cleanup is best-effort at the moment of failure, and swept afterwards. The sweep is not automatic until a schedule is configured (`docs/deployment-hardening.md`).
- Application quotas are not distributed rate limiting. They cap one account, not many.
- One open revision at a time (`DRAFT` or `PENDING_REVIEW`). Older published versions remain downloadable; there is no file/CAD/code diff.
- Interactive CAD/MODEL preview is GLB, glTF, STL, OBJ, and 3MF up to 25 MB. STEP/IGES/native CAD, Draco GLB, and glTF with external buffers stay download-only.
