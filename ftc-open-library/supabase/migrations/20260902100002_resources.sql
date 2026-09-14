-- Resources, versions, files, tags, hardware, and relations.

CREATE TABLE public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL,
  resource_type text NOT NULL,
  description text NOT NULL,
  author_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.teams (id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.categories (id) ON DELETE SET NULL,
  season_id uuid REFERENCES public.seasons (id) ON DELETE SET NULL,
  license_id uuid REFERENCES public.licenses (id) ON DELETE RESTRICT,
  thumbnail_url text,
  preview_url text,
  parent_resource_id uuid REFERENCES public.resources (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  visibility text NOT NULL DEFAULT 'PUBLIC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED,
  CONSTRAINT resources_slug_unique UNIQUE (slug),
  CONSTRAINT resources_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT resources_type_check CHECK (
    resource_type IN ('CAD', 'CODE', 'TUTORIAL', 'ALGORITHM')
  ),
  CONSTRAINT resources_status_check CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  CONSTRAINT resources_visibility_check CHECK (visibility IN ('PUBLIC', 'UNLISTED')),
  CONSTRAINT resources_title_not_blank CHECK (length(trim(title)) > 0),
  CONSTRAINT resources_description_not_blank CHECK (length(trim(description)) > 0),
  CONSTRAINT resources_parent_not_self CHECK (parent_resource_id IS DISTINCT FROM id),
  CONSTRAINT resources_published_requires_license CHECK (
    status <> 'PUBLISHED' OR license_id IS NOT NULL
  ),
  CONSTRAINT resources_published_at_consistent CHECK (
    (status = 'PUBLISHED' AND published_at IS NOT NULL)
    OR (status <> 'PUBLISHED')
  )
);

CREATE TABLE public.resource_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources (id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  version_label text,
  changelog text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resource_versions_number_positive CHECK (version_number > 0),
  CONSTRAINT resource_versions_unique UNIQUE (resource_id, version_number)
);

CREATE TABLE public.resource_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources (id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.resource_versions (id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_type text,
  mime_type text,
  size_bytes bigint,
  storage_path text NOT NULL,
  is_previewable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resource_files_filename_not_blank CHECK (length(trim(filename)) > 0),
  CONSTRAINT resource_files_storage_path_not_blank CHECK (length(trim(storage_path)) > 0),
  CONSTRAINT resource_files_size_non_negative CHECK (
    size_bytes IS NULL OR size_bytes >= 0
  ),
  CONSTRAINT resource_files_type_check CHECK (
    file_type IS NULL
    OR file_type IN ('CAD', 'SOURCE', 'DOCUMENT', 'VIDEO_LINK', 'IMAGE', 'OTHER')
  )
);

CREATE TABLE public.resource_tags (
  resource_id uuid NOT NULL REFERENCES public.resources (id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags (id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, tag_id)
);

CREATE TABLE public.resource_hardware (
  resource_id uuid NOT NULL REFERENCES public.resources (id) ON DELETE CASCADE,
  hardware_id uuid NOT NULL REFERENCES public.hardware (id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, hardware_id)
);

CREATE TABLE public.resource_relations (
  source_resource_id uuid NOT NULL REFERENCES public.resources (id) ON DELETE CASCADE,
  target_resource_id uuid NOT NULL REFERENCES public.resources (id) ON DELETE CASCADE,
  relation_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_resource_id, target_resource_id, relation_type),
  CONSTRAINT resource_relations_type_check CHECK (
    relation_type IN ('RELATED', 'USES', 'BASED_ON')
  ),
  CONSTRAINT resource_relations_not_self CHECK (
    source_resource_id <> target_resource_id
  )
);

CREATE INDEX resources_resource_type_idx ON public.resources (resource_type);
CREATE INDEX resources_category_id_idx ON public.resources (category_id);
CREATE INDEX resources_season_id_idx ON public.resources (season_id);
CREATE INDEX resources_team_id_idx ON public.resources (team_id);
CREATE INDEX resources_author_id_idx ON public.resources (author_id);
CREATE INDEX resources_status_idx ON public.resources (status);
CREATE INDEX resources_visibility_idx ON public.resources (visibility);
CREATE INDEX resources_created_at_idx ON public.resources (created_at DESC);
CREATE INDEX resources_published_at_idx ON public.resources (published_at DESC);
CREATE INDEX resources_parent_resource_id_idx ON public.resources (parent_resource_id);
CREATE INDEX resources_search_vector_idx ON public.resources USING gin (search_vector);
CREATE INDEX resources_public_listing_idx
  ON public.resources (resource_type, created_at DESC)
  WHERE status = 'PUBLISHED' AND visibility = 'PUBLIC';

CREATE INDEX resource_files_resource_id_idx ON public.resource_files (resource_id);
CREATE INDEX resource_files_version_id_idx ON public.resource_files (version_id);
CREATE INDEX resource_tags_tag_id_idx ON public.resource_tags (tag_id);
CREATE INDEX resource_hardware_hardware_id_idx ON public.resource_hardware (hardware_id);
CREATE INDEX resource_relations_target_idx ON public.resource_relations (target_resource_id);

CREATE TRIGGER resources_set_updated_at
BEFORE UPDATE ON public.resources
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
