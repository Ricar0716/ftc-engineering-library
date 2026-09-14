-- STEP 5: community resource submission + moderation.
--
-- Adds the PENDING_REVIEW / CHANGES_REQUESTED / REJECTED states, a review audit
-- trail, server-controlled moderation timestamps, and a database-level state
-- machine. STEP 3.1 published-content protections are preserved: contributors
-- still cannot mutate PUBLISHED resources, their child rows, or their Storage
-- objects. Original files stay in the private `resource-files` bucket.

-- ---------------------------------------------------------------------------
-- 1. Status model and moderation timestamps
-- ---------------------------------------------------------------------------

ALTER TABLE public.resources
  DROP CONSTRAINT IF EXISTS resources_status_check;

ALTER TABLE public.resources
  ADD CONSTRAINT resources_status_check CHECK (
    status IN (
      'DRAFT',
      'PENDING_REVIEW',
      'CHANGES_REQUESTED',
      'PUBLISHED',
      'REJECTED',
      'ARCHIVED'
    )
  );

ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rights_acknowledged_at timestamptz;

CREATE INDEX IF NOT EXISTS resources_review_queue_idx
  ON public.resources (submitted_at ASC)
  WHERE status = 'PENDING_REVIEW';

CREATE INDEX IF NOT EXISTS resources_author_status_idx
  ON public.resources (author_id, updated_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Review audit trail
--
-- Rows are only written by review_resource(). No INSERT/UPDATE/DELETE grant is
-- issued to `authenticated`, so history cannot be forged or rewritten from the
-- client even with a stolen anon key.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.resource_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources (id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  decision text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resource_reviews_decision_check CHECK (
    decision IN ('APPROVED', 'CHANGES_REQUESTED', 'REJECTED')
  ),
  CONSTRAINT resource_reviews_message_required CHECK (
    decision = 'APPROVED'
    OR (message IS NOT NULL AND length(trim(message)) >= 10)
  ),
  CONSTRAINT resource_reviews_message_length CHECK (
    message IS NULL OR length(message) <= 2000
  )
);

CREATE INDEX IF NOT EXISTS resource_reviews_resource_idx
  ON public.resource_reviews (resource_id, created_at DESC);

ALTER TABLE public.resource_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resource_reviews_select ON public.resource_reviews;
CREATE POLICY resource_reviews_select ON public.resource_reviews
  FOR SELECT TO authenticated
  USING (
    public.is_site_admin()
    OR public.can_manage_resource(resource_id)
  );

GRANT SELECT ON public.resource_reviews TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Editable-state helpers
--
-- can_edit_resource() keeps its STEP 3.1 shape and only widens the editable
-- state set from DRAFT to DRAFT + CHANGES_REQUESTED. Every child-table and
-- Storage policy created in STEP 3.1 already routes through it, so PENDING_REVIEW,
-- PUBLISHED, REJECTED, and ARCHIVED stay frozen for contributors.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resource_is_editable(p_resource_id uuid)
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
        AND r.status IN ('DRAFT', 'CHANGES_REQUESTED')
    );
