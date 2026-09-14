-- STEP 8.1.3.1: version review attribution, submission time, and audit delete protection.
--
-- Does not change resource status, published versions, Storage, or first-publish
-- resource moderation. resource_reviews.version_id stays ON DELETE SET NULL so a
-- resource-level CASCADE cannot deadlock; contributors still cannot hard-delete
-- a version that has version-specific review rows.

-- ---------------------------------------------------------------------------
-- 1. submitted_at
-- ---------------------------------------------------------------------------

ALTER TABLE public.resource_versions
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

COMMENT ON COLUMN public.resource_versions.submitted_at IS
  'Most recent submit_resource_revision() time. NULL until the version enters PENDING_REVIEW. created_at is draft creation, not submission.';

-- Legacy backfill, in order of preference:
-- 1) earliest version-specific resource_reviews.created_at
-- 2) created_at for versions that already left an unsubmitted DRAFT
-- Untouched drafts stay NULL. Exact historical submission time cannot be
-- reconstructed; do not treat backfilled values as more precise than that.
UPDATE public.resource_versions v
SET submitted_at = coalesce(
  (
    SELECT min(rr.created_at)
    FROM public.resource_reviews rr
    WHERE rr.version_id = v.id
  ),
  CASE
    WHEN v.status IN ('PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED') THEN v.created_at
    ELSE NULL
  END
)
WHERE v.submitted_at IS NULL;

CREATE INDEX IF NOT EXISTS resource_versions_review_queue_idx
  ON public.resource_versions (submitted_at ASC NULLS LAST)
  WHERE status = 'PENDING_REVIEW';

CREATE OR REPLACE FUNCTION public.resource_versions_protect_submitted_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.submitted_at := NULL;
    RETURN NEW;
  END IF;

  -- Clients cannot choose this timestamp. Only DRAFT → PENDING_REVIEW writes it,
  -- and the value is always now() from this trigger.
  IF NEW.status = 'PENDING_REVIEW' AND OLD.status = 'DRAFT' THEN
    NEW.submitted_at := now();
  ELSE
    NEW.submitted_at := OLD.submitted_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resource_versions_protect_submitted_at ON public.resource_versions;
CREATE TRIGGER resource_versions_protect_submitted_at
BEFORE INSERT OR UPDATE ON public.resource_versions
FOR EACH ROW
EXECUTE FUNCTION public.resource_versions_protect_submitted_at();

REVOKE ALL ON FUNCTION public.resource_versions_protect_submitted_at() FROM PUBLIC;

-- authenticated still cannot UPDATE submitted_at directly.
REVOKE UPDATE ON public.resource_versions FROM authenticated;
GRANT UPDATE (version_label, changelog) ON public.resource_versions TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Trusted submit path (resubmission refreshes submitted_at via the trigger)
-- ---------------------------------------------------------------------------

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

REVOKE ALL ON FUNCTION public.submit_resource_revision(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_resource_revision(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Reviewed versions cannot be hard-deleted
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_delete_version(p_version_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_version_id IS NOT NULL
    AND public.can_edit_version(p_version_id)
    AND EXISTS (
      SELECT 1
      FROM public.resource_versions v
      WHERE v.id = p_version_id
        AND v.version_number > 1
        AND NOT EXISTS (
          SELECT 1
          FROM public.resource_reviews rr
          WHERE rr.version_id = v.id
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_delete_version(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_delete_version(uuid) TO authenticated;

DROP POLICY IF EXISTS resource_versions_delete ON public.resource_versions;
CREATE POLICY resource_versions_delete ON public.resource_versions
  FOR DELETE TO authenticated
  USING (public.can_delete_version(id));

CREATE OR REPLACE FUNCTION public.resource_versions_protect_reviewed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Direct deletes of a reviewed version are blocked while the parent resource
  -- still exists. CASCADE from deleting the resource is allowed: the parent row
  -- is already gone, and resource_reviews.resource_id also cascades.
  IF EXISTS (
    SELECT 1 FROM public.resources WHERE id = OLD.resource_id
  ) AND EXISTS (
    SELECT 1 FROM public.resource_reviews WHERE version_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'ftc:version_has_reviews';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS resource_versions_protect_reviewed ON public.resource_versions;
CREATE TRIGGER resource_versions_protect_reviewed
BEFORE DELETE ON public.resource_versions
FOR EACH ROW
EXECUTE FUNCTION public.resource_versions_protect_reviewed();

REVOKE ALL ON FUNCTION public.resource_versions_protect_reviewed() FROM PUBLIC;
