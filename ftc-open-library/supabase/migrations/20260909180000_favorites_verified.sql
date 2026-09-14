-- Favorites UI (STEP 7.1). Reuses public.favorites — no second table.
--
-- Inserts require a verified session and a published public resource.
-- Users may still DELETE their own rows if a resource is later unpublished;
-- listing joins PUBLISHED + PUBLIC so hidden work never appears.
--
-- Rollback:
--   DROP INDEX IF EXISTS public.favorites_user_created_at_idx;
--   DROP FUNCTION IF EXISTS public.list_own_published_favorites(integer, integer);
--   DROP FUNCTION IF EXISTS public.count_own_published_favorites();
--   Restore favorites_insert from 20260902100004_rls.sql.

DROP POLICY IF EXISTS favorites_insert ON public.favorites;
CREATE POLICY favorites_insert ON public.favorites
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_verified_user()
    AND public.resource_is_published_public(resource_id)
  );

-- Own-row listing ordered by save time. PK is (user_id, resource_id).
CREATE INDEX IF NOT EXISTS favorites_user_created_at_idx
  ON public.favorites (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.list_own_published_favorites(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(resource_id uuid, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT f.resource_id, f.created_at
  FROM public.favorites f
  INNER JOIN public.resources r ON r.id = f.resource_id
  WHERE f.user_id = auth.uid()
    AND r.status = 'PUBLISHED'
    AND r.visibility = 'PUBLIC'
  ORDER BY f.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION public.count_own_published_favorites()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.favorites f
  INNER JOIN public.resources r ON r.id = f.resource_id
  WHERE f.user_id = auth.uid()
    AND r.status = 'PUBLISHED'
    AND r.visibility = 'PUBLIC';
$$;

REVOKE ALL ON FUNCTION public.list_own_published_favorites(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_own_published_favorites() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_own_published_favorites(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_own_published_favorites() TO authenticated;
