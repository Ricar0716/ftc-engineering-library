-- STEP 5.1: upload abuse hardening.
--
-- Before this migration, owning a single DRAFT granted `INSERT` on every object
-- key under `<resource-id>/...` in the private `resource-files` bucket. A
-- verified user who skipped the application entirely and called the Storage API
-- with their own session could write unlimited objects of any name and type, up
-- to the bucket's 250 MB per-object ceiling, and none of them needed a
-- `resource_files` row.
--
-- The fix is to make Storage writes require a server-issued, single-object,
-- short-lived reservation. Everything else here supports that: quotas that count
-- reservations, a creation brake on drafts, and orphan detection for objects
-- that are uploaded but never registered.
--
-- STEP 5 moderation, STEP 3.1 published immutability, and the signed-download
-- architecture are untouched.

-- ---------------------------------------------------------------------------
-- 1. Numeric policy
--
-- Mirrored by `uploadLimits` in `lib/config/uploads.ts`; the parity test in
-- `lib/config/upload-policy.test.ts` fails if they diverge.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upload_limit(p_key text)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_key
    WHEN 'max_file_bytes'                 THEN 104857600
    WHEN 'max_files_per_resource'         THEN 20
    WHEN 'max_filename_length'            THEN 120
    WHEN 'total_bytes_CAD'                THEN 262144000
    WHEN 'total_bytes_CODE'               THEN 26214400
    WHEN 'total_bytes_TUTORIAL'           THEN 104857600
    WHEN 'total_bytes_MODEL'              THEN 104857600
    WHEN 'active_storage_bytes_per_user'  THEN 524288000
    WHEN 'max_active_resources_per_user'  THEN 10
    WHEN 'max_resources_created_per_hour' THEN 20
    WHEN 'max_open_uploads_per_user'      THEN 5
    WHEN 'max_open_uploads_per_resource'  THEN 3
    WHEN 'upload_intent_ttl_seconds'      THEN 900
    WHEN 'orphan_grace_hours'             THEN 24
  END::bigint;
$$;

