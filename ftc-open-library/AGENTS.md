<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# FTC Open Library — agent notes

Resource Types are stable: `CAD | CODE | TUTORIAL | MODEL`. Do not reintroduce `ALGORITHM`, standalone `/tools`, or a built-in projectile calculator.

Categories are loaded from the database (`categories.parent_id` trees). Do not hardcode category names in TypeScript enums, arrays, routes, or UI. Zero categories is valid. Tags are not categories.

`resources.category_id` is the nullable primary category. Site Admins manage the tree at `/admin/categories`. Do not change `resource_type` after a category is created.

Auth: Guest / Verified User / Site Admin (verified + `site_admins` row). Do not hardcode admin emails. Do not confuse Team OWNER with Site Admin. Downloads require a verified session and a server-issued signed URL. Published resource rows are immutable to normal users; later file changes go through a reviewed `resource_versions` row (`DRAFT` → `PENDING_REVIEW` → `PUBLISHED`). Do not unpublish a live resource to accept a revision.

Published CAD and MODEL meshes (GLB/glTF/STL/OBJ/3MF), source, and images may be previewed in-browser through `/api/previews/[fileId]` using the same authorization as downloads (inline signed URL, never a public Storage URL). Site Admins and resource managers may also preview unpublished files, including a pending revision of a published resource, on `/admin/resources/[id]` and `/admin/versions/[versionId]` through that same route. CAD and MODEL share `components/viewer/ModelViewer` (Three.js, visualization only — no CAD editing, no STEP/IGES viewers). Do not execute uploaded code or models. Syntax highlighting must escape. Do not Markdown-to-HTML render untrusted files. Tutorial video stays a private download — do not add HTML5 playback, transcoding, or streaming without being asked.

Favorites use `public.favorites` (unique `user_id, resource_id`). Only verified users may save **published public** resources. Do not expose unpublished favorites. Do not add collections, ratings, or followers unless asked.

The signed-in workspace is `/dashboard`. Queries filter by the session user (`author_id` / `user_id`); do not load the whole catalog and filter in the client. Guests redirect to login. Do not add a profile editor, team management, notifications, reputation, or analytics unless asked. `/my/resources` redirects to `/dashboard/resources`; keep `/my/resources/[id]/edit` for drafts and revisions. Do not show reviewer notes on dashboard lists.

`/admin` is the Site Admin overview (aggregated counts only). Guests go to login; verified non-admins go to `/forbidden`. `/admin/resources` is first-publish moderation (`review_resource`). `/admin/versions` is later-version moderation (`review_resource_revision`). Keep `/admin/review` as a redirect to those queues. Keep `/admin/categories` as the existing taxonomy tool. Do not add user management, discussion moderation queues, featured resources, analytics, or settings unless asked.

Engineering discussion uses `public.comments` (`parent_id` for one-level replies, status `VISIBLE | HIDDEN | DELETED`). The UI calls this Discussion, not Comments. Public Discussion is off for the initial Beta unless `NEXT_PUBLIC_DISCUSSION_ENABLED=true`. Do not delete discussion tables or tests. Guests may read VISIBLE posts on published public resources when the flag is on. Only verified users may post or reply. Authors may edit their own VISIBLE body. Site Admins hide/restore on the resource page — do not add a separate discussion dashboard, likes, reactions, or notifications unless asked.

Resource statuses are `DRAFT | PENDING_REVIEW | CHANGES_REQUESTED | PUBLISHED | REJECTED | ARCHIVED`. Contributors may only edit `DRAFT` and `CHANGES_REQUESTED` **resource rows** — that set is defined once, in `public.resource_is_editable()`, and reaches first-publish child tables through `can_edit_resource()`. Version status is `DRAFT | PENDING_REVIEW | PUBLISHED | ARCHIVED` on `resource_versions` and is not a second resource machine. File writes for a published resource use `can_edit_version()` on a DRAFT version only. Do not let a contributor set `resources.status` to `PUBLISHED`; first publish uses `submit_resource_for_review()` / `review_resource()`, and later versions use `start_resource_revision()` / `submit_resource_revision()` / `review_resource_revision()`. Moderation timestamps and `reviewer_id` are server-derived, never accepted from a client. Version review uses `resource_versions.created_by` and `submitted_at`, not `resources.author_id` or version `created_at`. Review history in `resource_reviews` is append-only (`version_id` is set for revision reviews). Do not hard-delete a version that has review rows.

Upload rules (sizes, counts, quotas, allowed and blocked extensions, filename sanitizing) are declared in `lib/config/uploads.ts` and enforced in SQL by `public.upload_limit()` and the `upload_allowed_extension` / `upload_blocked_extension` tables. Change both or `lib/config/upload-policy.test.ts` will fail. Never make `resource-files` or `tutorial-videos` public. Uploaded content is data: do not execute it.

Storage writes are reservation-gated. `can_edit_resource()` alone must never authorize a write to `resource-files` or `tutorial-videos` — the INSERT/UPDATE policies also require `has_open_upload_intent(bucket, name)`, so owning a draft does not grant directory-wide access. The server chooses the bucket (TUTORIAL + mp4/webm → `tutorial-videos`, else `resource-files`); the client must not supply a bucket or path. Keys are `<resource-id>/<version-id>/<file-id>_<safe-filename>` and are built by `create_upload_intent()`, which takes no path argument. Registration goes through `complete_upload_intent()`, which reads the true size from `storage.objects` in the intent's bucket. Quota accounting includes leftover unregistered objects; `CANCELLED` / `EXPIRED` are not equivalent to deleted. Orphan eligibility is decided only by `public.orphan_upload_objects()`.

Large files use TUS (`tus-js-client`) as transport only: Upload Intent still authorizes the exact key. Do not proxy file bytes through Next.js.

Deferred on purpose: git-like diffs / CAD geometry comparison / branching / merging / forks / pull requests, email notifications, MODEL execution, video playback/transcoding/external hosting, ratings, collections, in-dashboard profile editor, team management, notifications, and analytics. Do not build them without being asked.
