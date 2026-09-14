-- STEP 5.1.1: leftover-object quota accounting, concurrency-safe reservations,
-- and a private Tutorial video bucket.
--
-- STEP 5.1 made Storage writes reservation-gated, but three holes remained:
--
-- 1. cancel_upload_intent() marked a row CANCELLED even if the object was
--    already in Storage, so the bytes vanished from quota.
-- 2. Quota counted only PENDING AND expires_at > now(), so waiting 15 minutes
--    after an unregistered upload freed the reservation while the object stayed.
-- 3. create_upload_intent() checked counts then inserted, with no row lock, so
--    concurrent requests could oversubscribe.
--
-- This migration also adds `tutorial-videos` so a 1 GB instructional video does
-- not force every CAD/CODE/MODEL object up to that ceiling. The browser never
-- chooses the bucket: create_upload_intent() derives it from resource type and
-- extension.
--
-- STEP 5 moderation and STEP 3.1 published immutability are untouched.

-- ---------------------------------------------------------------------------
-- 1. Numeric policy
--
-- CREATE OR REPLACE so later parity tests can read this definition as the
-- live one. Keys that existed in 5.1 keep their names; new keys are additive.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upload_limit(p_key text)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_key
    WHEN 'max_file_bytes'                 THEN 104857600
    WHEN 'max_file_bytes_CODE'            THEN 52428800
    WHEN 'max_video_bytes'                THEN 1073741824
    WHEN 'max_files_per_resource'         THEN 20
    WHEN 'max_filename_length'            THEN 120
    WHEN 'total_bytes_CAD'                THEN 262144000
    WHEN 'total_bytes_CODE'               THEN 104857600
    WHEN 'total_bytes_TUTORIAL'           THEN 2415919104
    WHEN 'total_bytes_MODEL'              THEN 262144000
    WHEN 'total_video_bytes_TUTORIAL'     THEN 2147483648
    WHEN 'active_storage_bytes_per_user'  THEN 3221225472
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

-- ---------------------------------------------------------------------------
-- 2. Tutorial video bucket + type allowlist
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'tutorial-videos',
  'tutorial-videos',
  false,
  public.upload_limit('max_video_bytes')
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = public.upload_limit('max_video_bytes');

UPDATE storage.buckets
SET file_size_limit = public.upload_limit('max_file_bytes')
WHERE id = 'resource-files';

INSERT INTO public.upload_allowed_extension (resource_type, extension) VALUES
  ('TUTORIAL', 'mp4'),
  ('TUTORIAL', 'webm')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Multi-bucket metadata
--
-- Existing resource_files rows default to resource-files. Intents gain a
-- server-chosen bucket that the client cannot update.
-- ---------------------------------------------------------------------------

ALTER TABLE public.resource_files
  ADD COLUMN IF NOT EXISTS storage_bucket text NOT NULL DEFAULT 'resource-files';

ALTER TABLE public.resource_files
  DROP CONSTRAINT IF EXISTS resource_files_bucket_check;

ALTER TABLE public.resource_files
  ADD CONSTRAINT resource_files_bucket_check CHECK (
    storage_bucket IN ('resource-files', 'tutorial-videos')
  );

ALTER TABLE public.resource_files
  DROP CONSTRAINT IF EXISTS resource_files_type_check;

ALTER TABLE public.resource_files
  ADD CONSTRAINT resource_files_type_check CHECK (
    file_type IS NULL
    OR file_type IN ('CAD', 'SOURCE', 'DOCUMENT', 'VIDEO_LINK', 'VIDEO', 'IMAGE', 'OTHER')
  );

DROP INDEX IF EXISTS public.resource_files_storage_path_key;
CREATE UNIQUE INDEX IF NOT EXISTS resource_files_bucket_path_key
  ON public.resource_files (storage_bucket, storage_path);

ALTER TABLE public.resource_upload_intents
  ADD COLUMN IF NOT EXISTS storage_bucket text NOT NULL DEFAULT 'resource-files';

