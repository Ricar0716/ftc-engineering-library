-- STEP 7.3: published-resource versioning.
--
-- Reuses public.resource_versions (no second table). Resource-level moderation
-- stays the catalog gate: a published resource remains PUBLISHED while a new
-- revision is drafted and reviewed. Version status is DRAFT | PENDING_REVIEW |
-- PUBLISHED | ARCHIVED and does not replace resources.status.
--
-- Existing rows: published/archived resources get version status PUBLISHED and
-- released_at from resources.published_at. Everything else stays DRAFT.
-- Files stay on their version_id. Storage keys are unchanged.

-- ---------------------------------------------------------------------------
-- 1. Columns and backfill
-- ---------------------------------------------------------------------------

ALTER TABLE public.resource_versions
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS released_at timestamptz;

UPDATE public.resource_versions v
SET
  status = CASE
    WHEN r.status IN ('PUBLISHED', 'ARCHIVED') THEN 'PUBLISHED'
    WHEN r.status = 'PENDING_REVIEW' THEN 'PENDING_REVIEW'
    ELSE 'DRAFT'
  END,
  released_at = CASE
    WHEN r.status IN ('PUBLISHED', 'ARCHIVED') THEN coalesce(r.published_at, v.created_at)
    ELSE NULL
  END
FROM public.resources r
WHERE r.id = v.resource_id
  AND v.status IS NULL;

ALTER TABLE public.resource_versions
  ALTER COLUMN status SET DEFAULT 'DRAFT',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.resource_versions
  DROP CONSTRAINT IF EXISTS resource_versions_status_check;
ALTER TABLE public.resource_versions
  ADD CONSTRAINT resource_versions_status_check
  CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED'));

ALTER TABLE public.resource_versions
  DROP CONSTRAINT IF EXISTS resource_versions_released_at_check;
ALTER TABLE public.resource_versions
  ADD CONSTRAINT resource_versions_released_at_check
  CHECK (
    (status = 'PUBLISHED' AND released_at IS NOT NULL)
    OR (status <> 'PUBLISHED' AND released_at IS NULL)
  );

ALTER TABLE public.resource_versions
  DROP CONSTRAINT IF EXISTS resource_versions_label_length;
ALTER TABLE public.resource_versions
  ADD CONSTRAINT resource_versions_label_length
  CHECK (version_label IS NULL OR length(trim(version_label)) BETWEEN 1 AND 80);

ALTER TABLE public.resource_versions
  DROP CONSTRAINT IF EXISTS resource_versions_changelog_length;
ALTER TABLE public.resource_versions
  ADD CONSTRAINT resource_versions_changelog_length
  CHECK (changelog IS NULL OR length(trim(changelog)) BETWEEN 1 AND 4000);

CREATE UNIQUE INDEX IF NOT EXISTS resource_versions_one_open_revision_idx
  ON public.resource_versions (resource_id)
  WHERE status IN ('DRAFT', 'PENDING_REVIEW');

CREATE INDEX IF NOT EXISTS resource_versions_resource_status_idx
  ON public.resource_versions (resource_id, status, version_number DESC);