REVOKE ALL ON FUNCTION public.upload_limit(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upload_limit(text) TO authenticated;

-- Align the bucket ceiling with the application per-file limit. Storage then
-- refuses an oversized object on its own, independent of any check above it.
UPDATE storage.buckets
SET file_size_limit = public.upload_limit('max_file_bytes')
WHERE id = 'resource-files';

-- ---------------------------------------------------------------------------
-- 2. Extension policy
--
-- Data rather than code so the check runs inside the database. No write policy
-- and no write grant exists: only a migration or the service role can change
-- these rows.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.upload_blocked_extension (
  extension text PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.upload_allowed_extension (
  resource_type text NOT NULL,
  extension text NOT NULL,
  PRIMARY KEY (resource_type, extension),
  CONSTRAINT upload_allowed_extension_type_check CHECK (
    resource_type IN ('CAD', 'CODE', 'TUTORIAL', 'MODEL')
  )
);

ALTER TABLE public.upload_blocked_extension ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_allowed_extension ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS upload_blocked_extension_select ON public.upload_blocked_extension;
CREATE POLICY upload_blocked_extension_select ON public.upload_blocked_extension
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS upload_allowed_extension_select ON public.upload_allowed_extension;
CREATE POLICY upload_allowed_extension_select ON public.upload_allowed_extension
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.upload_blocked_extension TO anon, authenticated;
GRANT SELECT ON public.upload_allowed_extension TO anon, authenticated;

-- Formats a browser or operating system may treat as runnable, plus installer
-- packages that have no place in a resource library. Checked before the
-- allowlist, so a type list can never accidentally re-enable one.
INSERT INTO public.upload_blocked_extension (extension) VALUES
  ('apk'), ('app'), ('appimage'), ('bash'), ('bat'), ('cmd'), ('com'), ('cpl'),
  ('deb'), ('dll'), ('dmg'), ('docm'), ('drv'), ('dylib'), ('htm'), ('html'),
  ('jar'), ('jse'), ('lnk'), ('msi'), ('pif'), ('pkg'), ('pptm'), ('ps1'),
  ('psm1'), ('reg'), ('rpm'), ('scr'), ('sh'), ('so'), ('swf'), ('svg'),
  ('sys'), ('vbe'), ('vbs'), ('war'), ('wsf'), ('xhtml'), ('xlsm'), ('zsh'),
  ('exe')
ON CONFLICT DO NOTHING;

-- Shared across every resource type.
INSERT INTO public.upload_allowed_extension (resource_type, extension)
SELECT t.resource_type, e.extension
FROM (VALUES ('CAD'), ('CODE'), ('TUTORIAL'), ('MODEL')) AS t (resource_type)
CROSS JOIN (VALUES
  ('zip'), ('7z'), ('tar'), ('gz'), ('tgz'), ('pdf'), ('md'), ('txt'),
  ('png'), ('jpg'), ('jpeg'), ('webp')
) AS e (extension)
ON CONFLICT DO NOTHING;

INSERT INTO public.upload_allowed_extension (resource_type, extension) VALUES
  ('CAD', 'step'), ('CAD', 'stp'), ('CAD', 'stl'), ('CAD', 'iges'), ('CAD', 'igs'),
  ('CAD', '3mf'), ('CAD', 'obj'), ('CAD', 'dxf'), ('CAD', 'dwg'), ('CAD', 'f3d'),
  ('CAD', 'f3z'), ('CAD', 'sldprt'), ('CAD', 'sldasm'), ('CAD', 'ipt'), ('CAD', 'iam'),
  ('CAD', 'prt'), ('CAD', 'asm'), ('CAD', 'x_t'), ('CAD', 'x_b'), ('CAD', 'scad'),
  ('CAD', 'gcode'),
  ('CODE', 'java'), ('CODE', 'kt'), ('CODE', 'kts'), ('CODE', 'py'), ('CODE', 'c'),
  ('CODE', 'cc'), ('CODE', 'cpp'), ('CODE', 'h'), ('CODE', 'hpp'), ('CODE', 'gradle'),
  ('CODE', 'properties'), ('CODE', 'xml'), ('CODE', 'json'), ('CODE', 'yaml'),
  ('CODE', 'yml'), ('CODE', 'toml'), ('CODE', 'cfg'),
  ('TUTORIAL', 'docx'), ('TUTORIAL', 'pptx'), ('TUTORIAL', 'odt'), ('TUTORIAL', 'csv'),
  ('TUTORIAL', 'json'),
  ('MODEL', 'csv'), ('MODEL', 'json'), ('MODEL', 'ipynb'), ('MODEL', 'xlsx'),
  ('MODEL', 'ods'), ('MODEL', 'py'), ('MODEL', 'm'), ('MODEL', 'dat'), ('MODEL', 'npy')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Filename normalization in SQL
--
-- Same rules as `safeFilename()` / `fileExtension()` in lib/config/uploads.ts,
-- so the key the database builds matches what the app expects to see back.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upload_safe_filename(p_filename text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  base text;
  cleaned text;
BEGIN
  base := btrim(regexp_replace(coalesce(p_filename, ''), '^.*[\\/]', ''));
  IF base IN ('', '.', '..') THEN
    RETURN NULL;
  END IF;

  cleaned := regexp_replace(base, '[^A-Za-z0-9._-]+', '-', 'g');
  cleaned := regexp_replace(cleaned, '-{2,}', '-', 'g');
  cleaned := regexp_replace(cleaned, '^[.-]+', '');
  cleaned := left(cleaned, public.upload_limit('max_filename_length')::int);

  IF cleaned = '' THEN
    RETURN NULL;
  END IF;
  RETURN cleaned;
END;
$$;

CREATE OR REPLACE FUNCTION public.upload_extension(p_filename text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  base text;
  dot int;
BEGIN
  base := regexp_replace(coalesce(p_filename, ''), '^.*[\\/]', '');
  IF position('.' in reverse(base)) = 0 THEN
    RETURN '';
  END IF;

  -- Zero-based index of the last dot, matching the JS implementation.
  dot := length(base) - position('.' in reverse(base));
  IF dot <= 0 OR dot = length(base) - 1 THEN
    RETURN '';
  END IF;

  RETURN lower(substr(base, dot + 2));
END;
$$;

REVOKE ALL ON FUNCTION public.upload_safe_filename(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upload_extension(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upload_safe_filename(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upload_extension(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Upload intents
--
-- One row authorizes exactly one object key, for one user, for a short window.
-- The row is created only by `create_upload_intent()`, which picks the key; a
-- client cannot insert, retarget, or complete one itself.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.resource_upload_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources (id) ON DELETE CASCADE,
  version_id uuid NOT NULL,
  storage_path text NOT NULL UNIQUE,
  original_filename text NOT NULL,
  expected_size_bytes bigint NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT resource_upload_intents_status_check CHECK (
    status IN ('PENDING', 'COMPLETED', 'CANCELLED')
  ),
  CONSTRAINT resource_upload_intents_size_check CHECK (
    expected_size_bytes > 0 AND expected_size_bytes <= 104857600
  ),
  CONSTRAINT resource_upload_intents_completed_check CHECK (
    (status = 'COMPLETED') = (completed_at IS NOT NULL)
  ),
  CONSTRAINT resource_upload_intents_version_fk FOREIGN KEY (version_id, resource_id)
    REFERENCES public.resource_versions (id, resource_id) ON DELETE CASCADE
);

-- Open-intent lookups drive both the Storage policy and every quota check.
CREATE INDEX IF NOT EXISTS resource_upload_intents_open_idx
  ON public.resource_upload_intents (user_id, expires_at)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS resource_upload_intents_resource_idx
  ON public.resource_upload_intents (resource_id, status);

ALTER TABLE public.resource_upload_intents ENABLE ROW LEVEL SECURITY;

-- Read-only to the owner and to Site Admins. There is deliberately no INSERT,
-- UPDATE, or DELETE policy and no such grant: mutation happens only inside the
-- SECURITY DEFINER functions below.
DROP POLICY IF EXISTS resource_upload_intents_select ON public.resource_upload_intents;
CREATE POLICY resource_upload_intents_select ON public.resource_upload_intents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_site_admin());

GRANT SELECT ON public.resource_upload_intents TO authenticated;

-- A registered file is one object; make that a database rule so a retried
-- finalize cannot produce a duplicate row.
CREATE UNIQUE INDEX IF NOT EXISTS resource_files_storage_path_key
  ON public.resource_files (storage_path);

-- ---------------------------------------------------------------------------
-- 5. Narrowed Storage policies
--
-- This is the heart of STEP 5.1. `can_edit_resource()` alone is no longer
-- enough to write an object: the exact key must also have an open reservation
-- belonging to the caller.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_open_upload_intent(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.resource_upload_intents i
    WHERE i.storage_path = p_object_name
      AND i.user_id = auth.uid()
      AND i.status = 'PENDING'
      AND i.expires_at > now()
  );
$$;

REVOKE ALL ON FUNCTION public.has_open_upload_intent(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_open_upload_intent(text) TO authenticated;

-- Replaces the STEP 3.1 `FOR ALL` policy, which covered INSERT, UPDATE, and
-- DELETE with one directory-wide condition.
DROP POLICY IF EXISTS storage_resource_files_write ON storage.objects;

DROP POLICY IF EXISTS storage_resource_files_insert ON storage.objects;
CREATE POLICY storage_resource_files_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'resource-files'
    AND public.is_verified_user()
    AND public.can_edit_resource(public.storage_first_folder_uuid(name))
    AND public.has_open_upload_intent(name)
  );

DROP POLICY IF EXISTS storage_resource_files_update ON storage.objects;
CREATE POLICY storage_resource_files_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'resource-files'
    AND public.is_verified_user()
    AND public.can_edit_resource(public.storage_first_folder_uuid(name))
    AND public.has_open_upload_intent(name)
  )
  WITH CHECK (
    bucket_id = 'resource-files'
    AND public.is_verified_user()
    AND public.can_edit_resource(public.storage_first_folder_uuid(name))
    AND public.has_open_upload_intent(name)
  );

-- Deleting is not an abuse vector and is still needed to remove a file or a
-- draft, so it keeps the editable-resource gate.
DROP POLICY IF EXISTS storage_resource_files_delete ON storage.objects;
CREATE POLICY storage_resource_files_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'resource-files'
    AND public.can_edit_resource(public.storage_first_folder_uuid(name))
  );

-- Preview and thumbnail buckets had the same directory-wide write grant. No
-- contributor flow uploads to them yet, so they become admin-only rather than
-- staying open; a contributor preview flow will need its own reservation.
DROP POLICY IF EXISTS storage_previews_write ON storage.objects;
CREATE POLICY storage_previews_write ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id IN ('resource-previews', 'resource-thumbnails')
    AND public.is_site_admin()
  )
  WITH CHECK (
    bucket_id IN ('resource-previews', 'resource-thumbnails')
    AND public.is_site_admin()
  );

-- ---------------------------------------------------------------------------
-- 6. Resource creation quota
--
-- Applies to the REST API as well as the Server Action, because it is a trigger
-- rather than a check in application code.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resources_enforce_creation_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  active_count bigint;
  recent_count bigint;
BEGIN
  -- Seed, migrations, and service-role clients have no JWT.
  IF auth.uid() IS NULL OR public.is_site_admin() THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO active_count
  FROM public.resources r
  WHERE r.author_id = NEW.author_id
    AND r.status IN ('DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED');

  IF active_count >= public.upload_limit('max_active_resources_per_user') THEN
    RAISE EXCEPTION 'ftc:too_many_active_resources';
  END IF;

  SELECT count(*) INTO recent_count
  FROM public.resources r
  WHERE r.author_id = NEW.author_id
    AND r.created_at > now() - interval '1 hour';

  IF recent_count >= public.upload_limit('max_resources_created_per_hour') THEN
    RAISE EXCEPTION 'ftc:creation_rate_limited';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.resources_enforce_creation_quota() FROM PUBLIC;

DROP TRIGGER IF EXISTS resources_enforce_creation_quota ON public.resources;
CREATE TRIGGER resources_enforce_creation_quota
BEFORE INSERT ON public.resources
FOR EACH ROW
EXECUTE FUNCTION public.resources_enforce_creation_quota();

-- ---------------------------------------------------------------------------
-- 7. Reserve an upload
--
-- The caller supplies a resource and a filename. Everything else — version,
-- object key, expiry — is decided here. Open reservations count against the
-- file-count and byte quotas, so parallel requests cannot oversubscribe.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_upload_intent(
  p_resource_id uuid,
  p_filename text,
  p_size_bytes bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  r public.resources;
  v_version_id uuid;
  safe_name text;
  v_extension text;
  object_key text;
  expires timestamptz;
  open_user_intents bigint;
  open_resource_intents bigint;
  registered_files bigint;
  registered_bytes bigint;
  reserved_bytes bigint;
  user_active_bytes bigint;
  user_reserved_bytes bigint;
BEGIN
  IF NOT public.is_verified_user() THEN
    RAISE EXCEPTION 'ftc:verification_required';
  END IF;
  IF NOT public.can_manage_resource(p_resource_id) THEN
    RAISE EXCEPTION 'ftc:not_authorized';
  END IF;

  SELECT * INTO r FROM public.resources WHERE id = p_resource_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ftc:not_found';
  END IF;
  IF NOT public.resource_is_editable(p_resource_id) THEN
    RAISE EXCEPTION 'ftc:not_editable';
  END IF;

  SELECT id INTO v_version_id
  FROM public.resource_versions
  WHERE resource_id = p_resource_id
  ORDER BY version_number DESC
  LIMIT 1;

  IF v_version_id IS NULL THEN
    RAISE EXCEPTION 'ftc:no_version';
  END IF;

  IF p_size_bytes IS NULL OR p_size_bytes <= 0 THEN
    RAISE EXCEPTION 'ftc:empty';
  END IF;
  IF p_size_bytes > public.upload_limit('max_file_bytes') THEN
    RAISE EXCEPTION 'ftc:file_too_large';
  END IF;

  safe_name := public.upload_safe_filename(p_filename);
  IF safe_name IS NULL THEN
    RAISE EXCEPTION 'ftc:name_invalid';
  END IF;

  -- Prefixed to keep the column reference below unambiguous inside PL/pgSQL.
  v_extension := public.upload_extension(safe_name);
  IF v_extension = '' OR EXISTS (
    SELECT 1 FROM public.upload_blocked_extension b WHERE b.extension = v_extension
  ) THEN
    RAISE EXCEPTION 'ftc:extension_blocked';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.upload_allowed_extension a
    WHERE a.resource_type = r.resource_type AND a.extension = v_extension
  ) THEN
    RAISE EXCEPTION 'ftc:extension_not_allowed';
  END IF;

  SELECT count(*) INTO open_user_intents
  FROM public.resource_upload_intents i
  WHERE i.user_id = auth.uid() AND i.status = 'PENDING' AND i.expires_at > now();

  IF open_user_intents >= public.upload_limit('max_open_uploads_per_user') THEN
    RAISE EXCEPTION 'ftc:too_many_open_uploads';
  END IF;

  SELECT count(*) INTO open_resource_intents
  FROM public.resource_upload_intents i
  WHERE i.resource_id = p_resource_id AND i.status = 'PENDING' AND i.expires_at > now();

  IF open_resource_intents >= public.upload_limit('max_open_uploads_per_resource') THEN
    RAISE EXCEPTION 'ftc:too_many_open_uploads';
  END IF;

  SELECT count(*), coalesce(sum(coalesce(size_bytes, 0)), 0)
  INTO registered_files, registered_bytes
  FROM public.resource_files f
  WHERE f.resource_id = p_resource_id;

  -- Reservations occupy a slot, so simultaneous uploads cannot exceed the count.
  IF registered_files + open_resource_intents >= public.upload_limit('max_files_per_resource') THEN
    RAISE EXCEPTION 'ftc:too_many_files';
  END IF;

  SELECT coalesce(sum(i.expected_size_bytes), 0) INTO reserved_bytes
  FROM public.resource_upload_intents i
  WHERE i.resource_id = p_resource_id AND i.status = 'PENDING' AND i.expires_at > now();

  IF registered_bytes + reserved_bytes + p_size_bytes
     > public.upload_limit('total_bytes_' || r.resource_type) THEN
    RAISE EXCEPTION 'ftc:quota_exceeded';
  END IF;

  SELECT coalesce(sum(coalesce(f.size_bytes, 0)), 0) INTO user_active_bytes
  FROM public.resource_files f
  JOIN public.resources rr ON rr.id = f.resource_id
  WHERE rr.author_id = auth.uid()
    AND rr.status IN ('DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED');

  SELECT coalesce(sum(i.expected_size_bytes), 0) INTO user_reserved_bytes
  FROM public.resource_upload_intents i
  WHERE i.user_id = auth.uid() AND i.status = 'PENDING' AND i.expires_at > now();

  IF user_active_bytes + user_reserved_bytes + p_size_bytes
     > public.upload_limit('active_storage_bytes_per_user') THEN
    RAISE EXCEPTION 'ftc:storage_quota_exceeded';
  END IF;

  object_key := p_resource_id::text || '/' || v_version_id::text || '/'
                || gen_random_uuid()::text || '_' || safe_name;
  expires := now() + make_interval(secs => public.upload_limit('upload_intent_ttl_seconds')::int);

  INSERT INTO public.resource_upload_intents (
    user_id, resource_id, version_id, storage_path,
    original_filename, expected_size_bytes, expires_at
  )
  VALUES (
    auth.uid(), p_resource_id, v_version_id, object_key,
    safe_name, p_size_bytes, expires
  );

  RETURN jsonb_build_object(
    'storagePath', object_key,
    'expiresAt', expires
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Finalize an upload
--
-- Reads the real object row out of `storage.objects` rather than trusting a
-- reported size, then registers the file and burns the reservation in one
-- transaction.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.complete_upload_intent(
  p_storage_path text,
  p_file_type text DEFAULT NULL,
  p_mime_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  intent public.resource_upload_intents;
  r public.resources;
  actual_size bigint;
  registered_files bigint;
  registered_bytes bigint;
  existing_file uuid;
  new_file_id uuid;
BEGIN
  IF NOT public.is_verified_user() THEN
    RAISE EXCEPTION 'ftc:verification_required';
  END IF;

  SELECT * INTO intent
  FROM public.resource_upload_intents
  WHERE storage_path = p_storage_path
  FOR UPDATE;

  IF NOT FOUND OR intent.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'ftc:upload_not_authorized';
  END IF;

  -- Retrying a finalize returns the row that already exists instead of
  -- inserting a second one.
  IF intent.status = 'COMPLETED' THEN
    SELECT id INTO existing_file FROM public.resource_files WHERE storage_path = p_storage_path;
    IF existing_file IS NULL THEN
      RAISE EXCEPTION 'ftc:upload_not_authorized';
    END IF;
    RETURN jsonb_build_object('fileId', existing_file, 'alreadyRegistered', true);
  END IF;
  IF intent.status <> 'PENDING' THEN
    RAISE EXCEPTION 'ftc:upload_not_authorized';
  END IF;
  IF intent.expires_at <= now() THEN
    RAISE EXCEPTION 'ftc:upload_expired';
  END IF;

  IF NOT public.can_manage_resource(intent.resource_id)
     OR NOT public.resource_is_editable(intent.resource_id) THEN
    RAISE EXCEPTION 'ftc:not_editable';
  END IF;

  SELECT * INTO r FROM public.resources WHERE id = intent.resource_id;

  SELECT (o.metadata ->> 'size')::bigint INTO actual_size
  FROM storage.objects o
  WHERE o.bucket_id = 'resource-files' AND o.name = p_storage_path;

  IF actual_size IS NULL OR actual_size <= 0 THEN
    RAISE EXCEPTION 'ftc:upload_missing';
  END IF;
  -- The browser reported a size when reserving; the stored object must not be
  -- larger than what was authorized, nor over the absolute per-file limit.
  IF actual_size > intent.expected_size_bytes
     OR actual_size > public.upload_limit('max_file_bytes') THEN
    RAISE EXCEPTION 'ftc:file_too_large';
  END IF;

  SELECT count(*), coalesce(sum(coalesce(size_bytes, 0)), 0)
  INTO registered_files, registered_bytes
  FROM public.resource_files f
  WHERE f.resource_id = intent.resource_id;

  IF registered_files >= public.upload_limit('max_files_per_resource') THEN
    RAISE EXCEPTION 'ftc:too_many_files';
  END IF;
  IF registered_bytes + actual_size > public.upload_limit('total_bytes_' || r.resource_type) THEN
    RAISE EXCEPTION 'ftc:quota_exceeded';
  END IF;

  -- Display metadata only; the CHECK constraint bounds file_type and a stored
  -- mime type is never used to build a response header.
  INSERT INTO public.resource_files (
    resource_id, version_id, filename, file_type, mime_type, size_bytes, storage_path
  )
  VALUES (
    intent.resource_id, intent.version_id, intent.original_filename,
    p_file_type,
    CASE
      WHEN p_mime_type ~ '^[A-Za-z0-9!#$&^_.+-]{1,64}/[A-Za-z0-9!#$&^_.+-]{1,64}$'
        THEN p_mime_type
      ELSE NULL
    END,
    actual_size, p_storage_path
  )
  RETURNING id INTO new_file_id;

  UPDATE public.resource_upload_intents
  SET status = 'COMPLETED', completed_at = now()
  WHERE id = intent.id;

  RETURN jsonb_build_object('fileId', new_file_id, 'alreadyRegistered', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_upload_intent(p_storage_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.resource_upload_intents
  SET status = 'CANCELLED'
  WHERE storage_path = p_storage_path
    AND user_id = auth.uid()
    AND status = 'PENDING';
END;
$$;

REVOKE ALL ON FUNCTION public.create_upload_intent(uuid, text, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_upload_intent(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_upload_intent(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_upload_intent(uuid, text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_upload_intent(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_upload_intent(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. Submission closes open reservations
--
-- A resource entering review must not have an upload that could still land.
-- Cancelling here means the Storage policy rejects any in-flight write, and the
-- reviewer only ever sees registered files.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_resource_for_review(
  p_resource_id uuid,
  p_rights_acknowledged boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_status text;
BEGIN
  IF p_resource_id IS NULL THEN
    RAISE EXCEPTION 'ftc:not_found';
  END IF;
  IF NOT public.is_verified_user() THEN
    RAISE EXCEPTION 'ftc:verification_required';
  END IF;
  IF NOT public.can_manage_resource(p_resource_id) THEN
    RAISE EXCEPTION 'ftc:not_authorized';
  END IF;
  IF NOT coalesce(p_rights_acknowledged, false) THEN
    RAISE EXCEPTION 'ftc:rights_required';
  END IF;

  SELECT status INTO current_status
  FROM public.resources
  WHERE id = p_resource_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ftc:not_found';
  END IF;
  IF current_status NOT IN ('DRAFT', 'CHANGES_REQUESTED') THEN
    RAISE EXCEPTION 'ftc:not_editable';
  END IF;

  UPDATE public.resource_upload_intents
  SET status = 'CANCELLED'
  WHERE resource_id = p_resource_id AND status = 'PENDING';

  UPDATE public.resources
  SET status = 'PENDING_REVIEW',
      rights_acknowledged_at = now()
  WHERE id = p_resource_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_resource_for_review(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_resource_for_review(uuid, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- 10. Orphan detection
--
-- Storage objects live outside Postgres transactions, so a trigger cannot
-- delete them. What the database can do is decide, safely, which keys are
-- eligible. Deletion happens through the Storage API in
-- `lib/admin/storage-actions.ts`.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.orphan_upload_objects(p_limit int DEFAULT 100)
RETURNS TABLE (storage_path text, size_bytes bigint, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    o.name,
    (o.metadata ->> 'size')::bigint,
    o.created_at
  FROM storage.objects o
  -- Site Admin, or a trusted service-role caller (no JWT) such as the
  -- scheduled sweep. A normal authenticated caller gets zero rows.
  WHERE (public.is_site_admin() OR auth.uid() IS NULL)
    -- Only the private originals bucket. Previews, avatars, and team logos are
    -- other systems and are never candidates.
    AND o.bucket_id = 'resource-files'
    -- Grace period: registration may still be in flight for a fresh upload.
    AND o.created_at < now() - make_interval(hours => public.upload_limit('orphan_grace_hours')::int)
    -- Inside the expected `<resource-id>/<version-id>/<file-id>_<name>` shape.
    AND public.storage_first_folder_uuid(o.name) IS NOT NULL
    AND array_length(string_to_array(o.name, '/'), 1) = 3
    -- Never referenced by a registered file.
    AND NOT EXISTS (
      SELECT 1 FROM public.resource_files f WHERE f.storage_path = o.name
    )
    -- Never covered by a reservation that could still be finalized.
    AND NOT EXISTS (
      SELECT 1 FROM public.resource_upload_intents i
      WHERE i.storage_path = o.name
        AND i.status = 'PENDING'
        AND i.expires_at > now()
    )
  ORDER BY o.created_at
  LIMIT greatest(1, least(coalesce(p_limit, 100), 500));
$$;

CREATE OR REPLACE FUNCTION public.upload_hygiene_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN NOT public.is_site_admin() THEN NULL
    ELSE jsonb_build_object(
      'orphanCandidates', (SELECT count(*) FROM public.orphan_upload_objects(500)),
      'openIntents', (
        SELECT count(*) FROM public.resource_upload_intents
        WHERE status = 'PENDING' AND expires_at > now()
      ),
      'abandonedIntents', (
        SELECT count(*) FROM public.resource_upload_intents
        WHERE status = 'PENDING' AND expires_at <= now()
      )
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.orphan_upload_objects(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upload_hygiene_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.orphan_upload_objects(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upload_hygiene_summary() TO authenticated;
