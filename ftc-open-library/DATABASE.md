# Database

PostgreSQL schema for FTC Open Library. Apply files in `supabase/migrations/` in timestamp order, then seed from `supabase/seed.sql`.

## Search

`resources.search_vector` is a stored generated `tsvector` over `title` (weight A) and `description` (weight B), indexed with GIN.

Tag, category, team, hardware, season, and license filters are ordinary foreign-key / join predicates, not full-text search.

Query example:

```sql
SELECT *
FROM public.resources
WHERE status = 'PUBLISHED'
  AND visibility = 'PUBLIC'
  AND search_vector @@ websearch_to_tsquery('english', 'horizontal intake');
```

## Tables

| Table                | Purpose                                     |
| -------------------- | ------------------------------------------- |
| `profiles`           | Public profile keyed by `auth.users.id`     |
| `site_admins`        | Site Admin membership (`user_id` PK)        |
| `teams`              | Team directory (`team_number` is text)      |
| `team_members`       | Membership and `OWNER` / `ADMIN` / `MEMBER` |
| `seasons`            | Normalized season labels                    |
| `categories`         | Hierarchical taxonomy per Resource Type     |
| `tags`               | Normalized tags                             |
| `hardware`           | Vendors / fabrication methods               |
| `licenses`           | SPDX plus `CUSTOM`                          |
| `resources`          | Central object                              |
| `resource_versions`  | Version history                             |
| `resource_files`     | File metadata; bytes in Storage             |
| `resource_tags`      | Resource ↔ tag                              |
| `resource_hardware`  | Resource ↔ hardware                         |
| `resource_relations` | `RELATED` / `USES` / `BASED_ON`             |
| `resource_reviews`   | Moderation decision history (append-only)   |
| `resource_upload_intents` | Single-object upload reservations      |
| `upload_allowed_extension` / `upload_blocked_extension` | File type policy |
| `favorites`          | Per-user favorites                          |
| `ratings`            | 1–5, one row per user/resource              |
| `comments`           | Engineering discussion (`parent_id` replies; `VISIBLE` / `HIDDEN` / `DELETED`) |
| `downloads`          | Per-user download events                    |

`resource_stats` is a view of aggregates for **published public** resources only.

## Integrity (Phase 1 hardening)

- `resource_files (version_id, resource_id)` references `resource_versions (id, resource_id)` so a file cannot attach to another resource’s version.
- `downloads (file_id, resource_id)` references `resource_files (id, resource_id)` so a download event cannot cite a file from a different resource.
- `author_id` is frozen on update. Comment `user_id` / `resource_id` / `parent_id` and rating `user_id` / `resource_id` are frozen on update.
- Category `resource_type` must match the resource type when `category_id` is set.

## Resource status and moderation

`resources.status` is `DRAFT | PENDING_REVIEW | CHANGES_REQUESTED | PUBLISHED | REJECTED | ARCHIVED`. There is no second status system; `visibility` (`PUBLIC` / `UNLISTED`) is unchanged and orthogonal.

| Column                   | Written by                                                  |
| ------------------------ | ----------------------------------------------------------- |
| `submitted_at`           | Trigger, on entering `PENDING_REVIEW`; cleared on withdrawal |
| `reviewed_at`            | Trigger, on any review decision                              |
| `published_at`           | Trigger, on first publish; preserved across archive/restore  |
| `rights_acknowledged_at` | `submit_resource_for_review()`                               |

A client cannot set these: `resources_enforce_status_transition` copies the OLD values over whatever was submitted and then derives the new ones. `resources_review_queue_idx` is a partial index on `submitted_at WHERE status = 'PENDING_REVIEW'`.

`resource_reviews`:

| Column        | Notes                                                     |
| ------------- | --------------------------------------------------------- |
| `resource_id` | FK, `ON DELETE CASCADE`                                    |
| `reviewer_id` | FK to `profiles`, `ON DELETE SET NULL`; from `auth.uid()`  |
| `decision`    | `APPROVED` / `CHANGES_REQUESTED` / `REJECTED`              |
| `message`     | Required (≥ 10 chars) unless the decision is `APPROVED`; ≤ 2000 |
| `created_at`  | Timestamp                                                  |

History is append-only in practice: `authenticated` has `SELECT` only, and rows are inserted exclusively by `review_resource()` (first publish, `version_id` null) and `review_resource_revision()` (later versions, `version_id` set). Nothing overwrites a previous decision.

