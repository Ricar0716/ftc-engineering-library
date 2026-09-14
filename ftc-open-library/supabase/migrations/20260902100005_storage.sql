-- Storage buckets and policies.
-- Original files are private. Preview/thumbnail objects for published public
-- resources may be read without an account. Authenticated downloads of originals
-- are intended to use signed URLs in Phase 4; these policies are the backup control.

CREATE OR REPLACE FUNCTION public.storage_first_folder_uuid(object_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
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

REVOKE ALL ON FUNCTION public.storage_first_folder_uuid(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_first_folder_uuid(text) TO anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('resource-files', 'resource-files', false, 262144000),
  ('resource-previews', 'resource-previews', false, 52428800),
  ('resource-thumbnails', 'resource-thumbnails', false, 20971520),
  ('avatars', 'avatars', true, 5242880),
  ('team-logos', 'team-logos', true, 5242880)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY storage_resource_files_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'resource-files'
    AND (
      public.resource_is_published_public(public.storage_first_folder_uuid(name))
      OR public.can_manage_resource(public.storage_first_folder_uuid(name))
    )
  );

CREATE POLICY storage_resource_files_write ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'resource-files'
    AND public.can_manage_resource(public.storage_first_folder_uuid(name))
  )
  WITH CHECK (
    bucket_id = 'resource-files'
    AND public.can_manage_resource(public.storage_first_folder_uuid(name))
  );

CREATE POLICY storage_previews_select_public ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id IN ('resource-previews', 'resource-thumbnails')
    AND public.resource_is_published_public(public.storage_first_folder_uuid(name))
  );

CREATE POLICY storage_previews_select_manage ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('resource-previews', 'resource-thumbnails')
    AND public.can_manage_resource(public.storage_first_folder_uuid(name))
  );

CREATE POLICY storage_previews_write ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id IN ('resource-previews', 'resource-thumbnails')
    AND public.can_manage_resource(public.storage_first_folder_uuid(name))
  )
  WITH CHECK (
    bucket_id IN ('resource-previews', 'resource-thumbnails')
    AND public.can_manage_resource(public.storage_first_folder_uuid(name))
  );

CREATE POLICY storage_avatars_select ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY storage_avatars_write ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'avatars'
    AND public.storage_first_folder_uuid(name) = auth.uid()
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND public.storage_first_folder_uuid(name) = auth.uid()
  );

CREATE POLICY storage_team_logos_select ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'team-logos');

CREATE POLICY storage_team_logos_write ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'team-logos'
    AND public.is_team_admin(public.storage_first_folder_uuid(name))
  )
  WITH CHECK (
    bucket_id = 'team-logos'
    AND public.is_team_admin(public.storage_first_folder_uuid(name))
  );
