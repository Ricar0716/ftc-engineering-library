-- Authorization helpers and Row Level Security.

CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
SET search_path = public
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
SET search_path = public
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
SET search_path = public
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
SET search_path = public
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
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (NEW.id, auth.uid(), 'OWNER');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER teams_assign_creator_owner
AFTER INSERT ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_team();

REVOKE ALL ON FUNCTION public.is_team_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_team_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_team_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resource_is_published_public(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_resource(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_team() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resource_is_published_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_resource(uuid) TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hardware ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_hardware ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;

-- Catalogs: public read, no client writes.
CREATE POLICY seasons_select ON public.seasons FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY categories_select ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY tags_select ON public.tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY hardware_select ON public.hardware FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY licenses_select ON public.licenses FOR SELECT TO anon, authenticated USING (true);

-- Profiles
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Teams
CREATE POLICY teams_select ON public.teams
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY teams_insert ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY teams_update ON public.teams
  FOR UPDATE TO authenticated
  USING (public.is_team_admin(id))
  WITH CHECK (public.is_team_admin(id));

CREATE POLICY teams_delete ON public.teams
  FOR DELETE TO authenticated
  USING (public.is_team_owner(id));

-- Team membership
CREATE POLICY team_members_select ON public.team_members
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY team_members_insert ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_team_admin(team_id)
    AND (role IN ('ADMIN', 'MEMBER') OR public.is_team_owner(team_id))
  );

CREATE POLICY team_members_update ON public.team_members
  FOR UPDATE TO authenticated
  USING (public.is_team_owner(team_id) OR (public.is_team_admin(team_id) AND role <> 'OWNER'))
  WITH CHECK (
    public.is_team_owner(team_id)
    OR (public.is_team_admin(team_id) AND role IN ('ADMIN', 'MEMBER'))
  );

CREATE POLICY team_members_delete ON public.team_members
  FOR DELETE TO authenticated
  USING (
    public.is_team_owner(team_id)
    OR (public.is_team_admin(team_id) AND role <> 'OWNER')
    OR (user_id = auth.uid() AND role <> 'OWNER')
  );

-- Resources
CREATE POLICY resources_select ON public.resources
  FOR SELECT TO anon, authenticated
  USING (
    (status = 'PUBLISHED' AND visibility = 'PUBLIC')
    OR author_id = auth.uid()
    OR (team_id IS NOT NULL AND public.is_team_admin(team_id))
  );

CREATE POLICY resources_insert ON public.resources
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (team_id IS NULL OR public.is_team_admin(team_id))
  );

CREATE POLICY resources_update ON public.resources
  FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    OR (team_id IS NOT NULL AND public.is_team_admin(team_id))
  )
  WITH CHECK (
    author_id = auth.uid()
    OR (team_id IS NOT NULL AND public.is_team_admin(team_id))
  );

CREATE POLICY resources_delete ON public.resources
  FOR DELETE TO authenticated
  USING (
    status = 'DRAFT'
    AND (
      author_id = auth.uid()
      OR (team_id IS NOT NULL AND public.is_team_admin(team_id))
    )
  );

-- Resource children
CREATE POLICY resource_versions_select ON public.resource_versions
  FOR SELECT TO anon, authenticated
  USING (
    public.resource_is_published_public(resource_id)
    OR public.can_manage_resource(resource_id)
  );

CREATE POLICY resource_versions_write ON public.resource_versions
  FOR ALL TO authenticated
  USING (public.can_manage_resource(resource_id))
  WITH CHECK (public.can_manage_resource(resource_id));

CREATE POLICY resource_files_select ON public.resource_files
  FOR SELECT TO anon, authenticated
  USING (
    public.resource_is_published_public(resource_id)
    OR public.can_manage_resource(resource_id)
  );

CREATE POLICY resource_files_write ON public.resource_files
  FOR ALL TO authenticated
  USING (public.can_manage_resource(resource_id))
  WITH CHECK (public.can_manage_resource(resource_id));