Moderation functions (all `SECURITY DEFINER`, `search_path = pg_catalog, public`, `REVOKE ALL ... FROM PUBLIC`, `GRANT EXECUTE ... TO authenticated`):

| Function | Caller | Effect |
| --- | --- | --- |
| `submit_resource_for_review(id, rights_acknowledged)` | Verified manager | Validates title, description, license, category, and ≥ 1 file, then `→ PENDING_REVIEW` |
| `withdraw_resource_submission(id)` | Verified manager | `PENDING_REVIEW → DRAFT` |
| `review_resource(id, decision, message)` | Site Admin | Re-validates on approval, sets the status, and appends the history row in one transaction |
| `set_resource_archived(id, archived)` | Site Admin | `PUBLISHED ↔ ARCHIVED` |
| `start_resource_revision(id, label, changelog)` | Verified manager | Inserts the next version as `DRAFT` on a `PUBLISHED` resource |
| `submit_resource_revision(version_id)` | Verified manager | DRAFT version `> 1` with changelog + files → `PENDING_REVIEW`; `submitted_at = now()` |
| `withdraw_resource_revision(version_id)` | Verified manager | Revision `PENDING_REVIEW → DRAFT` |
| `review_resource_revision(version_id, decision, message)` | Site Admin | Approves (version `PUBLISHED`, becomes latest by `version_number`), requests changes (version back to `DRAFT`), or rejects (version `ARCHIVED`); the resource stays `PUBLISHED` and older published versions stay published |

A category is required at submission only when the resource type has at least one active category, so a type with an empty taxonomy still accepts submissions. When a category is set it must be active and of the same resource type.

`resource_versions.status` is `DRAFT | PENDING_REVIEW | PUBLISHED | ARCHIVED`. `released_at` is required exactly when the version is `PUBLISHED`. `created_at` is draft creation. `submitted_at` is the most recent `submit_resource_revision()` time (`NULL` until the version enters `PENDING_REVIEW`; resubmission after Request Changes refreshes it). Clients cannot write `submitted_at` (`GRANT UPDATE` is only `version_label, changelog`; a trigger stamps `now()` on `DRAFT → PENDING_REVIEW`). Legacy rows: earliest version-specific `resource_reviews.created_at` if present, else `created_at` for versions that already left an unsubmitted draft, else `NULL`. Public SELECT is published versions of published-public resources. One open (`DRAFT`/`PENDING_REVIEW`) version per resource. `resource_reviews.version_id` is set for revision decisions and stays NULL for first-publish reviews. A version with any version-specific review row cannot be hard-deleted (`can_delete_version()` plus a `BEFORE DELETE` trigger); never-reviewed later DRAFT versions may still be deleted. Migration `20260909200000_resource_versioning.sql` backfills status; `20260910090000_version_review_hardening.sql` adds `submitted_at` and deletion protection. Files are not duplicated.

## Uploads

`resource_upload_intents` is a reservation: one row authorizes one Storage key in one bucket, for one user, for `upload_limit('upload_intent_ttl_seconds')` (15 minutes).

| Column | Notes |
| --- | --- |
| `user_id` | From `auth.uid()` inside `create_upload_intent()` |
| `resource_id` / `version_id` | Composite FK to `resource_versions (id, resource_id)` |
| `storage_bucket` | `resource-files` or `tutorial-videos`. Chosen by the database from resource type + extension; there is no bucket parameter |
| `storage_path` | Unique per `(storage_bucket, storage_path)`. Built by the database; there is no path parameter |
| `expected_size_bytes` | `> 0` and `<= 1 GB` (Tutorial video ceiling); ordinary files are capped lower by `upload_limit` |
| `status` | `PENDING` / `COMPLETED` / `CANCELLED` / `EXPIRED` |
| `expires_at` | `PENDING` rows past this become `EXPIRED` via `expire_stale_upload_intents()`. Expiry does **not** drop leftover object bytes from quota |

`resource_files.storage_bucket` defaults to `resource-files` for existing rows. Unique on `(storage_bucket, storage_path)`. Only those two bucket names are allowed.

`authenticated` has `SELECT` only, limited to its own rows or any row for a Site Admin. There is no INSERT/UPDATE/DELETE policy and no such grant, so intent rows exist only through the `SECURITY DEFINER` functions.

Quota is counted once per object by `upload_intent_held_bytes()`: actual Storage size if the object exists and the intent is not `COMPLETED`; otherwise the expected size while `PENDING` and unexpired; otherwise 0. `upload_lock_quota(resource_id)` serializes create/complete/cancel on the caller and the resource.

