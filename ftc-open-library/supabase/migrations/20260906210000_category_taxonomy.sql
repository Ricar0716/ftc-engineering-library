-- Hierarchical category taxonomy: extra fields, sibling slug uniqueness,
-- same-type parent, and cycle protection.
-- resources.category_id remains the primary category (ON DELETE SET NULL).
-- Prefer is_active = false over deleting categories referenced by resources.
-- Cycle walk is capped at 64 ancestors; application tree builders also cap depth.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_slug_unique;

CREATE UNIQUE INDEX IF NOT EXISTS categories_root_slug_unique
  ON public.categories (resource_type, slug)
  WHERE parent_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS categories_sibling_slug_unique
  ON public.categories (resource_type, parent_id, slug)
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS categories_type_active_idx
  ON public.categories (resource_type, is_active);

CREATE INDEX IF NOT EXISTS categories_parent_sort_idx
  ON public.categories (parent_id, sort_order, name);

DROP TRIGGER IF EXISTS categories_set_updated_at ON public.categories;
CREATE TRIGGER categories_set_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.categories_validate_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  parent_type text;
  found_id uuid;
BEGIN
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

REVOKE ALL ON FUNCTION public.categories_validate_hierarchy() FROM PUBLIC;

DROP TRIGGER IF EXISTS categories_validate_hierarchy ON public.categories;
CREATE TRIGGER categories_validate_hierarchy
BEFORE INSERT OR UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.categories_validate_hierarchy();
