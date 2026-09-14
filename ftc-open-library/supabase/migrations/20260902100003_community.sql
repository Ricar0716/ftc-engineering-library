-- Favorites, ratings, comments, downloads, and public aggregate stats.

CREATE TABLE public.favorites (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource_id)
);

CREATE TABLE public.ratings (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources (id) ON DELETE CASCADE,
  rating integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource_id),
  CONSTRAINT ratings_range CHECK (rating BETWEEN 1 AND 5)
);

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'VISIBLE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comments_body_not_blank CHECK (length(trim(body)) > 0),
  CONSTRAINT comments_status_check CHECK (status IN ('VISIBLE', 'HIDDEN'))
);

CREATE TABLE public.downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources (id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES public.resource_files (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX favorites_resource_id_idx ON public.favorites (resource_id);
CREATE INDEX ratings_resource_id_idx ON public.ratings (resource_id);
CREATE INDEX comments_resource_id_idx ON public.comments (resource_id);
CREATE INDEX comments_user_id_idx ON public.comments (user_id);
CREATE INDEX downloads_resource_id_idx ON public.downloads (resource_id);
CREATE INDEX downloads_file_id_idx ON public.downloads (file_id);
CREATE INDEX downloads_user_id_idx ON public.downloads (user_id);
CREATE INDEX downloads_created_at_idx ON public.downloads (created_at DESC);

CREATE TRIGGER ratings_set_updated_at
BEFORE UPDATE ON public.ratings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER comments_set_updated_at
BEFORE UPDATE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Owner-rights view: anon can read aggregates without reading download/favorite rows.
-- Draft and unlisted resources are excluded so counters cannot leak unpublished work.
CREATE VIEW public.resource_stats AS
SELECT
  r.id AS resource_id,
  round(avg(rt.rating)::numeric, 2) AS rating_average,
  count(rt.rating)::integer AS rating_count,
  (
    SELECT count(*)::integer
    FROM public.favorites f
    WHERE f.resource_id = r.id
  ) AS favorite_count,
  (
    SELECT count(*)::integer
    FROM public.downloads d
    WHERE d.resource_id = r.id
  ) AS download_count
FROM public.resources r
LEFT JOIN public.ratings rt ON rt.resource_id = r.id
WHERE r.status = 'PUBLISHED'
  AND r.visibility = 'PUBLIC'
GROUP BY r.id;