| Function | Purpose |
| --- | --- |
| `upload_limit(key)` | Numeric policy, mirrored by `lib/config/uploads.ts` |
| `upload_safe_filename(name)` / `upload_extension(name)` | SQL equivalents of the TS helpers |
| `has_open_upload_intent(bucket, name)` | Used by Storage INSERT/UPDATE policies on both resource buckets |
| `upload_lock_quota(resource_id)` | Advisory + `FOR UPDATE` serialization for quota mutations |
| `create_upload_intent(resource, filename, size, mime)` | Validates, chooses bucket, reserves; returns bucket, key, and expiry |
| `complete_upload_intent(path, file_type, mime)` | Verifies the **intent's** bucket+path, reads real size, inserts the file, burns the reservation |
| `cancel_upload_intent(path)` | `PENDING`/`EXPIRED` with no object → `CANCELLED`. Object still present → `ftc:object_still_present` (quota stays) |
| `expire_stale_upload_intents()` | `PENDING` past `expires_at` → `EXPIRED` |
| `touch_upload_intent(path)` | Slides `expires_at` forward for a still-PENDING, still-unexpired intent owned by the caller. Returns the new database `expires_at`. Does not change bucket or path. Used during long TUS transfers. |

Local `supabase/config.toml` `[storage] file_size_limit = "1GiB"` is the CLI **project** object ceiling so a 1 GB Tutorial video can be stored locally. It is not an application quota. Hosted projects need the Dashboard Global File Size Limit ≥ 1 GB as well as the `tutorial-videos` / `resource-files` bucket limits.
| `orphan_upload_objects(limit)` | Eligible unreferenced objects in `resource-files` and `tutorial-videos` |
| `upload_hygiene_summary()` | Counts for the `/admin` card, including leftover objects |

`upload_allowed_extension` and `upload_blocked_extension` hold the type policy as data so the check runs in the database. Both are readable by anyone and writable by no one except a migration or the service role.

`resources_enforce_creation_quota` is a `BEFORE INSERT` trigger: at most `max_active_resources_per_user` non-final resources and `max_resources_created_per_hour` creations per author. Site Admins and JWT-less contexts are exempt.

## Extra columns (documented)

- `resources.parent_resource_id` — reserved for future forks
- `comments.status` — `VISIBLE` (public), `HIDDEN` (Site Admin hide, restorable), `DELETED` (reserved)
- `comments.parent_id` — one-level reply to a root post on the same resource
- `resources.search_vector` — generated FTS column

Team URLs use `team_number` as the slug in the domain mapper (`/teams/10001`).

`resources.resource_type` and `categories.resource_type` are `CAD | CODE | TUTORIAL | MODEL`. Baseline migrations still create an `ALGORITHM` CHECK; `20260906120000_resource_type_algorithm_to_model.sql` replaces it. MODEL is a Resource type, not a separate table. Do not seed MODEL categories or MODEL resources in this step.

## Auth identity

```text
auth.users
    ↓
profiles          (public username / bio; no passwords)

auth.users
    ↓
site_admins       (Site Admin UUID membership only)
```

`site_admins.user_id` references `auth.users(id)` and is the only Site Admin signal. Email is not used in application authorization.

Helper functions (`SECURITY DEFINER`, `search_path = pg_catalog, public`, execute granted, no table dumps):

| Function            | Meaning                                              |
| ------------------- | ---------------------------------------------------- |
| `is_verified_user()` | `auth.uid()` has `auth.users.email_confirmed_at`    |
| `is_site_admin()`    | verified email **and** `auth.uid()` in `public.site_admins` |
| `resource_is_draft(id)` | resource `status = 'DRAFT'` (kept from STEP 3.1) |
| `resource_is_editable(id)` | resource `status IN ('DRAFT', 'CHANGES_REQUESTED')` |
| `can_edit_resource(id)` | verified Site Admin, or verified owner/team-admin of an **editable** resource |
| `can_edit_version(id)` | verified manager/admin of a version whose `status = 'DRAFT'` |
| `version_is_published_public(id)` | version `PUBLISHED` and parent `resource_is_published_public` |
| `can_upload_to_resource(id)` | `can_edit_resource` **or** an open DRAFT version the caller can edit |
| `upload_target_version_id(id)` | the DRAFT version files will attach to |
| `can_write_storage_object(name)` | `can_edit_resource(first folder)` **or** `can_edit_version(second folder)` |
| `category_resource_count(id)` | Site Admin only; count of `resources.category_id` including drafts |

