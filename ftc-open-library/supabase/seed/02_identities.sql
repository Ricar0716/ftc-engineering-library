-- Fictional development users and teams.
-- These are not real FTC teams. Seed only against local/dev databases.
-- Auth inserts follow the local GoTrue schema used by the Supabase CLI.

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '70000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'maya@example.test',
    crypt('dev-only-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"maya","display_name":"Maya Chen"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '70000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'jordan@example.test',
    crypt('dev-only-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"jordan","display_name":"Jordan Patel"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '70000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'priya@example.test',
    crypt('dev-only-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"priya","display_name":"Priya Nair"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '70000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'alex@example.test',
    crypt('dev-only-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"alex","display_name":"Alex Romero"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '70000000-0000-4000-8000-000000000005',
    'authenticated',
    'authenticated',
    'sam@example.test',
    crypt('dev-only-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"sam","display_name":"Sam Okonkwo"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '70000000-0000-4000-8000-000000000006',
    'authenticated',
    'authenticated',
    'renee@example.test',
    crypt('dev-only-password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"renee","display_name":"Renee Walsh"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  id,
  id,
  jsonb_build_object('sub', id::text, 'email', email),
  'email',
  email,
  now(),
  now(),
  now()
FROM auth.users
WHERE id IN (
  '70000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000002',
  '70000000-0000-4000-8000-000000000003',
  '70000000-0000-4000-8000-000000000004',
  '70000000-0000-4000-8000-000000000005',
  '70000000-0000-4000-8000-000000000006'
)
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles
SET
  bio = CASE id
    WHEN '70000000-0000-4000-8000-000000000001' THEN 'Fictional mentor account for Example Robotics seed data.'
    WHEN '70000000-0000-4000-8000-000000000002' THEN 'Fictional student account used in development fixtures.'
    WHEN '70000000-0000-4000-8000-000000000003' THEN 'Fictional programmer account for Northstar Robotics seed data.'
    WHEN '70000000-0000-4000-8000-000000000004' THEN 'Fictional CAD lead account for Circuit Forge seed data.'
    WHEN '70000000-0000-4000-8000-000000000005' THEN 'Fictional control account for Vector Robotics seed data.'
    WHEN '70000000-0000-4000-8000-000000000006' THEN 'Fictional tutorial author account for Atlas FTC seed data.'
  END,
  display_name = coalesce(display_name, username)
WHERE id IN (
  '70000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000002',
  '70000000-0000-4000-8000-000000000003',
  '70000000-0000-4000-8000-000000000004',
  '70000000-0000-4000-8000-000000000005',
  '70000000-0000-4000-8000-000000000006'
);

INSERT INTO public.teams (id, team_number, name, country, description, website_url) VALUES
  (
    '60000000-0000-4000-8000-000000000001',
    '10001',
    'Example Robotics',
    'United States',
    'Fictional development team. Not affiliated with a real FTC team.',
    'https://example.test/example-robotics'
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    '10002',
    'Northstar Robotics',
    'Canada',
    'Fictional development team used to populate the library.',
    'https://example.test/northstar'
  ),
  (
    '60000000-0000-4000-8000-000000000003',
    '10003',
    'Circuit Forge',
    'United Kingdom',
    'Fictional development team focused on sample CAD resources.',
    NULL
  ),
  (
    '60000000-0000-4000-8000-000000000004',
    '10004',
    'Vector Robotics',
    'Australia',
    'Fictional development team focused on sample control code.',
    NULL
  ),
  (
    '60000000-0000-4000-8000-000000000005',
    '10005',
    'Atlas FTC',
    'United States',
    'Fictional development team focused on sample tutorials.',
    NULL
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.team_members (team_id, user_id, role) VALUES
  ('60000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'OWNER'),
  ('60000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000002', 'ADMIN'),
  ('60000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000003', 'OWNER'),
  ('60000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000004', 'OWNER'),
  ('60000000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-000000000005', 'OWNER'),
  ('60000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000006', 'OWNER'),
  ('60000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000002', 'MEMBER')
ON CONFLICT (team_id, user_id) DO NOTHING;
