-- STEP 5.2: sliding-window touch for an in-progress Upload Intent.
--
-- TUS resumable uploads can take longer than the 15-minute create window.
-- Storage INSERT/UPDATE RLS still requires a live PENDING intent for every
-- chunk, so a 700 MB video would die mid-transfer if we left expiry alone.
--
-- This does NOT widen the global TTL to hours. It only lets the owner of a
-- still-PENDING, still-unexpired intent push expires_at forward by another
-- TTL while the Resource remains editable. An already-EXPIRED intent cannot
-- be revived; a new upload needs a new create_upload_intent() and a new path.
--
-- TUS session URLs may live up to ~24 hours on the Storage side, but they are
-- not an authorization grant. Each PATCH still needs has_open_upload_intent().

CREATE OR REPLACE FUNCTION public.touch_upload_intent(p_storage_path text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  intent public.resource_upload_intents;
  next_expiry timestamptz;
BEGIN
  IF p_storage_path IS NULL OR btrim(p_storage_path) = '' THEN
    RAISE EXCEPTION 'ftc:upload_not_authorized';
  END IF;
  IF NOT public.is_verified_user() THEN
    RAISE EXCEPTION 'ftc:verification_required';
  END IF;

  SELECT * INTO intent
  FROM public.resource_upload_intents
  WHERE storage_path = p_storage_path
  FOR UPDATE;

  IF NOT FOUND OR intent.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'ftc:upload_not_authorized';
  END IF;
  IF intent.status <> 'PENDING' THEN
    RAISE EXCEPTION 'ftc:upload_not_authorized';
  END IF;
  IF intent.expires_at <= now() THEN
    UPDATE public.resource_upload_intents
    SET status = 'EXPIRED'
    WHERE id = intent.id
      AND status = 'PENDING';
    RAISE EXCEPTION 'ftc:upload_expired';
  END IF;
  IF NOT public.can_manage_resource(intent.resource_id)
     OR NOT public.resource_is_editable(intent.resource_id) THEN
    RAISE EXCEPTION 'ftc:not_editable';
  END IF;

  next_expiry := now() + make_interval(
    secs => public.upload_limit('upload_intent_ttl_seconds')
  );

  UPDATE public.resource_upload_intents
  SET expires_at = next_expiry
  WHERE id = intent.id
    AND status = 'PENDING';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ftc:upload_not_authorized';
  END IF;

  RETURN next_expiry;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_upload_intent(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_upload_intent(text) TO authenticated;