RLS on `site_admins`: enabled. `SELECT` for authenticated rows only when `is_site_admin()` is true. **No INSERT/UPDATE/DELETE policies** — clients cannot self-promote. Bootstrap is trusted SQL (`docs/admin-bootstrap.md`).

`resources` INSERT for authenticated users requires `is_verified_user()` and `status = 'DRAFT'` (unless already a Site Admin). Trigger `resources_prevent_self_publish` blocks non-admin publishes when `auth.uid()` is set. Seed/service-role (`auth.uid()` null) is unchanged.

Contributors may write child rows only while the parent resource is editable, **or** while they can edit a `DRAFT` version (`can_edit_version()`). `can_edit_resource()` remains the gate for resource metadata, tags, hardware, relations, and first-publish files. STEP 7.3 added version status so a published resource can receive a new DRAFT version without changing `resources.status`.

Once `resources.status` is `PENDING_REVIEW`, `PUBLISHED`, `REJECTED`, or `ARCHIVED`, normal authors cannot UPDATE the resource row. Published version files stay immutable. New files attach only to a DRAFT version created by `start_resource_revision()`. `resources_update` additionally allows a `PENDING_REVIEW` row through only so the trigger can accept a withdrawal, and the trigger rejects the update if any content column changed.

Site Admins may `SELECT` submissions and their child rows for moderation; `resources_delete` allows admins to remove anything except a `PUBLISHED` resource, and contributors only `DRAFT` / `CHANGES_REQUESTED`.

`downloads` INSERT requires `is_verified_user()` plus a matching `resource_files` row.

Original Storage objects in `resource-files` and `tutorial-videos` are not readable by the public or by generic authenticated users. Verified managers of a resource may SELECT their own originals. Everyone else uses signed URLs from the server, which resolve the bucket from `resource_files.storage_bucket`.

## Category taxonomy

`categories` is a single recursive table. There are no `subcategory` columns.

| Column          | Role                                                                 |
| --------------- | -------------------------------------------------------------------- |
| `id`            | Stable UUID                                                          |
| `name`          | Display label                                                        |
| `slug`          | URL-safe token; unique among **siblings** of the same Resource Type  |
| `resource_type` | `CAD` / `CODE` / `TUTORIAL` / `MODEL`                                |
| `parent_id`     | Nullable self-FK. `ON DELETE SET NULL` (orphans become roots)        |
| `description`   | Optional                                                             |
| `sort_order`    | Admin-controlled order; UI falls back to name                        |
| `is_active`     | Archive without delete. Public trees hide inactive rows              |
| `created_at` / `updated_at` | Timestamps. `updated_at` via `set_updated_at()`            |

Uniqueness (PostgreSQL partial unique indexes):

- Root: `(resource_type, slug) WHERE parent_id IS NULL`
- Nested: `(resource_type, parent_id, slug) WHERE parent_id IS NOT NULL`

So `CAD > Control` and `CODE > Control`, or two `Roller` nodes under different CAD parents, are allowed.

Hierarchy trigger `categories_validate_hierarchy`:

- A category cannot be its own parent (also a CHECK constraint)
- Child `resource_type` must match parent
- Parent must exist
- Ancestor walk rejects cycles (depth cap 64)
- `resource_type` cannot change after insert

Hard-delete trigger `categories_prevent_unsafe_delete` (SECURITY DEFINER, so it sees draft resources):

- Rejects delete when any child has `parent_id` = this id
- Rejects delete when any resource has `category_id` = this id

`resources.category_id` is the **primary** category. It is nullable. `ON DELETE SET NULL` — deleting a category never cascade-deletes resources. Prefer `is_active = false` to archive. Application and the delete trigger refuse unsafe deletes before that FK would fire. Trigger `resources_category_matches_type` still requires the primary category’s type to match the resource.

Category writes: `categories_insert` / `categories_update` / `categories_delete` require `is_site_admin()`. SELECT remains public. Authenticated GRANT includes INSERT/UPDATE/DELETE; RLS still denies non-admins.

Public listing loads category rows for one Resource Type, then `buildCategoryTree` / `getCategoryDescendants` in `lib/categories/tree.ts`. Do not query one row per tree node. Site Admins edit the same rows at `/admin/categories`.

Future multi-category assignment may add `resource_category_links (resource_id, category_id)` without removing `resources.category_id`. Indexes from `20260906210000_category_taxonomy.sql` remain: `(resource_type, is_active)`, `(parent_id, sort_order, name)`, plus the sibling slug unique indexes.

Seed category names are development-only. Production may have zero categories. The admin UI must work with an empty table.