ALTER TABLE public.resource_upload_intents
  DROP CONSTRAINT IF EXISTS resource_upload_intents_bucket_check;

ALTER TABLE public.resource_upload_intents
  ADD CONSTRAINT resource_upload_intents_bucket_check CHECK (
    storage_bucket IN ('resource-files', 'tutorial-videos')
  );

ALTER TABLE public.resource_upload_intents
  DROP CONSTRAINT IF EXISTS resource_upload_intents_status_check;

ALTER TABLE public.resource_upload_intents
  ADD CONSTRAINT resource_upload_intents_status_check CHECK (
    status IN ('PENDING', 'COMPLETED', 'CANCELLED', 'EXPIRED')
  );

-- Videos are 1 GB; the previous 100 MB check would reject a legitimate Tutorial.
ALTER TABLE public.resource_upload_intents
  DROP CONSTRAINT IF EXISTS resource_upload_intents_size_check;

ALTER TABLE public.resource_upload_intents
  ADD CONSTRAINT resource_upload_intents_size_check CHECK (
    expected_size_bytes > 0
    AND expected_size_bytes <= 1073741824
  );

-- ---------------------------------------------------------------------------
-- 4. Exact-path Storage policies for both buckets
--
-- has_open_upload_intent now takes the bucket so a reservation for
-- resource-files cannot authorize a write to tutorial-videos, or vice versa.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS storage_resource_files_insert ON storage.objects;
DROP POLICY IF EXISTS storage_resource_files_update ON storage.objects;

DROP FUNCTION IF EXISTS public.has_open_upload_intent(text);

CREATE OR REPLACE FUNCTION public.has_open_upload_intent(p_bucket text, p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.resource_upload_intents i
    WHERE i.storage_bucket = p_bucket
      AND i.storage_path = p_object_name
      AND i.user_id = auth.uid()
      AND i.status = 'PENDING'
      AND i.expires_at > now()
  );
$$;

REVOKE ALL ON FUNCTION public.has_open_upload_intent(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_open_upload_intent(text, text) TO authenticated;

CREATE POLICY storage_resource_files_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'resource-files'
    AND public.is_verified_user()
    AND public.can_edit_resource(public.storage_first_folder_uuid(name))
    AND public.has_open_upload_intent('resource-files', name)
  );

CREATE POLICY storage_resource_files_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'resource-files'
    AND public.is_verified_user()
    AND public.can_edit_resource(public.storage_first_folder_uuid(name))
    AND public.has_open_upload_intent('resource-files', name)
  )
  WITH CHECK (
    bucket_id = 'resource-files'
    AND public.is_verified_user()
    AND public.can_edit_resource(public.storage_first_folder_uuid(name))
    AND public.has_open_upload_intent('resource-files', name)
  );

DROP POLICY IF EXISTS storage_tutorial_videos_select ON storage.objects;
CREATE POLICY storage_tutorial_videos_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'tutorial-videos'
    AND public.is_verified_user()
    AND (
      public.is_site_admin()
      OR public.can_manage_resource(public.storage_first_folder_uuid(name))
    )
  );

DROP POLICY IF EXISTS storage_tutorial_videos_insert ON storage.objects;
CREATE POLICY storage_tutorial_videos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tutorial-videos'
    AND public.is_verified_user()
    AND public.can_edit_resource(public.storage_first_folder_uuid(name))
    AND public.has_open_upload_intent('tutorial-videos', name)
  );

DROP POLICY IF EXISTS storage_tutorial_videos_update ON storage.objects;
CREATE POLICY storage_tutorial_videos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tutorial-videos'
    AND public.is_verified_user()
    AND public.can_edit_resource(public.storage_first_folder_uuid(name))
    AND public.has_open_upload_intent('tutorial-videos', name)
  )
  WITH CHECK (
    bucket_id = 'tutorial-videos'
    AND public.is_verified_user()
    AND public.can_edit_resource(public.storage_first_folder_uuid(name))
    AND public.has_open_upload_intent('tutorial-videos', name)
  );

