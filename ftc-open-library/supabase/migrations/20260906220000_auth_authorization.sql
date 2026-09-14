-- Authentication / authorization foundation.
-- Site Admin is distinct from Team OWNER / ADMIN / MEMBER.
-- Original resource files are not anonymously downloadable; verified users
-- receive short-lived signed URLs from the application server.

CREATE OR REPLACE FUNCTION public.is_verified_user()
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
      FROM auth.users u
      WHERE u.id = auth.uid()
        AND u.email_confirmed_at IS NOT NULL
    );
$$;

CREATE TABLE public.site_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.is_site_admin()
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
      FROM public.site_admins sa
      WHERE sa.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.resources_prevent_self_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Seed, migrations, and service-role clients have no JWT.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.status = 'PUBLISHED' AND NOT public.is_site_admin() THEN
    RAISE EXCEPTION 'resources must be submitted as drafts for review';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.status = 'PUBLISHED'
     AND OLD.status IS DISTINCT FROM 'PUBLISHED'
     AND NOT public.is_site_admin() THEN
    RAISE EXCEPTION 'only site admins can publish resources';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resources_prevent_self_publish ON public.resources;
CREATE TRIGGER resources_prevent_self_publish
BEFORE INSERT OR UPDATE ON public.resources
FOR EACH ROW
EXECUTE FUNCTION public.resources_prevent_self_publish();

REVOKE ALL ON FUNCTION public.is_verified_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_site_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resources_prevent_self_publish() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_verified_user() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_site_admin() TO anon, authenticated;

ALTER TABLE public.site_admins ENABLE ROW LEVEL SECURITY;

-- Admins may read membership. Nobody can insert/update/delete via RLS.
-- Bootstrap and later promotions use the SQL editor or service role.
CREATE POLICY site_admins_select ON public.site_admins
  FOR SELECT TO authenticated
  USING (public.is_site_admin());

GRANT SELECT ON public.site_admins TO authenticated;

DROP POLICY IF EXISTS resources_insert ON public.resources;
CREATE POLICY resources_insert ON public.resources
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_verified_user()
    AND (team_id IS NULL OR public.is_team_admin(team_id))
    AND (status = 'DRAFT' OR public.is_site_admin())
  );

DROP POLICY IF EXISTS downloads_insert ON public.downloads;
CREATE POLICY downloads_insert ON public.downloads
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_verified_user()
    AND public.resource_is_published_public(resource_id)
    AND EXISTS (
      SELECT 1
      FROM public.resource_files f
      WHERE f.id = file_id
        AND f.resource_id = downloads.resource_id
    )
  );

DROP POLICY IF EXISTS storage_resource_files_select ON storage.objects;
CREATE POLICY storage_resource_files_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'resource-files'
    AND public.can_manage_resource(public.storage_first_folder_uuid(name))
    AND public.is_verified_user()
  );

DROP POLICY IF EXISTS storage_resource_files_write ON storage.objects;
CREATE POLICY storage_resource_files_write ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'resource-files'
    AND public.can_manage_resource(public.storage_first_folder_uuid(name))
    AND public.is_verified_user()
  )
  WITH CHECK (
    bucket_id = 'resource-files'
    AND public.can_manage_resource(public.storage_first_folder_uuid(name))
    AND public.is_verified_user()
  );
