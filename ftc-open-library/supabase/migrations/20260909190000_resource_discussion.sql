-- Engineering discussion (STEP 7.2). Reuses public.comments — no second table.
--
-- Adds one-level replies (parent_id), DELETED status, a body length cap,
-- verified inserts, author body edits, and Site Admin hide/restore.
-- Guests read VISIBLE rows on published public resources only.
--
-- Rollback:
--   DROP POLICY IF EXISTS comments_select ON public.comments;
--   DROP POLICY IF EXISTS comments_insert ON public.comments;
--   DROP POLICY IF EXISTS comments_update_own ON public.comments;
--   DROP POLICY IF EXISTS comments_update_admin ON public.comments;
--   Restore comments_* policies from 20260902100004_rls.sql.
--   DROP TRIGGER IF EXISTS comments_validate_parent ON public.comments;
--   DROP TRIGGER IF EXISTS comments_enforce_edit ON public.comments;
--   DROP FUNCTION IF EXISTS public.comments_validate_parent();
--   DROP FUNCTION IF EXISTS public.comments_enforce_edit();
--   Restore comments_freeze_identity() from 20260902100007_phase1_hardening.sql.
--   ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_parent_id_fkey;
--   ALTER TABLE public.comments DROP COLUMN IF EXISTS parent_id;
--   Restore comments_status_check / comments_body_not_blank.

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS parent_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comments_parent_id_fkey'
      AND conrelid = 'public.comments'::regclass
  ) THEN
    ALTER TABLE public.comments
      ADD CONSTRAINT comments_parent_id_fkey
      FOREIGN KEY (parent_id) REFERENCES public.comments (id) ON DELETE CASCADE;
  END IF;
END
$$;

ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_parent_not_self;
ALTER TABLE public.comments
  ADD CONSTRAINT comments_parent_not_self
  CHECK (parent_id IS NULL OR parent_id <> id);

ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_status_check;
ALTER TABLE public.comments
  ADD CONSTRAINT comments_status_check
  CHECK (status IN ('VISIBLE', 'HIDDEN', 'DELETED'));

ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_body_not_blank;
ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_body_length;
ALTER TABLE public.comments
  ADD CONSTRAINT comments_body_length
  CHECK (length(trim(body)) BETWEEN 1 AND 4000);

CREATE INDEX IF NOT EXISTS comments_resource_roots_created_idx
  ON public.comments (resource_id, created_at ASC)
  WHERE parent_id IS NULL;

CREATE INDEX IF NOT EXISTS comments_parent_created_idx
  ON public.comments (parent_id, created_at ASC)
  WHERE parent_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.comments_validate_parent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  parent_resource uuid;
  parent_parent uuid;
  parent_status text;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'ftc:invalid_parent';
  END IF;

  SELECT c.resource_id, c.parent_id, c.status
    INTO parent_resource, parent_parent, parent_status
  FROM public.comments c
  WHERE c.id = NEW.parent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ftc:invalid_parent';
  END IF;

  IF parent_resource IS DISTINCT FROM NEW.resource_id THEN
    RAISE EXCEPTION 'ftc:parent_resource_mismatch';
  END IF;

  IF parent_parent IS NOT NULL THEN
    RAISE EXCEPTION 'ftc:nested_reply';
  END IF;

  IF parent_status IS DISTINCT FROM 'VISIBLE' THEN
    RAISE EXCEPTION 'ftc:parent_not_visible';
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
     OR NEW.resource_id IS DISTINCT FROM OLD.resource_id
     OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'comment identity cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.comments_enforce_edit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  body_changed boolean;
  status_changed boolean;
BEGIN
  body_changed := NEW.body IS DISTINCT FROM OLD.body;
  status_changed := NEW.status IS DISTINCT FROM OLD.status;

  IF body_changed AND status_changed THEN
    RAISE EXCEPTION 'cannot change comment body and status together';
  END IF;

  IF body_changed THEN
    IF NEW.user_id IS DISTINCT FROM auth.uid()
       OR OLD.status IS DISTINCT FROM 'VISIBLE' THEN
      RAISE EXCEPTION 'only the author can edit a visible comment';
    END IF;
    RETURN NEW;
  END IF;

  IF status_changed THEN
    IF NOT public.is_site_admin() THEN
      RAISE EXCEPTION 'only a site admin can change comment status';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.comments_validate_parent() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.comments_freeze_identity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.comments_enforce_edit() FROM PUBLIC;

DROP TRIGGER IF EXISTS comments_validate_parent ON public.comments;
CREATE TRIGGER comments_validate_parent
BEFORE INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.comments_validate_parent();

DROP TRIGGER IF EXISTS comments_freeze_identity ON public.comments;
CREATE TRIGGER comments_freeze_identity
BEFORE UPDATE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.comments_freeze_identity();

DROP TRIGGER IF EXISTS comments_enforce_edit ON public.comments;
CREATE TRIGGER comments_enforce_edit
BEFORE UPDATE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.comments_enforce_edit();

DROP POLICY IF EXISTS comments_select ON public.comments;
DROP POLICY IF EXISTS comments_insert ON public.comments;
DROP POLICY IF EXISTS comments_update ON public.comments;
DROP POLICY IF EXISTS comments_update_own ON public.comments;
DROP POLICY IF EXISTS comments_update_admin ON public.comments;
DROP POLICY IF EXISTS comments_delete ON public.comments;

-- Guests: VISIBLE on published public resources.
-- Authors: own rows on those same published resources (including HIDDEN).
-- Site Admins: any row, including unpublished, so hide/restore never leaks drafts.
CREATE POLICY comments_select ON public.comments
  FOR SELECT TO anon, authenticated
  USING (
    public.is_site_admin()
    OR (
      public.resource_is_published_public(resource_id)
      AND (
        status = 'VISIBLE'
        OR user_id = auth.uid()
      )
    )
  );

CREATE POLICY comments_insert ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_verified_user()
    AND status = 'VISIBLE'
    AND public.resource_is_published_public(resource_id)
  );

CREATE POLICY comments_update_own ON public.comments
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND public.is_verified_user()
    AND status = 'VISIBLE'
    AND public.resource_is_published_public(resource_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'VISIBLE'
    AND public.resource_is_published_public(resource_id)
  );

CREATE POLICY comments_update_admin ON public.comments
  FOR UPDATE TO authenticated
  USING (public.is_site_admin())
  WITH CHECK (public.is_site_admin());
