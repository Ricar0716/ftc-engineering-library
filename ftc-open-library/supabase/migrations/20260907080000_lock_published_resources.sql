-- STEP 3.1: lock already-PUBLISHED resources for normal users, require
-- verification for content mutation, and align is_site_admin() with the
-- application model (verified email + site_admins row).
-- Download signed-URL architecture is unchanged.

CREATE OR REPLACE FUNCTION public.is_site_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    public.is_verified_user()
    AND EXISTS (
      SELECT 1
      FROM public.site_admins sa
      WHERE sa.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.resource_is_draft(p_resource_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_resource_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.resources r
      WHERE r.id = p_resource_id
        AND r.status = 'DRAFT'
    );
$$;

-- Verified Site Admin, or verified owner/team-admin of a DRAFT.
-- Does not recurse through RLS (SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.can_edit_resource(p_resource_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_resource_id IS NOT NULL
    AND public.is_verified_user()
    AND (
      public.is_site_admin()
      OR (
        public.can_manage_resource(p_resource_id)
        AND public.resource_is_draft(p_resource_id)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.resource_is_draft(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_edit_resource(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resource_is_draft(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_resource(uuid) TO authenticated;

-- Preserve team-assignment WITH CHECK from phase-1 hardening, but only for drafts.
DROP POLICY IF EXISTS resources_update ON public.resources;
CREATE POLICY resources_update ON public.resources
  FOR UPDATE TO authenticated
  USING (
    public.is_verified_user()
    AND (
      public.is_site_admin()
      OR (
        status = 'DRAFT'
        AND (
          author_id = auth.uid()
          OR (team_id IS NOT NULL AND public.is_team_admin(team_id))
        )
      )
    )
  )
  WITH CHECK (
    public.is_verified_user()
    AND (
      public.is_site_admin()
      OR (
        status = 'DRAFT'
        AND (
          (author_id = auth.uid() AND team_id IS NULL)
          OR (team_id IS NOT NULL AND public.is_team_admin(team_id))
        )
      )
    )
  );

DROP POLICY IF EXISTS resources_delete ON public.resources;
CREATE POLICY resources_delete ON public.resources
  FOR DELETE TO authenticated
  USING (
    public.is_verified_user()
    AND status = 'DRAFT'
    AND (
      public.is_site_admin()
      OR author_id = auth.uid()
      OR (team_id IS NOT NULL AND public.is_team_admin(team_id))
    )
  );

DROP POLICY IF EXISTS resource_versions_write ON public.resource_versions;
CREATE POLICY resource_versions_write ON public.resource_versions
  FOR ALL TO authenticated
  USING (public.can_edit_resource(resource_id))
  WITH CHECK (public.can_edit_resource(resource_id));

DROP POLICY IF EXISTS resource_files_write ON public.resource_files;
CREATE POLICY resource_files_write ON public.resource_files
  FOR ALL TO authenticated
  USING (public.can_edit_resource(resource_id))
  WITH CHECK (public.can_edit_resource(resource_id));

DROP POLICY IF EXISTS resource_tags_write ON public.resource_tags;
CREATE POLICY resource_tags_write ON public.resource_tags
  FOR ALL TO authenticated
  USING (public.can_edit_resource(resource_id))
  WITH CHECK (public.can_edit_resource(resource_id));

DROP POLICY IF EXISTS resource_hardware_write ON public.resource_hardware;
CREATE POLICY resource_hardware_write ON public.resource_hardware
  FOR ALL TO authenticated
  USING (public.can_edit_resource(resource_id))
  WITH CHECK (public.can_edit_resource(resource_id));

DROP POLICY IF EXISTS resource_relations_write ON public.resource_relations;
CREATE POLICY resource_relations_write ON public.resource_relations
  FOR ALL TO authenticated
  USING (public.can_edit_resource(source_resource_id))
  WITH CHECK (
    public.can_edit_resource(source_resource_id)
    AND source_resource_id <> target_resource_id
  );

DROP POLICY IF EXISTS storage_resource_files_write ON storage.objects;
CREATE POLICY storage_resource_files_write ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'resource-files'
    AND public.can_edit_resource(public.storage_first_folder_uuid(name))
  )
  WITH CHECK (
    bucket_id = 'resource-files'
    AND public.can_edit_resource(public.storage_first_folder_uuid(name))
  );

DROP POLICY IF EXISTS storage_previews_write ON storage.objects;
CREATE POLICY storage_previews_write ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id IN ('resource-previews', 'resource-thumbnails')
    AND public.can_edit_resource(public.storage_first_folder_uuid(name))
  )
  WITH CHECK (
    bucket_id IN ('resource-previews', 'resource-thumbnails')
    AND public.can_edit_resource(public.storage_first_folder_uuid(name))
  );