$$;

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
        AND public.resource_is_editable(p_resource_id)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.resource_is_editable(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_edit_resource(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resource_is_editable(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_resource(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Publication readiness
--
-- One definition of "complete enough to be public", used by the transition
-- trigger, the submission RPC, and the approval path. Returns an error code or
-- NULL. Values are passed in so the trigger can check the row it is about to
-- write rather than the committed one.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resource_submission_error(
  p_resource_id uuid,
  p_title text,
  p_description text,
  p_resource_type text,
  p_category_id uuid,
  p_license_id uuid,
  p_rights_acknowledged_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  ok boolean;
BEGIN
  IF length(trim(coalesce(p_title, ''))) < 6 THEN
    RETURN 'title_too_short';
  END IF;
  IF length(trim(coalesce(p_description, ''))) < 60 THEN
    RETURN 'description_too_short';
  END IF;
  IF p_license_id IS NULL THEN
    RETURN 'license_required';
  END IF;
  IF p_rights_acknowledged_at IS NULL THEN
    RETURN 'rights_required';
  END IF;

  -- A resource type with no active categories is a valid state, so a category
  -- is only required once the taxonomy offers one.
  IF p_category_id IS NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.resource_type = p_resource_type AND c.is_active
    ) INTO ok;
    IF ok THEN
      RETURN 'category_required';
    END IF;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.id = p_category_id
        AND c.is_active
        AND c.resource_type = p_resource_type
    ) INTO ok;
    IF NOT ok THEN
      RETURN 'category_invalid';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.resource_files f WHERE f.resource_id = p_resource_id
  ) THEN
    RETURN 'files_required';
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.resource_submission_error(uuid, text, text, text, uuid, uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resource_submission_error(uuid, text, text, text, uuid, uuid, timestamptz) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Status state machine
--
-- Frontend buttons are not the control. Any client calling the Supabase REST
-- API directly hits this trigger.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resources_enforce_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  acting_admin boolean;
  submission_error text;
BEGIN
  -- Service-role and migration contexts have no auth.uid(). Seeding and the
  -- SECURITY DEFINER moderation RPCs below still run their own checks.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  acting_admin := public.is_site_admin();

  IF TG_OP = 'INSERT' THEN
    IF NOT acting_admin AND NEW.status <> 'DRAFT' THEN
      RAISE EXCEPTION 'ftc:draft_required';
    END IF;
    NEW.submitted_at := NULL;
    NEW.reviewed_at := NULL;
    IF NEW.status <> 'PUBLISHED' THEN
      NEW.published_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT acting_admin THEN
    IF OLD.status IN ('PUBLISHED', 'REJECTED', 'ARCHIVED') THEN
      RAISE EXCEPTION 'ftc:not_editable (status %)', OLD.status;
    END IF;

    -- A submission under review is frozen. The only contributor-visible change
    -- is withdrawing it back to DRAFT, with no content edits attached.
    IF OLD.status = 'PENDING_REVIEW' THEN
      IF NEW.status <> 'DRAFT' THEN
        RAISE EXCEPTION 'ftc:pending_frozen';
      END IF;
      IF NEW.title IS DISTINCT FROM OLD.title
        OR NEW.slug IS DISTINCT FROM OLD.slug
        OR NEW.resource_type IS DISTINCT FROM OLD.resource_type
        OR NEW.description IS DISTINCT FROM OLD.description
        OR NEW.category_id IS DISTINCT FROM OLD.category_id
        OR NEW.season_id IS DISTINCT FROM OLD.season_id
        OR NEW.license_id IS DISTINCT FROM OLD.license_id
        OR NEW.team_id IS DISTINCT FROM OLD.team_id
        OR NEW.thumbnail_url IS DISTINCT FROM OLD.thumbnail_url
        OR NEW.preview_url IS DISTINCT FROM OLD.preview_url
        OR NEW.visibility IS DISTINCT FROM OLD.visibility
        OR NEW.parent_resource_id IS DISTINCT FROM OLD.parent_resource_id
      THEN
        RAISE EXCEPTION 'ftc:pending_frozen';
      END IF;
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF acting_admin THEN
      IF NOT (
        (OLD.status IN ('DRAFT', 'CHANGES_REQUESTED') AND NEW.status = 'PENDING_REVIEW')
        OR (
          OLD.status = 'PENDING_REVIEW'
          AND NEW.status IN ('DRAFT', 'PUBLISHED', 'CHANGES_REQUESTED', 'REJECTED')
        )
        OR (OLD.status = 'PUBLISHED' AND NEW.status = 'ARCHIVED')
        OR (OLD.status = 'ARCHIVED' AND NEW.status = 'PUBLISHED')
      ) THEN
        RAISE EXCEPTION 'ftc:invalid_transition (% to %)', OLD.status, NEW.status;
      END IF;
    ELSE
      IF NOT (
        (OLD.status IN ('DRAFT', 'CHANGES_REQUESTED') AND NEW.status = 'PENDING_REVIEW')
        OR (OLD.status = 'PENDING_REVIEW' AND NEW.status = 'DRAFT')
      ) THEN
        RAISE EXCEPTION 'ftc:invalid_transition (% to %)', OLD.status, NEW.status;
      END IF;
    END IF;
  END IF;

  -- Nothing incomplete reaches the review queue, however it was submitted.
  IF NEW.status = 'PENDING_REVIEW' AND OLD.status IS DISTINCT FROM 'PENDING_REVIEW' THEN
    submission_error := public.resource_submission_error(
      NEW.id,
      NEW.title,
      NEW.description,
      NEW.resource_type,
      NEW.category_id,
      NEW.license_id,
      NEW.rights_acknowledged_at
    );
    IF submission_error IS NOT NULL THEN
      RAISE EXCEPTION 'ftc:%', submission_error;
    END IF;
  END IF;

  -- Moderation timestamps are derived here, never accepted from a client.
  NEW.submitted_at := OLD.submitted_at;
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.published_at := OLD.published_at;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'PENDING_REVIEW' THEN
      NEW.submitted_at := now();
    ELSIF NEW.status = 'DRAFT' THEN
      NEW.submitted_at := NULL;
    ELSIF NEW.status = 'PUBLISHED' THEN
      NEW.reviewed_at := now();
      NEW.published_at := coalesce(OLD.published_at, now());
    ELSIF NEW.status IN ('CHANGES_REQUESTED', 'REJECTED') THEN
      NEW.reviewed_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.resources_enforce_status_transition() FROM PUBLIC;

DROP TRIGGER IF EXISTS resources_enforce_status_transition ON public.resources;
CREATE TRIGGER resources_enforce_status_transition
BEFORE INSERT OR UPDATE ON public.resources
FOR EACH ROW
EXECUTE FUNCTION public.resources_enforce_status_transition();

-- ---------------------------------------------------------------------------
-- 6. Resource RLS
-- ---------------------------------------------------------------------------

-- Site Admins need to read submissions to moderate them. Guests and unrelated
-- users still only see PUBLISHED + PUBLIC rows.
DROP POLICY IF EXISTS resources_select ON public.resources;
CREATE POLICY resources_select ON public.resources
  FOR SELECT TO anon, authenticated
  USING (
    (status = 'PUBLISHED' AND visibility = 'PUBLIC')
    OR author_id = auth.uid()
    OR (team_id IS NOT NULL AND public.is_team_admin(team_id))
    OR public.is_site_admin()
  );

DROP POLICY IF EXISTS resources_update ON public.resources;
CREATE POLICY resources_update ON public.resources
  FOR UPDATE TO authenticated
  USING (
    public.is_verified_user()
    AND (
      public.is_site_admin()
      OR (
        status IN ('DRAFT', 'CHANGES_REQUESTED', 'PENDING_REVIEW')
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
        status IN ('DRAFT', 'CHANGES_REQUESTED', 'PENDING_REVIEW')
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
    AND (
      (public.is_site_admin() AND status <> 'PUBLISHED')
      OR (
        status IN ('DRAFT', 'CHANGES_REQUESTED')
        AND (
          author_id = auth.uid()
          OR (team_id IS NOT NULL AND public.is_team_admin(team_id))
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Child-table reads for reviewers
--
-- Write policies still use can_edit_resource() from STEP 3.1 and are untouched.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS resource_versions_select ON public.resource_versions;
CREATE POLICY resource_versions_select ON public.resource_versions
  FOR SELECT TO anon, authenticated
  USING (
    public.resource_is_published_public(resource_id)
    OR public.can_manage_resource(resource_id)
    OR public.is_site_admin()
  );

DROP POLICY IF EXISTS resource_files_select ON public.resource_files;
CREATE POLICY resource_files_select ON public.resource_files
  FOR SELECT TO anon, authenticated
  USING (
    public.resource_is_published_public(resource_id)
    OR public.can_manage_resource(resource_id)
    OR public.is_site_admin()
  );

DROP POLICY IF EXISTS resource_tags_select ON public.resource_tags;
CREATE POLICY resource_tags_select ON public.resource_tags
  FOR SELECT TO anon, authenticated
  USING (
    public.resource_is_published_public(resource_id)
    OR public.can_manage_resource(resource_id)
    OR public.is_site_admin()
  );

DROP POLICY IF EXISTS resource_hardware_select ON public.resource_hardware;
CREATE POLICY resource_hardware_select ON public.resource_hardware
  FOR SELECT TO anon, authenticated
  USING (
    public.resource_is_published_public(resource_id)
    OR public.can_manage_resource(resource_id)
    OR public.is_site_admin()
  );

-- ---------------------------------------------------------------------------
-- 8. Storage
--
-- Originals stay private. Reviewers gain read access to submitted objects;
-- writes remain limited to editable resources through can_edit_resource().
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS storage_resource_files_select ON storage.objects;
CREATE POLICY storage_resource_files_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'resource-files'
    AND public.is_verified_user()
    AND (
      public.is_site_admin()
      OR public.can_manage_resource(public.storage_first_folder_uuid(name))
    )
  );

DROP POLICY IF EXISTS storage_previews_select_manage ON storage.objects;
CREATE POLICY storage_previews_select_manage ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('resource-previews', 'resource-thumbnails')
    AND (
      public.is_site_admin()
      OR public.can_manage_resource(public.storage_first_folder_uuid(name))
    )
  );

-- ---------------------------------------------------------------------------
-- 9. Submission RPC
--
-- Authorization lives here; completeness is delegated to
-- resource_submission_error() through the transition trigger, so the REST API
-- and this function cannot disagree.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_resource_for_review(
  p_resource_id uuid,
  p_rights_acknowledged boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_status text;
BEGIN
  IF p_resource_id IS NULL THEN
    RAISE EXCEPTION 'ftc:not_found';
  END IF;
  IF NOT public.is_verified_user() THEN
    RAISE EXCEPTION 'ftc:verification_required';
  END IF;
  IF NOT public.can_manage_resource(p_resource_id) THEN
    RAISE EXCEPTION 'ftc:not_authorized';
  END IF;
  IF NOT coalesce(p_rights_acknowledged, false) THEN
    RAISE EXCEPTION 'ftc:rights_required';
  END IF;

  SELECT status INTO current_status
  FROM public.resources
  WHERE id = p_resource_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ftc:not_found';
  END IF;
  IF current_status NOT IN ('DRAFT', 'CHANGES_REQUESTED') THEN
    RAISE EXCEPTION 'ftc:not_editable';
  END IF;

  UPDATE public.resources
  SET status = 'PENDING_REVIEW',
      rights_acknowledged_at = now()
  WHERE id = p_resource_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_resource_submission(p_resource_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_status text;
BEGIN
  IF NOT public.is_verified_user() THEN
    RAISE EXCEPTION 'ftc:verification_required';
  END IF;
  IF NOT public.can_manage_resource(p_resource_id) THEN
    RAISE EXCEPTION 'ftc:not_authorized';
  END IF;

  SELECT status INTO current_status
  FROM public.resources
  WHERE id = p_resource_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ftc:not_found';
  END IF;
  IF current_status <> 'PENDING_REVIEW' THEN
    RAISE EXCEPTION 'ftc:not_pending';
  END IF;

  UPDATE public.resources SET status = 'DRAFT' WHERE id = p_resource_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. Moderation RPC
--
-- One transaction covers the status change and the history row, so a decision
-- can never be half-applied.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.review_resource(
  p_resource_id uuid,
  p_decision text,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  r public.resources;
  clean_message text;
  submission_error text;
  next_status text;
BEGIN
  IF NOT public.is_site_admin() THEN
    RAISE EXCEPTION 'ftc:not_authorized';
  END IF;
  IF p_decision NOT IN ('APPROVED', 'CHANGES_REQUESTED', 'REJECTED') THEN
    RAISE EXCEPTION 'ftc:invalid_decision';
  END IF;

  clean_message := nullif(trim(coalesce(p_message, '')), '');
  IF p_decision <> 'APPROVED' AND (clean_message IS NULL OR length(clean_message) < 10) THEN
    RAISE EXCEPTION 'ftc:message_required';
  END IF;
  IF clean_message IS NOT NULL AND length(clean_message) > 2000 THEN
    RAISE EXCEPTION 'ftc:message_too_long';
  END IF;

  SELECT * INTO r FROM public.resources WHERE id = p_resource_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ftc:not_found';
  END IF;
  IF r.status <> 'PENDING_REVIEW' THEN
    RAISE EXCEPTION 'ftc:not_pending';
  END IF;

  IF p_decision = 'APPROVED' THEN
    -- Re-checked at approval time: a category can be deactivated or a file
    -- removed between submission and review.
    submission_error := public.resource_submission_error(
      r.id,
      r.title,
      r.description,
      r.resource_type,
      r.category_id,
      r.license_id,
      r.rights_acknowledged_at
    );
    IF submission_error IS NOT NULL THEN
      RAISE EXCEPTION 'ftc:%', submission_error;
    END IF;

    next_status := 'PUBLISHED';
  ELSE
    next_status := p_decision;
  END IF;

  UPDATE public.resources SET status = next_status WHERE id = p_resource_id;

  INSERT INTO public.resource_reviews (resource_id, reviewer_id, decision, message)
  VALUES (p_resource_id, auth.uid(), p_decision, clean_message);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_resource_archived(
  p_resource_id uuid,
  p_archived boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_status text;
BEGIN
  IF NOT public.is_site_admin() THEN
    RAISE EXCEPTION 'ftc:not_authorized';
  END IF;

  SELECT status INTO current_status
  FROM public.resources
  WHERE id = p_resource_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ftc:not_found';
  END IF;

  IF p_archived THEN
    IF current_status <> 'PUBLISHED' THEN
      RAISE EXCEPTION 'ftc:not_published';
    END IF;
    UPDATE public.resources SET status = 'ARCHIVED' WHERE id = p_resource_id;
  ELSE
    IF current_status <> 'ARCHIVED' THEN
      RAISE EXCEPTION 'ftc:not_archived';
    END IF;
    UPDATE public.resources SET status = 'PUBLISHED' WHERE id = p_resource_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_resource_for_review(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.withdraw_resource_submission(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_resource(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_resource_archived(uuid, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_resource_for_review(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_resource_submission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_resource(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_resource_archived(uuid, boolean) TO authenticated;
