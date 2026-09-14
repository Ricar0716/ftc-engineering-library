-- STEP 4: Site-Admin category taxonomy writes.
-- Public SELECT is unchanged. Authenticated writes require is_site_admin().
-- resource_type cannot change after insert. Hard delete is blocked when
-- children or resources still reference the row. Published resource RLS
-- is not modified.

GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;

CREATE POLICY categories_insert ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (public.is_site_admin());

CREATE POLICY categories_update ON public.categories
  FOR UPDATE TO authenticated
  USING (public.is_site_admin())
  WITH CHECK (public.is_site_admin());

CREATE POLICY categories_delete ON public.categories
  FOR DELETE TO authenticated
  USING (public.is_site_admin());

CREATE OR REPLACE FUNCTION public.categories_validate_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  parent_type text;
  found_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.resource_type IS DISTINCT FROM OLD.resource_type THEN
    RAISE EXCEPTION 'category resource_type cannot be changed';
  END IF;

  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'category cannot be its own parent';
  END IF;

  SELECT c.resource_type
  INTO parent_type
  FROM public.categories c
  WHERE c.id = NEW.parent_id;

  IF parent_type IS NULL THEN
    RAISE EXCEPTION 'parent category does not exist';
  END IF;

  IF parent_type IS DISTINCT FROM NEW.resource_type THEN
    RAISE EXCEPTION 'child category resource_type must match parent';
  END IF;

  WITH RECURSIVE ancestors AS (
    SELECT c.parent_id AS id, 1 AS depth
    FROM public.categories c
    WHERE c.id = NEW.parent_id
    UNION ALL
    SELECT c.parent_id, a.depth + 1
    FROM public.categories c
    INNER JOIN ancestors a ON c.id = a.id
    WHERE c.parent_id IS NOT NULL
      AND a.depth < 64
  )
  SELECT a.id
  INTO found_id
  FROM ancestors a
  WHERE a.id = NEW.id
  LIMIT 1;

  IF found_id IS NOT NULL THEN
    RAISE EXCEPTION 'category parent would create a cycle';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.categories_prevent_unsafe_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.categories c
    WHERE c.parent_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'category has child categories';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.resources r
    WHERE r.category_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'category is referenced by resources';
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.categories_prevent_unsafe_delete() FROM PUBLIC;

DROP TRIGGER IF EXISTS categories_prevent_unsafe_delete ON public.categories;
CREATE TRIGGER categories_prevent_unsafe_delete
BEFORE DELETE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.categories_prevent_unsafe_delete();

-- Count every resource pointing at this category, including drafts.
-- Non-admins receive 0 so the helper cannot be used as a catalog leak.
CREATE OR REPLACE FUNCTION public.category_resource_count(p_category_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN p_category_id IS NULL OR NOT public.is_site_admin() THEN 0
    ELSE (
      SELECT COUNT(*)::integer
      FROM public.resources r
      WHERE r.category_id = p_category_id
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.category_resource_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.category_resource_count(uuid) TO authenticated;