CREATE POLICY resource_tags_select ON public.resource_tags
  FOR SELECT TO anon, authenticated
  USING (
    public.resource_is_published_public(resource_id)
    OR public.can_manage_resource(resource_id)
  );

CREATE POLICY resource_tags_write ON public.resource_tags
  FOR ALL TO authenticated
  USING (public.can_manage_resource(resource_id))
  WITH CHECK (public.can_manage_resource(resource_id));

CREATE POLICY resource_hardware_select ON public.resource_hardware
  FOR SELECT TO anon, authenticated
  USING (
    public.resource_is_published_public(resource_id)
    OR public.can_manage_resource(resource_id)
  );

CREATE POLICY resource_hardware_write ON public.resource_hardware
  FOR ALL TO authenticated
  USING (public.can_manage_resource(resource_id))
  WITH CHECK (public.can_manage_resource(resource_id));

CREATE POLICY resource_relations_select ON public.resource_relations
  FOR SELECT TO anon, authenticated
  USING (
    (
      public.resource_is_published_public(source_resource_id)
      AND public.resource_is_published_public(target_resource_id)
    )
    OR public.can_manage_resource(source_resource_id)
  );

CREATE POLICY resource_relations_write ON public.resource_relations
  FOR ALL TO authenticated
  USING (public.can_manage_resource(source_resource_id))
  WITH CHECK (
    public.can_manage_resource(source_resource_id)
    AND source_resource_id <> target_resource_id
  );

-- Favorites
CREATE POLICY favorites_select ON public.favorites
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY favorites_insert ON public.favorites
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.resource_is_published_public(resource_id)
  );

CREATE POLICY favorites_delete ON public.favorites
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Ratings
CREATE POLICY ratings_select ON public.ratings
  FOR SELECT TO anon, authenticated
  USING (
    public.resource_is_published_public(resource_id)
    OR user_id = auth.uid()
  );

CREATE POLICY ratings_insert ON public.ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND rating BETWEEN 1 AND 5
    AND public.resource_is_published_public(resource_id)
  );

CREATE POLICY ratings_update ON public.ratings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND rating BETWEEN 1 AND 5
  );

CREATE POLICY ratings_delete ON public.ratings
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Comments
CREATE POLICY comments_select ON public.comments
  FOR SELECT TO anon, authenticated
  USING (
    (
      status = 'VISIBLE'
      AND public.resource_is_published_public(resource_id)
    )
    OR user_id = auth.uid()
    OR public.can_manage_resource(resource_id)
  );

CREATE POLICY comments_insert ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'VISIBLE'
    AND public.resource_is_published_public(resource_id)
  );

CREATE POLICY comments_update ON public.comments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY comments_delete ON public.comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Downloads: own rows only. Aggregates go through resource_stats.
CREATE POLICY downloads_select ON public.downloads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY downloads_insert ON public.downloads
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.resource_is_published_public(resource_id)
    AND EXISTS (
      SELECT 1
      FROM public.resource_files f
      WHERE f.id = file_id
        AND f.resource_id = downloads.resource_id
    )
  );

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON
  public.profiles,
  public.teams,
  public.team_members,
  public.seasons,
  public.categories,
  public.tags,
  public.hardware,
  public.licenses,
  public.resources,
  public.resource_versions,
  public.resource_files,
  public.resource_tags,
  public.resource_hardware,
  public.resource_relations,
  public.ratings,
  public.comments,
  public.resource_stats
TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.profiles,
  public.teams,
  public.team_members,
  public.resources,
  public.resource_versions,
  public.resource_files,
  public.resource_tags,
  public.resource_hardware,
  public.resource_relations,
  public.favorites,
  public.ratings,
  public.comments
TO authenticated;

GRANT SELECT, INSERT ON public.downloads TO authenticated;

