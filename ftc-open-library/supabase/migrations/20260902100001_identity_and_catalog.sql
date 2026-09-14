-- Identity, teams, and catalog tables.

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username text NOT NULL,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_username_format CHECK (username ~ '^[a-z0-9_]{3,32}$'),
  CONSTRAINT profiles_username_unique UNIQUE (username)
);

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_number text NOT NULL,
  name text NOT NULL,
  country text,
  description text,
  logo_url text,
  website_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teams_team_number_unique UNIQUE (team_number),
  CONSTRAINT teams_team_number_format CHECK (team_number ~ '^[A-Za-z0-9._-]{1,32}$'),
  CONSTRAINT teams_website_url_format CHECK (
    website_url IS NULL OR website_url ~* '^https://'
  )
);

CREATE TABLE public.team_members (
  team_id uuid NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id),
  CONSTRAINT team_members_role_check CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER'))
);

CREATE TABLE public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  start_year integer,
  end_year integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seasons_label_unique UNIQUE (label),
  CONSTRAINT seasons_year_order CHECK (
    start_year IS NULL OR end_year IS NULL OR end_year >= start_year
  )
);

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  resource_type text NOT NULL,
  parent_id uuid REFERENCES public.categories (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categories_slug_unique UNIQUE (slug),
  CONSTRAINT categories_resource_type_check CHECK (
    resource_type IN ('CAD', 'CODE', 'TUTORIAL', 'ALGORITHM')
  ),
  CONSTRAINT categories_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT categories_parent_not_self CHECK (parent_id IS DISTINCT FROM id)
);

CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  CONSTRAINT tags_name_unique UNIQUE (name),
  CONSTRAINT tags_slug_unique UNIQUE (slug),
  CONSTRAINT tags_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE public.hardware (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  CONSTRAINT hardware_name_unique UNIQUE (name),
  CONSTRAINT hardware_slug_unique UNIQUE (slug),
  CONSTRAINT hardware_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  spdx_id text,
  url text,
  description text,
  is_custom boolean NOT NULL DEFAULT false,
  CONSTRAINT licenses_name_unique UNIQUE (name),
  CONSTRAINT licenses_custom_text CHECK (
    is_custom = false
    OR url IS NOT NULL
    OR description IS NOT NULL
  )
);

CREATE INDEX team_members_user_id_idx ON public.team_members (user_id);
CREATE INDEX team_members_role_idx ON public.team_members (role);
CREATE INDEX categories_resource_type_idx ON public.categories (resource_type);
CREATE INDEX categories_parent_id_idx ON public.categories (parent_id);

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER teams_set_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