ALTER TABLE public.resource_reviews
  ADD COLUMN IF NOT EXISTS version_id uuid REFERENCES public.resource_versions (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS resource_reviews_version_idx
  ON public.resource_reviews (version_id)
  WHERE version_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.storage_second_folder_uuid(object_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  folder text;
BEGIN
  folder := (storage.foldername(object_name))[2];
  IF folder IS NULL OR folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  RETURN folder::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.version_is_published_public(p_version_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_version_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.resource_versions v
      WHERE v.id = p_version_id
        AND v.status = 'PUBLISHED'
        AND public.resource_is_published_public(v.resource_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_version(p_version_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_version_id IS NOT NULL
    AND public.is_verified_user()
    AND EXISTS (
      SELECT 1
      FROM public.resource_versions v
      WHERE v.id = p_version_id
        AND v.status = 'DRAFT'
        AND (
          public.is_site_admin()
          OR public.can_manage_resource(v.resource_id)
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_upload_to_resource(p_resource_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    public.can_edit_resource(p_resource_id)
    OR EXISTS (
      SELECT 1
      FROM public.resource_versions v
      WHERE v.resource_id = p_resource_id
        AND public.can_edit_version(v.id)
    );
$$;

CREATE OR REPLACE FUNCTION public.upload_target_version_id(p_resource_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT v.id
  FROM public.resource_versions v
  WHERE v.resource_id = p_resource_id
    AND v.status = 'DRAFT'
  ORDER BY v.version_number DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_write_storage_object(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    public.can_edit_resource(public.storage_first_folder_uuid(object_name))
    OR public.can_edit_version(public.storage_second_folder_uuid(object_name));
$$;

REVOKE ALL ON FUNCTION public.storage_second_folder_uuid(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.version_is_published_public(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_edit_version(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_upload_to_resource(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upload_target_version_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_write_storage_object(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.storage_second_folder_uuid(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.version_is_published_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_version(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_to_resource(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upload_target_version_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_storage_object(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.resource_versions_freeze_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.resource_id IS DISTINCT FROM OLD.resource_id
     OR NEW.version_number IS DISTINCT FROM OLD.version_number
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'version identity cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resource_versions_freeze_identity ON public.resource_versions;
CREATE TRIGGER resource_versions_freeze_identity
BEFORE UPDATE ON public.resource_versions
FOR EACH ROW
EXECUTE FUNCTION public.resource_versions_freeze_identity();

REVOKE ALL ON FUNCTION public.resource_versions_freeze_identity() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 3. RLS — public reads released versions only
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS resource_versions_select ON public.resource_versions;
CREATE POLICY resource_versions_select ON public.resource_versions
  FOR SELECT TO anon, authenticated
  USING (
    (
      status = 'PUBLISHED'
      AND public.resource_is_published_public(resource_id)
    )
    OR public.can_manage_resource(resource_id)
    OR public.is_site_admin()
  );

DROP POLICY IF EXISTS resource_files_select ON public.resource_files;
CREATE POLICY resource_files_select ON public.resource_files
  FOR SELECT TO anon, authenticated
  USING (
    public.version_is_published_public(version_id)
    OR public.can_manage_resource(resource_id)
    OR public.is_site_admin()
  );

DROP POLICY IF EXISTS resource_versions_write ON public.resource_versions;
DROP POLICY IF EXISTS resource_versions_insert ON public.resource_versions;
DROP POLICY IF EXISTS resource_versions_update ON public.resource_versions;
DROP POLICY IF EXISTS resource_versions_delete ON public.resource_versions;

-- First version of a draft resource. Later revisions are created by RPC.
CREATE POLICY resource_versions_insert ON public.resource_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_edit_resource(resource_id)
    AND version_number = 1
    AND status = 'DRAFT'
    AND released_at IS NULL
  );

CREATE POLICY resource_versions_update ON public.resource_versions
  FOR UPDATE TO authenticated
  USING (public.can_edit_version(id))
  WITH CHECK (public.can_edit_version(id));

CREATE POLICY resource_versions_delete ON public.resource_versions
  FOR DELETE TO authenticated
  USING (public.can_edit_version(id) AND version_number > 1);

DROP POLICY IF EXISTS resource_files_write ON public.resource_files;
CREATE POLICY resource_files_write ON public.resource_files
  FOR ALL TO authenticated
  USING (public.can_edit_version(version_id))
  WITH CHECK (public.can_edit_version(version_id));

REVOKE UPDATE ON public.resource_versions FROM authenticated;
GRANT UPDATE (version_label, changelog) ON public.resource_versions TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Storage writes — draft version objects on published resources
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS storage_resource_files_insert ON storage.objects;
CREATE POLICY storage_resource_files_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'resource-files'
    AND public.is_verified_user()
    AND public.can_write_storage_object(name)
    AND public.has_open_upload_intent('resource-files', name)
  );

DROP POLICY IF EXISTS storage_resource_files_update ON storage.objects;
CREATE POLICY storage_resource_files_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'resource-files'
    AND public.is_verified_user()
    AND public.can_write_storage_object(name)
    AND public.has_open_upload_intent('resource-files', name)
  )
  WITH CHECK (
    bucket_id = 'resource-files'
    AND public.is_verified_user()
    AND public.can_write_storage_object(name)
    AND public.has_open_upload_intent('resource-files', name)
  );

DROP POLICY IF EXISTS storage_resource_files_delete ON storage.objects;
CREATE POLICY storage_resource_files_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'resource-files'
    AND public.can_write_storage_object(name)
  );

DROP POLICY IF EXISTS storage_tutorial_videos_insert ON storage.objects;
CREATE POLICY storage_tutorial_videos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tutorial-videos'
    AND public.is_verified_user()
    AND public.can_write_storage_object(name)
    AND public.has_open_upload_intent('tutorial-videos', name)
  );

DROP POLICY IF EXISTS storage_tutorial_videos_update ON storage.objects;
CREATE POLICY storage_tutorial_videos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tutorial-videos'
    AND public.is_verified_user()
    AND public.can_write_storage_object(name)
    AND public.has_open_upload_intent('tutorial-videos', name)
  )
  WITH CHECK (
    bucket_id = 'tutorial-videos'
    AND public.is_verified_user()
    AND public.can_write_storage_object(name)
    AND public.has_open_upload_intent('tutorial-videos', name)
  );

DROP POLICY IF EXISTS storage_tutorial_videos_delete ON storage.objects;
CREATE POLICY storage_tutorial_videos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'tutorial-videos'
    AND public.can_write_storage_object(name)
  );

-- ---------------------------------------------------------------------------
-- 5. Upload intents target the DRAFT version
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
  IF NOT public.can_upload_to_resource(p_resource_id) THEN
    RAISE EXCEPTION 'ftc:not_editable';
  END IF;

  v_version_id := public.upload_target_version_id(p_resource_id);
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
  JOIN public.resource_versions vv ON vv.id = f.version_id
  WHERE rr.author_id = auth.uid()
    AND (
      rr.status IN ('DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED')
      OR vv.status IN ('DRAFT', 'PENDING_REVIEW')
    );

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
     OR NOT public.can_upload_to_resource(intent.resource_id)
     OR NOT public.can_edit_version(intent.version_id) THEN
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
  JOIN public.resource_versions vv ON vv.id = f.version_id
  WHERE rr.author_id = auth.uid()
    AND (
      rr.status IN ('DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED')
      OR vv.status IN ('DRAFT', 'PENDING_REVIEW')
    );

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

CREATE OR REPLACE FUNCTION public.touch_upload_intent(p_storage_path text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  intent public.resource_upload_intents;
  next_expiry timestamptz;
BEGIN
  IF p_storage_path IS NULL OR btrim(p_storage_path) = '' THEN
    RAISE EXCEPTION 'ftc:upload_not_authorized';
  END IF;
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
  IF intent.status <> 'PENDING' THEN
    RAISE EXCEPTION 'ftc:upload_not_authorized';
  END IF;
  IF intent.expires_at <= now() THEN
    UPDATE public.resource_upload_intents
    SET status = 'EXPIRED'
    WHERE id = intent.id
      AND status = 'PENDING';
    RAISE EXCEPTION 'ftc:upload_expired';
  END IF;
  IF NOT public.can_manage_resource(intent.resource_id)
     OR NOT public.can_upload_to_resource(intent.resource_id)
     OR NOT public.can_edit_version(intent.version_id) THEN
    RAISE EXCEPTION 'ftc:not_editable';
  END IF;

  next_expiry := now() + make_interval(
    secs => public.upload_limit('upload_intent_ttl_seconds')
  );

  UPDATE public.resource_upload_intents
  SET expires_at = next_expiry
  WHERE id = intent.id
    AND status = 'PENDING';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ftc:upload_not_authorized';
  END IF;

  RETURN next_expiry;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. First-publish keeps version status in sync
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

  UPDATE public.resources
  SET status = 'PENDING_REVIEW',
      rights_acknowledged_at = now()
  WHERE id = p_resource_id;

  UPDATE public.resource_versions
  SET status = 'PENDING_REVIEW'
  WHERE resource_id = p_resource_id
    AND status = 'DRAFT';
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_resource_submission(p_resource_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_status text;
BEGIN
  IF NOT public.is_verified_user() THEN
    RAISE EXCEPTION 'ftc:verification_required';
  END IF;
  IF NOT public.can_manage_resource(p_resource_id) THEN
    RAISE EXCEPTION 'ftc:not_authorized';
  END IF;

  SELECT status INTO current_status
  FROM public.resources
  WHERE id = p_resource_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ftc:not_found';
  END IF;
  IF current_status <> 'PENDING_REVIEW' THEN
    RAISE EXCEPTION 'ftc:not_pending';
  END IF;

  UPDATE public.resources SET status = 'DRAFT' WHERE id = p_resource_id;

  UPDATE public.resource_versions
  SET status = 'DRAFT'
  WHERE resource_id = p_resource_id
    AND status = 'PENDING_REVIEW';
END;
$$;

CREATE OR REPLACE FUNCTION public.review_resource(
  p_resource_id uuid,
  p_decision text,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  r public.resources;
  clean_message text;
  submission_error text;
  next_status text;
BEGIN
  IF NOT public.is_site_admin() THEN
    RAISE EXCEPTION 'ftc:not_authorized';
  END IF;
  IF p_decision NOT IN ('APPROVED', 'CHANGES_REQUESTED', 'REJECTED') THEN
    RAISE EXCEPTION 'ftc:invalid_decision';
  END IF;

  clean_message := nullif(trim(coalesce(p_message, '')), '');
  IF p_decision <> 'APPROVED' AND (clean_message IS NULL OR length(clean_message) < 10) THEN
    RAISE EXCEPTION 'ftc:message_required';
  END IF;
  IF clean_message IS NOT NULL AND length(clean_message) > 2000 THEN
    RAISE EXCEPTION 'ftc:message_too_long';
  END IF;

  SELECT * INTO r FROM public.resources WHERE id = p_resource_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ftc:not_found';
  END IF;
  IF r.status <> 'PENDING_REVIEW' THEN
    RAISE EXCEPTION 'ftc:not_pending';
  END IF;

  IF p_decision = 'APPROVED' THEN
    submission_error := public.resource_submission_error(
      r.id,
      r.title,
      r.description,
      r.resource_type,
      r.category_id,
      r.license_id,
      r.rights_acknowledged_at
    );
    IF submission_error IS NOT NULL THEN
      RAISE EXCEPTION 'ftc:%', submission_error;
    END IF;

    next_status := 'PUBLISHED';
  ELSE
    next_status := p_decision;
  END IF;

  UPDATE public.resources SET status = next_status WHERE id = p_resource_id;

  IF p_decision = 'APPROVED' THEN
    UPDATE public.resource_versions
    SET status = 'PUBLISHED',
        released_at = coalesce(released_at, now())
    WHERE resource_id = p_resource_id
      AND status IN ('DRAFT', 'PENDING_REVIEW');
  ELSIF p_decision = 'CHANGES_REQUESTED' THEN
    UPDATE public.resource_versions
    SET status = 'DRAFT'
    WHERE resource_id = p_resource_id
      AND status = 'PENDING_REVIEW';
  END IF;

  INSERT INTO public.resource_reviews (resource_id, reviewer_id, decision, message)
  VALUES (p_resource_id, auth.uid(), p_decision, clean_message);
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Revision RPCs — resource stays PUBLISHED
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.start_resource_revision(
  p_resource_id uuid,
  p_version_label text,
  p_changelog text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  r public.resources;
  next_number integer;
  clean_label text;
  clean_changelog text;
  new_id uuid;
BEGIN
  IF NOT public.is_verified_user() THEN
    RAISE EXCEPTION 'ftc:verification_required';
  END IF;
  IF NOT public.can_manage_resource(p_resource_id) THEN
    RAISE EXCEPTION 'ftc:not_authorized';
  END IF;

  SELECT * INTO r FROM public.resources WHERE id = p_resource_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ftc:not_found';
  END IF;
  IF r.status <> 'PUBLISHED' THEN
    RAISE EXCEPTION 'ftc:not_published';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.resource_versions
    WHERE resource_id = p_resource_id
      AND status IN ('DRAFT', 'PENDING_REVIEW')
  ) THEN
    RAISE EXCEPTION 'ftc:revision_open';
  END IF;

  clean_label := nullif(trim(coalesce(p_version_label, '')), '');
  clean_changelog := nullif(trim(coalesce(p_changelog, '')), '');
  IF clean_label IS NOT NULL AND length(clean_label) > 80 THEN
    RAISE EXCEPTION 'ftc:label_too_long';
  END IF;
  IF clean_changelog IS NOT NULL AND length(clean_changelog) > 4000 THEN
    RAISE EXCEPTION 'ftc:changelog_too_long';
  END IF;

  SELECT coalesce(max(version_number), 0) + 1 INTO next_number
  FROM public.resource_versions
  WHERE resource_id = p_resource_id;

  INSERT INTO public.resource_versions (
    resource_id, version_number, version_label, changelog, status, created_by
  )
  VALUES (
    p_resource_id,
    next_number,
    coalesce(clean_label, 'v' || next_number::text),
    clean_changelog,
    'DRAFT',
    auth.uid()
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_resource_revision(p_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v public.resource_versions;
  r public.resources;
  file_count integer;
BEGIN
  IF NOT public.is_verified_user() THEN
    RAISE EXCEPTION 'ftc:verification_required';
  END IF;

  SELECT * INTO v FROM public.resource_versions WHERE id = p_version_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ftc:not_found';
  END IF;
  IF NOT public.can_manage_resource(v.resource_id) THEN
    RAISE EXCEPTION 'ftc:not_authorized';
  END IF;
  IF v.status <> 'DRAFT' OR v.version_number <= 1 THEN
    RAISE EXCEPTION 'ftc:not_editable';
  END IF;

  SELECT * INTO r FROM public.resources WHERE id = v.resource_id FOR UPDATE;
  IF r.status <> 'PUBLISHED' THEN
    RAISE EXCEPTION 'ftc:not_published';
  END IF;

  IF v.changelog IS NULL OR length(trim(v.changelog)) < 1 THEN
    RAISE EXCEPTION 'ftc:changelog_required';
  END IF;

  SELECT count(*) INTO file_count
  FROM public.resource_files
  WHERE version_id = v.id;
  IF file_count < 1 THEN
    RAISE EXCEPTION 'ftc:files_required';
  END IF;

  UPDATE public.resource_versions
  SET status = 'PENDING_REVIEW'
  WHERE id = v.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_resource_revision(p_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v public.resource_versions;
BEGIN
  IF NOT public.is_verified_user() THEN
    RAISE EXCEPTION 'ftc:verification_required';
  END IF;

  SELECT * INTO v FROM public.resource_versions WHERE id = p_version_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ftc:not_found';
  END IF;
  IF NOT public.can_manage_resource(v.resource_id) THEN
    RAISE EXCEPTION 'ftc:not_authorized';
  END IF;
  IF v.status <> 'PENDING_REVIEW' OR v.version_number <= 1 THEN
    RAISE EXCEPTION 'ftc:not_pending';
  END IF;

  UPDATE public.resource_versions
  SET status = 'DRAFT'
  WHERE id = v.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_resource_revision(
  p_version_id uuid,
  p_decision text,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v public.resource_versions;
  r public.resources;
  clean_message text;
BEGIN
  IF NOT public.is_site_admin() THEN
    RAISE EXCEPTION 'ftc:not_authorized';
  END IF;
  IF p_decision NOT IN ('APPROVED', 'CHANGES_REQUESTED', 'REJECTED') THEN
    RAISE EXCEPTION 'ftc:invalid_decision';
  END IF;

  clean_message := nullif(trim(coalesce(p_message, '')), '');
  IF p_decision <> 'APPROVED' AND (clean_message IS NULL OR length(clean_message) < 10) THEN
    RAISE EXCEPTION 'ftc:message_required';
  END IF;
  IF clean_message IS NOT NULL AND length(clean_message) > 2000 THEN
    RAISE EXCEPTION 'ftc:message_too_long';
  END IF;

  SELECT * INTO v FROM public.resource_versions WHERE id = p_version_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ftc:not_found';
  END IF;
  IF v.status <> 'PENDING_REVIEW' THEN
    RAISE EXCEPTION 'ftc:not_pending';
  END IF;

  SELECT * INTO r FROM public.resources WHERE id = v.resource_id FOR UPDATE;
  IF r.status <> 'PUBLISHED' THEN
    RAISE EXCEPTION 'ftc:not_published';
  END IF;

  IF p_decision = 'APPROVED' THEN
    IF NOT EXISTS (SELECT 1 FROM public.resource_files WHERE version_id = v.id) THEN
      RAISE EXCEPTION 'ftc:files_required';
    END IF;
    UPDATE public.resource_versions
    SET status = 'PUBLISHED',
        released_at = now()
    WHERE id = v.id;
    UPDATE public.resources SET updated_at = now() WHERE id = r.id;
  ELSIF p_decision = 'CHANGES_REQUESTED' THEN
    UPDATE public.resource_versions SET status = 'DRAFT' WHERE id = v.id;
  ELSE
    UPDATE public.resource_versions SET status = 'ARCHIVED' WHERE id = v.id;
  END IF;

  INSERT INTO public.resource_reviews (resource_id, version_id, reviewer_id, decision, message)
  VALUES (v.resource_id, v.id, auth.uid(), p_decision, clean_message);
END;
$$;

REVOKE ALL ON FUNCTION public.start_resource_revision(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_resource_revision(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.withdraw_resource_revision(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_resource_revision(uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.start_resource_revision(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_resource_revision(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_resource_revision(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_resource_revision(uuid, text, text) TO authenticated;
