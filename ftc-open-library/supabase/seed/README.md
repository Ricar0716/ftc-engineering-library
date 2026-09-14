# Seed data

All seed content is **fictional development data**. It does not represent real FTC teams or copyrighted designs.

## What the SQL seeds

Phase 1 seed creates **metadata only**. It does **not** upload objects into Storage.

- Catalog rows: seasons, **development-only** categories, tags, hardware, licenses
- Category seed names (Intake, TeleOp, Vision, and similar) are local fixtures only. The UI loads categories from the database and works with an empty `categories` table. No MODEL category seeds.
- 6 local auth users (`@example.test`, password `dev-only-password`)
- 5 fictional teams (`10001`–`10005`)
- 25 published resources, 1 draft (`secret-intake-sketch`), 1 archived resource
- No ALGORITHM or MODEL seed rows. ALGORITHM was removed as a type; MODEL exists as a type with empty listings until real content is uploaded.
- Version/file **metadata**, a few tags, relations, ratings, favorites, and comments

`storage_path` values are strings for later upload/download phases. They are not proof that a bucket object exists.

## Sample files

Tiny legally safe files live in `assets/` as git fixtures (not inserted by SQL):

- `sample.stl` — placeholder CAD preview
- `ExampleTeleOp.java` — placeholder source

Do not commit large CAD binaries. After you have a Supabase project, optionally upload originals to `resource-files` using the seeded paths if you want Phase 4 downloads to resolve. Preview objects belong in `resource-previews` / `resource-thumbnails` with the resource UUID as the first folder.

## Apply seed

Local CLI:

```bash
npx supabase db reset
```

That runs `supabase/seed.sql`, which includes the files in this directory.

Manual:

```bash
psql "$DATABASE_URL" -f supabase/seed/01_reference.sql
psql "$DATABASE_URL" -f supabase/seed/02_identities.sql
psql "$DATABASE_URL" -f supabase/seed/03_resources.sql
psql "$DATABASE_URL" -f supabase/seed/04_files_and_social.sql
```

`02_identities.sql` inserts into `auth.users` and is intended for local/dev GoTrue, not production.
