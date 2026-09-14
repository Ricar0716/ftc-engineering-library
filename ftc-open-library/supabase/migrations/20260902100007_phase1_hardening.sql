-- Phase 1.5 hardening: integrity, RLS, Storage, and SECURITY DEFINER search_path.
-- Additive only. Does not squash prior migrations.

-- ---------------------------------------------------------------------------
-- Helper search_path: pg_catalog first so public cannot shadow built-ins.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.team_members
      WHERE team_id = p_team_id
        AND user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.team_members
      WHERE team_id = p_team_id
        AND user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_team_owner(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.team_members
      WHERE team_id = p_team_id
        AND user_id = auth.uid()
        AND role = 'OWNER'
    );
$$;

CREATE OR REPLACE FUNCTION public.resource_is_published_public(p_resource_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.resources
    WHERE id = p_resource_id
      AND status = 'PUBLISHED'
      AND visibility = 'PUBLIC'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_resource(p_resource_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.resources r
    WHERE r.id = p_resource_id
      AND auth.uid() IS NOT NULL
      AND (
        r.author_id = auth.uid()
        OR (r.team_id IS NOT NULL AND public.is_team_admin(r.team_id))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (NEW.id, auth.uid(), 'OWNER');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  base_username text;
  final_username text;
  suffix integer := 0;
BEGIN
  base_username := lower(
    regexp_replace(
      coalesce(
        NEW.raw_user_meta_data ->> 'username',
        split_part(NEW.email, '@', 1),
        'user'
      ),
      '[^a-z0-9_]',
      '',
      'g'
    )
  );

  IF char_length(base_username) < 3 THEN
    base_username := 'user' || substr(replace(NEW.id::text, '-', ''), 1, 8);
  END IF;

  base_username := left(base_username, 32);
  final_username := base_username;

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := left(base_username, greatest(3, 32 - char_length(suffix::text) - 1))
      || '_'
      || suffix::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    final_username,
    nullif(NEW.raw_user_meta_data ->> 'display_name', '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.storage_first_folder_uuid(object_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  folder text;
BEGIN
  folder := (storage.foldername(object_name))[1];
  IF folder IS NULL OR folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  RETURN folder::uuid;
END;
$$;

REVOKE ALL ON FUNCTION public.is_team_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_team_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_team_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resource_is_published_public(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_resource(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_team() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.storage_first_folder_uuid(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resource_is_published_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_resource(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_first_folder_uuid(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- resource_files must reference a version of the same resource.
-- downloads.file_id must belong to downloads.resource_id.
-- ---------------------------------------------------------------------------

ALTER TABLE public.resource_versions
  ADD CONSTRAINT resource_versions_id_resource_id_key UNIQUE (id, resource_id);

ALTER TABLE public.resource_files
  ADD CONSTRAINT resource_files_version_matches_resource_fkey
  FOREIGN KEY (version_id, resource_id)
  REFERENCES public.resource_versions (id, resource_id)
  ON DELETE CASCADE;

ALTER TABLE public.resource_files
  ADD CONSTRAINT resource_files_id_resource_id_key UNIQUE (id, resource_id);

ALTER TABLE public.downloads
  ADD CONSTRAINT downloads_file_matches_resource_fkey
  FOREIGN KEY (file_id, resource_id)
  REFERENCES public.resource_files (id, resource_id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS resources_updated_at_idx
  ON public.resources (updated_at DESC);

-- ---------------------------------------------------------------------------
-- Immutable authorship and protected team assignment.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resources_freeze_author_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION 'author_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.resources_protect_team_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.team_id IS NOT DISTINCT FROM OLD.team_id THEN
    RETURN NEW;
  END IF;

  IF OLD.team_id IS NOT NULL AND NOT public.is_team_admin(OLD.team_id) THEN
    RAISE EXCEPTION 'only team admins can change team_id';
  END IF;

  IF NEW.team_id IS NOT NULL AND NOT public.is_team_admin(NEW.team_id) THEN
    RAISE EXCEPTION 'only team admins can assign team_id';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.resources_category_matches_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  category_type text;
BEGIN
  IF NEW.category_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.resource_type
  INTO category_type
  FROM public.categories c
  WHERE c.id = NEW.category_id;

  IF category_type IS DISTINCT FROM NEW.resource_type THEN
    RAISE EXCEPTION 'category resource_type must match resource.resource_type';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.comments_freeze_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.resource_id IS DISTINCT FROM OLD.resource_id THEN
    RAISE EXCEPTION 'comment user_id and resource_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ratings_freeze_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.resource_id IS DISTINCT FROM OLD.resource_id THEN
    RAISE EXCEPTION 'rating user_id and resource_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.resources_freeze_author_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resources_protect_team_assignment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resources_category_matches_type() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.comments_freeze_identity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ratings_freeze_identity() FROM PUBLIC;

DROP TRIGGER IF EXISTS resources_freeze_author_id ON public.resources;
CREATE TRIGGER resources_freeze_author_id
BEFORE UPDATE ON public.resources
FOR EACH ROW
EXECUTE FUNCTION public.resources_freeze_author_id();

DROP TRIGGER IF EXISTS resources_protect_team_assignment ON public.resources;
CREATE TRIGGER resources_protect_team_assignment
BEFORE UPDATE ON public.resources
FOR EACH ROW
EXECUTE FUNCTION public.resources_protect_team_assignment();

DROP TRIGGER IF EXISTS resources_category_matches_type ON public.resources;
CREATE TRIGGER resources_category_matches_type
BEFORE INSERT OR UPDATE ON public.resources
FOR EACH ROW
EXECUTE FUNCTION public.resources_category_matches_type();

DROP TRIGGER IF EXISTS comments_freeze_identity ON public.comments;
CREATE TRIGGER comments_freeze_identity
BEFORE UPDATE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.comments_freeze_identity();

DROP TRIGGER IF EXISTS ratings_freeze_identity ON public.ratings;
CREATE TRIGGER ratings_freeze_identity
BEFORE UPDATE ON public.ratings
FOR EACH ROW
EXECUTE FUNCTION public.ratings_freeze_identity();

-- Authors cannot attach a resource to an arbitrary team. Team admins still
-- manage team-owned rows, but cannot spoof author_id (trigger above).
DROP POLICY IF EXISTS resources_update ON public.resources;
CREATE POLICY resources_update ON public.resources
  FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    OR (team_id IS NOT NULL AND public.is_team_admin(team_id))
  )
  WITH CHECK (
    (author_id = auth.uid() AND team_id IS NULL)
    OR (team_id IS NOT NULL AND public.is_team_admin(team_id))
  );

-- ---------------------------------------------------------------------------
-- Original files stay private. Managers may still SELECT via the write policy
-- (FOR ALL). Phase 4 issues signed URLs with the admin client after authz.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS storage_resource_files_select ON storage.objects;
