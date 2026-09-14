-- Fictional published resources plus one draft and one archived row for RLS checks.
-- Metadata only: binary CAD belongs in Storage, not PostgreSQL.
-- Preview/original sample files live in supabase/seed/assets/ and should be
-- uploaded to Storage after a project exists. See supabase/seed/README.md.

INSERT INTO public.resources (
  id, title, slug, resource_type, description,
  author_id, team_id, category_id, season_id, license_id,
  status, visibility, published_at
) VALUES
  (
    '80000000-0000-4000-8000-000000000001',
    'Horizontal Intake V3',
    'horizontal-intake-v3',
    'CAD',
    'Fictional sample CAD resource describing a compact horizontal roller intake. Development fixture only.',
    '70000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000102',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000007',
    'PUBLISHED', 'PUBLIC', now() - interval '20 days'
  ),
  (
    '80000000-0000-4000-8000-000000000002',
    'Four Bar Claw V2',
    'four-bar-claw-v2',
    'CAD',
    'Fictional four-bar claw sample used to exercise CAD categories and licenses.',
    '70000000-0000-4000-8000-000000000004',
    '60000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000104',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000007',
    'PUBLISHED', 'PUBLIC', now() - interval '18 days'
  ),
  (
    '80000000-0000-4000-8000-000000000003',
    'Compact Mecanum Drivetrain',
    'compact-mecanum-drivetrain',
    'CAD',
    'Fictional mecanum chassis sample for filter and search tests.',
    '70000000-0000-4000-8000-000000000003',
    '60000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000101',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000008',
    'PUBLISHED', 'PUBLIC', now() - interval '16 days'
  ),
  (
    '80000000-0000-4000-8000-000000000004',
    'Linear Slide Assembly',
    'linear-slide-assembly',
    'CAD',
    'Fictional linear slide stack with placeholder documentation.',
    '70000000-0000-4000-8000-000000000004',
    '60000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000107',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000005',
    'PUBLISHED', 'PUBLIC', now() - interval '15 days'
  ),
  (
    '80000000-0000-4000-8000-000000000005',
    'Passive Transfer',
    'passive-transfer',
    'CAD',
    'Fictional passive transfer plate used as seed CAD.',
    '70000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000109',
    '10000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000004',
    'PUBLISHED', 'PUBLIC', now() - interval '14 days'
  ),
  (
    '80000000-0000-4000-8000-000000000006',
    'Servo Gripper',
    'servo-gripper',
    'CAD',
    'Fictional servo-powered gripper with a tiny printable jaw sample.',
    '70000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000105',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000005',
    'PUBLISHED', 'PUBLIC', now() - interval '13 days'
  ),
  (
    '80000000-0000-4000-8000-000000000007',
    'Overhead Intake',
    'overhead-intake',
    'CAD',
    'Fictional overhead intake sketch for additional CAD coverage.',
    '70000000-0000-4000-8000-000000000003',
    '60000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000102',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000006',
    'PUBLISHED', 'PUBLIC', now() - interval '12 days'
  ),
  (
    '80000000-0000-4000-8000-000000000008',
    'Endgame Hanger',
    'endgame-hanger',
    'CAD',
    'Fictional endgame hanger sample. Not a real competition design.',
    '70000000-0000-4000-8000-000000000006',
    '60000000-0000-4000-8000-000000000005',
    '40000000-0000-4000-8000-000000000111',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000007',
    'PUBLISHED', 'PUBLIC', now() - interval '11 days'
  ),
  (
    '80000000-0000-4000-8000-000000000009',
    'Compact Preshooter',
    'compact-preshooter',
    'CAD',
    'Fictional preshooter used to fill the CAD catalog during development.',
    '70000000-0000-4000-8000-000000000004',
    '60000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000103',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    'PUBLISHED', 'PUBLIC', now() - interval '10 days'
  ),
  (
    '80000000-0000-4000-8000-000000000010',
    'Turret Prototype',
    'turret-prototype',
    'CAD',
    'Fictional turret prototype with placeholder hardware tags.',
    '70000000-0000-4000-8000-000000000005',
    '60000000-0000-4000-8000-000000000004',
    '40000000-0000-4000-8000-000000000110',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'PUBLISHED', 'PUBLIC', now() - interval '9 days'
  ),
  (
    '80000000-0000-4000-8000-000000000011',
    'Basic FTC TeleOp',
    'basic-ftc-teleop',
    'CODE',
    'Fictional TeleOp starter that is not executed by the platform. Sample Java only.',
    '70000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000201',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'PUBLISHED', 'PUBLIC', now() - interval '19 days'
  ),
  (
    '80000000-0000-4000-8000-000000000012',
    'PID Motor Controller',
    'pid-motor-controller',
    'CODE',
    'Fictional PID example for search and code-category filters.',
    '70000000-0000-4000-8000-000000000005',
    '60000000-0000-4000-8000-000000000004',
    '40000000-0000-4000-8000-000000000203',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'PUBLISHED', 'PUBLIC', now() - interval '17 days'
  ),
  (
    '80000000-0000-4000-8000-000000000013',
    'Encoder Drive',
    'encoder-drive',
    'CODE',
    'Fictional encoder driving helper used as seed source code metadata.',
    '70000000-0000-4000-8000-000000000003',
    '60000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000212',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    'PUBLISHED', 'PUBLIC', now() - interval '16 days'
  ),
  (
    '80000000-0000-4000-8000-000000000014',
    'AprilTag Localization Example',
    'apriltag-localization-example',
    'CODE',
    'Fictional AprilTag localization snippet. Not production vision code.',
    '70000000-0000-4000-8000-000000000003',
    '60000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000208',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'PUBLISHED', 'PUBLIC', now() - interval '14 days'
  ),
  (
    '80000000-0000-4000-8000-000000000015',
    'Mecanum Drive Controller',
    'mecanum-drive-controller',
    'CODE',
    'Fictional mecanum TeleOp controller sample.',
    '70000000-0000-4000-8000-000000000005',
    '60000000-0000-4000-8000-000000000004',
    '40000000-0000-4000-8000-000000000201',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    'PUBLISHED', 'PUBLIC', now() - interval '13 days'
  ),
  (
    '80000000-0000-4000-8000-000000000016',
    'State Machine Example',
    'state-machine-example',
    'CODE',
    'Fictional autonomous state machine skeleton for previews.',
    '70000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000210',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003',
    'PUBLISHED', 'PUBLIC', now() - interval '12 days'
  ),
  (
    '80000000-0000-4000-8000-000000000017',
    'Autonomous Starter',
    'autonomous-starter',
    'CODE',
    'Fictional autonomous opmode starter. Uploaded code is never executed.',
    '70000000-0000-4000-8000-000000000006',
    '60000000-0000-4000-8000-000000000005',
    '40000000-0000-4000-8000-000000000202',
    '10000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000001',
    'PUBLISHED', 'PUBLIC', now() - interval '11 days'
  ),
  (
    '80000000-0000-4000-8000-000000000018',
    'Odometry Example',
    'odometry-example',
    'CODE',
    'Fictional three-wheel odometry notes and sample class names.',
    '70000000-0000-4000-8000-000000000005',
    '60000000-0000-4000-8000-000000000004',
    '40000000-0000-4000-8000-000000000205',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'PUBLISHED', 'PUBLIC', now() - interval '10 days'
  ),
  (
    '80000000-0000-4000-8000-000000000019',
    'Servo Controller',
    'servo-controller',
    'CODE',
    'Fictional servo helper for hardware-control filtering.',
    '70000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000212',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    'PUBLISHED', 'PUBLIC', now() - interval '8 days'
  ),
  (
    '80000000-0000-4000-8000-000000000020',
    'Motor Feedforward Example',
    'motor-feedforward-example',
    'CODE',
    'Fictional feedforward sample tied to motion-control category.',
    '70000000-0000-4000-8000-000000000005',
    '60000000-0000-4000-8000-000000000004',
    '40000000-0000-4000-8000-000000000204',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'PUBLISHED', 'PUBLIC', now() - interval '7 days'
  ),
  (
    '80000000-0000-4000-8000-000000000021',
    'FTC Robot Anatomy',
    'ftc-robot-anatomy',
    'TUTORIAL',
    'Fictional beginner tutorial outlining drivetrain, intake, and control in general terms.',
    '70000000-0000-4000-8000-000000000006',
    '60000000-0000-4000-8000-000000000005',
    '40000000-0000-4000-8000-000000000305',
    '10000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000005',
    'PUBLISHED', 'PUBLIC', now() - interval '21 days'
  ),
  (
    '80000000-0000-4000-8000-000000000022',
    'Building Your First Intake',
    'building-your-first-intake',
    'TUTORIAL',
    'Fictional intake tutorial covering roller selection, gearing, motor placement, CAD, and testing.',
    '70000000-0000-4000-8000-000000000006',
    '60000000-0000-4000-8000-000000000005',
    '40000000-0000-4000-8000-000000000301',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000005',
    'PUBLISHED', 'PUBLIC', now() - interval '12 days'
  ),
  (
    '80000000-0000-4000-8000-000000000023',
    'FTC CAD Basics',
    'ftc-cad-basics',
    'TUTORIAL',
    'Fictional CAD onboarding tutorial. No third-party CAD files are included.',
    '70000000-0000-4000-8000-000000000004',
    '60000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000302',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000006',
    'PUBLISHED', 'PUBLIC', now() - interval '9 days'
  ),
  (
    '80000000-0000-4000-8000-000000000024',
    'Understanding Gear Ratios',
    'understanding-gear-ratios',
    'TUTORIAL',
    'Fictional gearing explainer for mechanical category coverage.',
    '70000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000301',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000004',
    'PUBLISHED', 'PUBLIC', now() - interval '6 days'
  ),
  (
    '80000000-0000-4000-8000-000000000025',
    'FTC Programming Basics',
    'ftc-programming-basics',
    'TUTORIAL',
    'Fictional programming tutorial. Sample code is untrusted content and is never executed.',
    '70000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000303',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'PUBLISHED', 'PUBLIC', now() - interval '5 days'
  ),
  (
    '80000000-0000-4000-8000-000000000031',
    'Secret Intake Sketch',
    'secret-intake-sketch',
    'CAD',
    'Unpublished fictional draft used to verify that drafts are not publicly readable.',
    '70000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000102',
    '10000000-0000-4000-8000-000000000001',
    NULL,
    'DRAFT', 'PUBLIC', NULL
  ),
  (
    '80000000-0000-4000-8000-000000000032',
    'Retired Claw Archive',
    'retired-claw-archive',
    'CAD',
    'Fictional archived resource. Public visitors must not see archived rows.',
    '70000000-0000-4000-8000-000000000004',
    '60000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000104',
    '10000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000007',
    'ARCHIVED', 'PUBLIC', now() - interval '40 days'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.resource_versions (
  id, resource_id, version_number, version_label, changelog, status, released_at, created_by
)
SELECT
  ('81000000-0000-4000-8000-' || to_char(g, 'FM000000000000'))::uuid,
  r.id,
  1,
  'v1',
  'Initial fictional seed version.',
  CASE
    WHEN r.status IN ('PUBLISHED', 'ARCHIVED') THEN 'PUBLISHED'
    WHEN r.status = 'PENDING_REVIEW' THEN 'PENDING_REVIEW'
    ELSE 'DRAFT'
  END,
  CASE
    WHEN r.status IN ('PUBLISHED', 'ARCHIVED') THEN coalesce(r.published_at, now())
    ELSE NULL
  END,
  r.author_id
FROM generate_series(1, 32) AS g
JOIN public.resources r
  ON r.id = ('80000000-0000-4000-8000-' || to_char(g, 'FM000000000000'))::uuid
ON CONFLICT (id) DO NOTHING;