DROP POLICY IF EXISTS storage_tutorial_videos_delete ON storage.objects;
CREATE POLICY storage_tutorial_videos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'tutorial-videos'
    AND public.can_edit_resource(public.storage_first_folder_uuid(name))
  );

-- ---------------------------------------------------------------------------
-- 5. Held-bytes accounting
--
-- Each intended/uploaded object consumes quota once:
--   object exists            → actual Storage size
--   PENDING and unexpired    → expected_size_bytes
--   otherwise (no object)    → 0
-- COMPLETED intents are counted via resource_files, not here.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.storage_object_bytes(p_bucket text, p_path text)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT (o.metadata ->> 'size')::bigint
  FROM storage.objects o
  WHERE o.bucket_id = p_bucket AND o.name = p_path
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.upload_intent_held_bytes(
  p_bucket text,
  p_path text,
  p_status text,
  p_expires_at timestamptz,
  p_expected bigint
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actual bigint;
BEGIN
  IF p_status = 'COMPLETED' THEN
    RETURN 0;
  END IF;

  actual := public.storage_object_bytes(p_bucket, p_path);
  IF actual IS NOT NULL AND actual > 0 THEN
    RETURN actual;
  END IF;

  IF p_status = 'PENDING' AND p_expires_at > now() THEN
    RETURN coalesce(p_expected, 0);
  END IF;

  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.resource_held_upload_bytes(p_resource_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(sum(public.upload_intent_held_bytes(
    i.storage_bucket, i.storage_path, i.status, i.expires_at, i.expected_size_bytes
  )), 0)
  FROM public.resource_upload_intents i
  WHERE i.resource_id = p_resource_id;
$$;

CREATE OR REPLACE FUNCTION public.resource_held_video_bytes(p_resource_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(sum(public.upload_intent_held_bytes(
    i.storage_bucket, i.storage_path, i.status, i.expires_at, i.expected_size_bytes
  )), 0)
  FROM public.resource_upload_intents i
  WHERE i.resource_id = p_resource_id
    AND i.storage_bucket = 'tutorial-videos';
$$;

CREATE OR REPLACE FUNCTION public.user_held_upload_bytes(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(sum(public.upload_intent_held_bytes(
    i.storage_bucket, i.storage_path, i.status, i.expires_at, i.expected_size_bytes
  )), 0)
  FROM public.resource_upload_intents i
  WHERE i.user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.storage_object_bytes(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upload_intent_held_bytes(text, text, text, timestamptz, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resource_held_upload_bytes(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resource_held_video_bytes(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_held_upload_bytes(uuid) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 6. Concurrency locks + stale-intent expiry
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upload_lock_quota(p_resource_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Transaction-scoped advisory locks so two sessions cannot interleave the
  -- SELECT-then-INSERT around the same user or resource.
  PERFORM pg_advisory_xact_lock(872011, hashtext(coalesce(auth.uid()::text, '')));
  PERFORM pg_advisory_xact_lock(872012, hashtext(p_resource_id::text));
  PERFORM 1 FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  PERFORM 1 FROM public.resources WHERE id = p_resource_id FOR UPDATE;
END;
$$;

REVOKE ALL ON FUNCTION public.upload_lock_quota(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.expire_stale_upload_intents()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.resource_upload_intents
  SET status = 'EXPIRED'
  WHERE status = 'PENDING'
    AND expires_at <= now();
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_upload_intents() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_upload_intents() TO authenticated;

CREATE OR REPLACE FUNCTION public.upload_video_mime_ok(p_extension text, p_mime text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_mime IS NULL OR btrim(p_mime) = '' OR lower(p_mime) = 'application/octet-stream' THEN true
    WHEN p_extension = 'mp4' THEN lower(btrim(p_mime)) = 'video/mp4'
    WHEN p_extension = 'webm' THEN lower(btrim(p_mime)) = 'video/webm'
    ELSE true
  END;
$$;

REVOKE ALL ON FUNCTION public.upload_video_mime_ok(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upload_video_mime_ok(text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. create_upload_intent — locked, leftover-aware, server-chosen bucket
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_upload_intent(
  p_resource_id uuid,
  p_filename text,
  p_size_bytes bigint,
  p_mime_type text DEFAULT NULL
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
  v_bucket text;
  is_video boolean;
  object_key text;
  expires timestamptz;
  per_file_limit bigint;
  open_user_intents bigint;
  open_resource_intents bigint;
  registered_files bigint;
  registered_bytes bigint;
  registered_video_bytes bigint;
  held_bytes bigint;
  held_video_bytes bigint;
  user_registered_bytes bigint;
  user_held_bytes bigint;
BEGIN
  IF NOT public.is_verified_user() THEN
    RAISE EXCEPTION 'ftc:verification_required';
  END IF;
  IF NOT public.can_manage_resource(p_resource_id) THEN
    RAISE EXCEPTION 'ftc:not_authorized';
  END IF;

  PERFORM public.upload_lock_quota(p_resource_id);
  PERFORM public.expire_stale_upload_intents();

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

  safe_name := public.upload_safe_filename(p_filename);
  IF safe_name IS NULL THEN
    RAISE EXCEPTION 'ftc:name_invalid';
  END IF;

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

  -- Bucket is derived here. There is no client-supplied bucket argument to forge.
  is_video := (r.resource_type = 'TUTORIAL' AND v_extension IN ('mp4', 'webm'));
  v_bucket := CASE WHEN is_video THEN 'tutorial-videos' ELSE 'resource-files' END;

  IF is_video THEN
    IF NOT public.upload_video_mime_ok(v_extension, p_mime_type) THEN
      RAISE EXCEPTION 'ftc:mime_mismatch';
    END IF;
    per_file_limit := public.upload_limit('max_video_bytes');
  ELSIF r.resource_type = 'CODE' THEN
    per_file_limit := public.upload_limit('max_file_bytes_CODE');
  ELSE
    per_file_limit := public.upload_limit('max_file_bytes');
  END IF;

  IF p_size_bytes > per_file_limit THEN
    RAISE EXCEPTION 'ftc:file_too_large';
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

  IF registered_files + open_resource_intents >= public.upload_limit('max_files_per_resource') THEN
    RAISE EXCEPTION 'ftc:too_many_files';
  END IF;

  held_bytes := public.resource_held_upload_bytes(p_resource_id);
  IF registered_bytes + held_bytes + p_size_bytes
     > public.upload_limit('total_bytes_' || r.resource_type) THEN
    RAISE EXCEPTION 'ftc:quota_exceeded';
  END IF;

  IF is_video THEN
    SELECT coalesce(sum(coalesce(size_bytes, 0)), 0) INTO registered_video_bytes
    FROM public.resource_files f
    WHERE f.resource_id = p_resource_id AND f.storage_bucket = 'tutorial-videos';

    held_video_bytes := public.resource_held_video_bytes(p_resource_id);
    IF registered_video_bytes + held_video_bytes + p_size_bytes
       > public.upload_limit('total_video_bytes_TUTORIAL') THEN
      RAISE EXCEPTION 'ftc:video_quota_exceeded';
    END IF;
  END IF;

  SELECT coalesce(sum(coalesce(f.size_bytes, 0)), 0) INTO user_registered_bytes
  FROM public.resource_files f
  JOIN public.resources rr ON rr.id = f.resource_id
  WHERE rr.author_id = auth.uid()
    AND rr.status IN ('DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED');

  user_held_bytes := public.user_held_upload_bytes(auth.uid());
  IF user_registered_bytes + user_held_bytes + p_size_bytes
     > public.upload_limit('active_storage_bytes_per_user') THEN
    RAISE EXCEPTION 'ftc:storage_quota_exceeded';
  END IF;

  object_key := p_resource_id::text || '/' || v_version_id::text || '/'
                || gen_random_uuid()::text || '_' || safe_name;
  expires := now() + make_interval(secs => public.upload_limit('upload_intent_ttl_seconds')::int);

  INSERT INTO public.resource_upload_intents (
    user_id, resource_id, version_id, storage_bucket, storage_path,
    original_filename, expected_size_bytes, expires_at
  )
  VALUES (
    auth.uid(), p_resource_id, v_version_id, v_bucket, object_key,
    safe_name, p_size_bytes, expires
  );

  RETURN jsonb_build_object(
    'storagePath', object_key,
    'expiresAt', expires,
    'bucket', v_bucket
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. complete_upload_intent — locked, exact bucket, leftover-aware
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
  stored_mime text;
  per_file_limit bigint;
  registered_files bigint;
  registered_bytes bigint;
  registered_video_bytes bigint;
  held_bytes bigint;
  held_video_bytes bigint;
  user_registered_bytes bigint;
  user_held_bytes bigint;
  existing_file uuid;
  new_file_id uuid;
  v_file_type text;
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

  PERFORM public.upload_lock_quota(intent.resource_id);
  PERFORM public.expire_stale_upload_intents();

  -- Re-read under the resource lock in case a concurrent cancel won.
  SELECT * INTO intent
  FROM public.resource_upload_intents
  WHERE id = intent.id
  FOR UPDATE;

  IF intent.status = 'COMPLETED' THEN
    SELECT id INTO existing_file
    FROM public.resource_files
    WHERE storage_path = p_storage_path
      AND storage_bucket = intent.storage_bucket;
    IF existing_file IS NULL THEN
      RAISE EXCEPTION 'ftc:upload_not_authorized';
    END IF;
    RETURN jsonb_build_object('fileId', existing_file, 'alreadyRegistered', true);
  END IF;
  IF intent.status <> 'PENDING' THEN
    RAISE EXCEPTION 'ftc:upload_not_authorized';
  END IF;
  IF intent.expires_at <= now() THEN
    UPDATE public.resource_upload_intents SET status = 'EXPIRED' WHERE id = intent.id;
    RAISE EXCEPTION 'ftc:upload_expired';
  END IF;

  IF NOT public.can_manage_resource(intent.resource_id)
     OR NOT public.resource_is_editable(intent.resource_id) THEN
    RAISE EXCEPTION 'ftc:not_editable';
  END IF;

  SELECT * INTO r FROM public.resources WHERE id = intent.resource_id;

  SELECT
    (o.metadata ->> 'size')::bigint,
    coalesce(o.metadata ->> 'mimetype', o.metadata ->> 'contentType')
  INTO actual_size, stored_mime
  FROM storage.objects o
  WHERE o.bucket_id = intent.storage_bucket AND o.name = p_storage_path;

  IF actual_size IS NULL OR actual_size <= 0 THEN
    RAISE EXCEPTION 'ftc:upload_missing';
  END IF;

  IF intent.storage_bucket = 'tutorial-videos' THEN
    per_file_limit := public.upload_limit('max_video_bytes');
    IF NOT public.upload_video_mime_ok(
      public.upload_extension(intent.original_filename),
      coalesce(stored_mime, p_mime_type)
    ) THEN
      RAISE EXCEPTION 'ftc:mime_mismatch';
    END IF;
  ELSIF r.resource_type = 'CODE' THEN
    per_file_limit := public.upload_limit('max_file_bytes_CODE');
  ELSE
    per_file_limit := public.upload_limit('max_file_bytes');
  END IF;

  IF actual_size > intent.expected_size_bytes OR actual_size > per_file_limit THEN
    RAISE EXCEPTION 'ftc:file_too_large';
  END IF;

  SELECT count(*), coalesce(sum(coalesce(size_bytes, 0)), 0)
  INTO registered_files, registered_bytes
  FROM public.resource_files f
  WHERE f.resource_id = intent.resource_id;

  IF registered_files >= public.upload_limit('max_files_per_resource') THEN
    RAISE EXCEPTION 'ftc:too_many_files';
  END IF;

  -- Exclude this intent's own held bytes (the object we are about to register)
  -- so we do not double-count it as both leftover and new.
  held_bytes := public.resource_held_upload_bytes(intent.resource_id)
                - public.upload_intent_held_bytes(
                    intent.storage_bucket, intent.storage_path, intent.status,
                    intent.expires_at, intent.expected_size_bytes
                  );

  IF registered_bytes + greatest(held_bytes, 0) + actual_size
     > public.upload_limit('total_bytes_' || r.resource_type) THEN
    RAISE EXCEPTION 'ftc:quota_exceeded';
  END IF;

  IF intent.storage_bucket = 'tutorial-videos' THEN
    SELECT coalesce(sum(coalesce(size_bytes, 0)), 0) INTO registered_video_bytes
    FROM public.resource_files f
    WHERE f.resource_id = intent.resource_id AND f.storage_bucket = 'tutorial-videos';

    held_video_bytes := public.resource_held_video_bytes(intent.resource_id)
                        - public.upload_intent_held_bytes(
                            intent.storage_bucket, intent.storage_path, intent.status,
                            intent.expires_at, intent.expected_size_bytes
                          );
    IF registered_video_bytes + greatest(held_video_bytes, 0) + actual_size
       > public.upload_limit('total_video_bytes_TUTORIAL') THEN
      RAISE EXCEPTION 'ftc:video_quota_exceeded';
    END IF;
  END IF;

  SELECT coalesce(sum(coalesce(f.size_bytes, 0)), 0) INTO user_registered_bytes
  FROM public.resource_files f
  JOIN public.resources rr ON rr.id = f.resource_id
  WHERE rr.author_id = auth.uid()
    AND rr.status IN ('DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED');

  user_held_bytes := public.user_held_upload_bytes(auth.uid())
                     - public.upload_intent_held_bytes(
                         intent.storage_bucket, intent.storage_path, intent.status,
                         intent.expires_at, intent.expected_size_bytes
                       );
  IF user_registered_bytes + greatest(user_held_bytes, 0) + actual_size
     > public.upload_limit('active_storage_bytes_per_user') THEN
    RAISE EXCEPTION 'ftc:storage_quota_exceeded';
  END IF;

  v_file_type := CASE
    WHEN intent.storage_bucket = 'tutorial-videos' THEN 'VIDEO'
    ELSE p_file_type
  END;

  INSERT INTO public.resource_files (
    resource_id, version_id, filename, file_type, mime_type,
    size_bytes, storage_path, storage_bucket
  )
  VALUES (
    intent.resource_id, intent.version_id, intent.original_filename, v_file_type,
    CASE
      WHEN coalesce(stored_mime, p_mime_type) ~ '^[A-Za-z0-9!#$&^_.+-]{1,64}/[A-Za-z0-9!#$&^_.+-]{1,64}$'
        THEN coalesce(stored_mime, p_mime_type)
      ELSE NULL
    END,
    actual_size, p_storage_path, intent.storage_bucket
  )
  RETURNING id INTO new_file_id;

  UPDATE public.resource_upload_intents
  SET status = 'COMPLETED', completed_at = now()
  WHERE id = intent.id
    AND status = 'PENDING';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ftc:upload_not_authorized';
  END IF;

  RETURN jsonb_build_object('fileId', new_file_id, 'alreadyRegistered', false);
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. cancel_upload_intent
--
-- Postgres cannot delete a Storage object as if it were a row. If the object
-- exists, cancellation is refused and the bytes stay in held-quota accounting.
-- The application deletes through the Storage API using the intent's own
-- bucket and path, then retries. A failed delete therefore cannot make the
-- bytes disappear from quota.
--
-- Return type changes from void to jsonb, so the previous function must be
-- dropped rather than replaced.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.cancel_upload_intent(text);

CREATE OR REPLACE FUNCTION public.cancel_upload_intent(p_storage_path text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  intent public.resource_upload_intents;
  actual bigint;
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

  PERFORM public.upload_lock_quota(intent.resource_id);

  SELECT * INTO intent
  FROM public.resource_upload_intents
  WHERE id = intent.id
  FOR UPDATE;

  IF intent.status = 'COMPLETED' THEN
    RAISE EXCEPTION 'ftc:upload_not_authorized';
  END IF;

  actual := public.storage_object_bytes(intent.storage_bucket, intent.storage_path);
  IF actual IS NOT NULL AND actual > 0 THEN
    RAISE EXCEPTION 'ftc:object_still_present';
  END IF;

  IF intent.status = 'PENDING' THEN
    UPDATE public.resource_upload_intents
    SET status = 'CANCELLED'
    WHERE id = intent.id
      AND status = 'PENDING';
  END IF;

  RETURN jsonb_build_object(
    'cancelled', true,
    'bucket', intent.storage_bucket,
    'storagePath', intent.storage_path
  );
END;
$$;

-- create_upload_intent gained an optional mime argument; drop the old 3-arg form.
DROP FUNCTION IF EXISTS public.create_upload_intent(uuid, text, bigint);

REVOKE ALL ON FUNCTION public.create_upload_intent(uuid, text, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_upload_intent(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_upload_intent(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_upload_intent(uuid, text, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_upload_intent(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_upload_intent(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 10. Submission refuses in-flight uploads instead of cancelling them
--
-- Blindly marking PENDING intents CANCELLED was another way to hide an already
-- uploaded object. Reviewers only ever see registered files; an in-flight
-- upload must be finished or truly cleaned up first.
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
  open_count bigint;
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

  PERFORM public.expire_stale_upload_intents();

  SELECT count(*) INTO open_count
  FROM public.resource_upload_intents i
  WHERE i.resource_id = p_resource_id
    AND i.status = 'PENDING'
    AND i.expires_at > now();

  IF open_count > 0 THEN
    RAISE EXCEPTION 'ftc:upload_in_progress';
  END IF;

  UPDATE public.resources
  SET status = 'PENDING_REVIEW',
      rights_acknowledged_at = now()
  WHERE id = p_resource_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_resource_for_review(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_resource_for_review(uuid, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- 11. Orphan detection across both private upload buckets
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.orphan_upload_objects(int);

CREATE OR REPLACE FUNCTION public.orphan_upload_objects(p_limit int DEFAULT 100)
RETURNS TABLE (
  storage_bucket text,
  storage_path text,
  size_bytes bigint,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    o.bucket_id,
    o.name,
    (o.metadata ->> 'size')::bigint,
    o.created_at
  FROM storage.objects o
  WHERE (public.is_site_admin() OR auth.uid() IS NULL)
    AND o.bucket_id IN ('resource-files', 'tutorial-videos')
    AND o.created_at < now() - make_interval(hours => public.upload_limit('orphan_grace_hours')::int)
    AND public.storage_first_folder_uuid(o.name) IS NOT NULL
    AND array_length(string_to_array(o.name, '/'), 1) = 3
    AND NOT EXISTS (
      SELECT 1 FROM public.resource_files f
      WHERE f.storage_path = o.name AND f.storage_bucket = o.bucket_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.resource_upload_intents i
      WHERE i.storage_path = o.name
        AND i.storage_bucket = o.bucket_id
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
        WHERE status IN ('PENDING', 'EXPIRED') AND expires_at <= now()
      ),
      'leftoverObjects', (
        SELECT count(*) FROM public.resource_upload_intents i
        WHERE i.status IN ('CANCELLED', 'EXPIRED')
          AND public.storage_object_bytes(i.storage_bucket, i.storage_path) > 0
      )
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.orphan_upload_objects(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upload_hygiene_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.orphan_upload_objects(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upload_hygiene_summary() TO authenticated;
