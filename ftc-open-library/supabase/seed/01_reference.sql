-- Fictional catalog data for local development.
-- Do not treat these rows as production content.

INSERT INTO public.seasons (id, label, start_year, end_year) VALUES
  ('10000000-0000-4000-8000-000000000001', '2026-2027', 2026, 2027),
  ('10000000-0000-4000-8000-000000000002', '2025-2026', 2025, 2026),
  ('10000000-0000-4000-8000-000000000003', '2024-2025', 2024, 2025)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.licenses (id, name, spdx_id, url, description, is_custom) VALUES
  ('20000000-0000-4000-8000-000000000001', 'MIT', 'MIT', 'https://spdx.org/licenses/MIT.html', 'Permissive software license.', false),
  ('20000000-0000-4000-8000-000000000002', 'Apache-2.0', 'Apache-2.0', 'https://spdx.org/licenses/Apache-2.0.html', 'Permissive license with an explicit patent grant.', false),
  ('20000000-0000-4000-8000-000000000003', 'GPL-3.0', 'GPL-3.0-only', 'https://spdx.org/licenses/GPL-3.0-only.html', 'Copyleft software license.', false),
  ('20000000-0000-4000-8000-000000000004', 'CC0-1.0', 'CC0-1.0', 'https://spdx.org/licenses/CC0-1.0.html', 'Public-domain dedication.', false),
  ('20000000-0000-4000-8000-000000000005', 'CC-BY-4.0', 'CC-BY-4.0', 'https://spdx.org/licenses/CC-BY-4.0.html', 'Attribution required.', false),
  ('20000000-0000-4000-8000-000000000006', 'CC-BY-SA-4.0', 'CC-BY-SA-4.0', 'https://spdx.org/licenses/CC-BY-SA-4.0.html', 'Attribution and share-alike.', false),
  ('20000000-0000-4000-8000-000000000007', 'CERN-OHL-S-2.0', 'CERN-OHL-S-2.0', 'https://spdx.org/licenses/CERN-OHL-S-2.0.html', 'CERN Open Hardware License strongly reciprocal.', false),
  ('20000000-0000-4000-8000-000000000008', 'CERN-OHL-W-2.0', 'CERN-OHL-W-2.0', 'https://spdx.org/licenses/CERN-OHL-W-2.0.html', 'CERN Open Hardware License weakly reciprocal.', false),
  ('20000000-0000-4000-8000-000000000009', 'CUSTOM', NULL, NULL, 'Author-provided custom license text or URL is required to publish.', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.hardware (id, name, slug) VALUES
  ('30000000-0000-4000-8000-000000000001', 'REV', 'rev'),
  ('30000000-0000-4000-8000-000000000002', 'goBILDA', 'gobilda'),
  ('30000000-0000-4000-8000-000000000003', 'AndyMark', 'andymark'),
  ('30000000-0000-4000-8000-000000000004', 'Custom', 'custom'),
  ('30000000-0000-4000-8000-000000000005', '3D Printed', '3d-printed'),
  ('30000000-0000-4000-8000-000000000006', 'Laser Cut', 'laser-cut'),
  ('30000000-0000-4000-8000-000000000007', 'CNC', 'cnc'),
  ('30000000-0000-4000-8000-000000000008', 'Other', 'other')
ON CONFLICT (id) DO NOTHING;

-- Development-only category names. The application does not hardcode them.
-- Production may have zero categories. Do not add MODEL rows here.
INSERT INTO public.categories (id, name, slug, resource_type) VALUES
  ('40000000-0000-4000-8000-000000000101', 'Drivetrain', 'cad-drivetrain', 'CAD'),
  ('40000000-0000-4000-8000-000000000102', 'Intake', 'cad-intake', 'CAD'),
  ('40000000-0000-4000-8000-000000000103', 'Preshooter', 'cad-preshooter', 'CAD'),
  ('40000000-0000-4000-8000-000000000104', 'Claw', 'cad-claw', 'CAD'),
  ('40000000-0000-4000-8000-000000000105', 'Gripper', 'cad-gripper', 'CAD'),
  ('40000000-0000-4000-8000-000000000106', 'Arm', 'cad-arm', 'CAD'),
  ('40000000-0000-4000-8000-000000000107', 'Slides', 'cad-slides', 'CAD'),
  ('40000000-0000-4000-8000-000000000108', 'Elevator', 'cad-elevator', 'CAD'),
  ('40000000-0000-4000-8000-000000000109', 'Transfer', 'cad-transfer', 'CAD'),
  ('40000000-0000-4000-8000-000000000110', 'Turret', 'cad-turret', 'CAD'),
  ('40000000-0000-4000-8000-000000000111', 'Hanger', 'cad-hanger', 'CAD'),
  ('40000000-0000-4000-8000-000000000112', 'Endgame', 'cad-endgame', 'CAD'),
  ('40000000-0000-4000-8000-000000000113', 'Mechanism', 'cad-mechanism', 'CAD'),
  ('40000000-0000-4000-8000-000000000114', 'Other', 'cad-other', 'CAD'),
  ('40000000-0000-4000-8000-000000000201', 'TeleOp', 'code-teleop', 'CODE'),
  ('40000000-0000-4000-8000-000000000202', 'Autonomous', 'code-autonomous', 'CODE'),
  ('40000000-0000-4000-8000-000000000203', 'PID', 'code-pid', 'CODE'),
  ('40000000-0000-4000-8000-000000000204', 'Motion Control', 'code-motion-control', 'CODE'),
  ('40000000-0000-4000-8000-000000000205', 'Odometry', 'code-odometry', 'CODE'),
  ('40000000-0000-4000-8000-000000000206', 'Localization', 'code-localization', 'CODE'),
  ('40000000-0000-4000-8000-000000000207', 'Vision', 'code-vision', 'CODE'),
  ('40000000-0000-4000-8000-000000000208', 'AprilTag', 'code-apriltag', 'CODE'),
  ('40000000-0000-4000-8000-000000000209', 'Path Planning', 'code-path-planning', 'CODE'),
  ('40000000-0000-4000-8000-000000000210', 'State Machine', 'code-state-machine', 'CODE'),
  ('40000000-0000-4000-8000-000000000211', 'FTC SDK', 'code-ftc-sdk', 'CODE'),
  ('40000000-0000-4000-8000-000000000212', 'Hardware Control', 'code-hardware-control', 'CODE'),
  ('40000000-0000-4000-8000-000000000213', 'Other', 'code-other', 'CODE'),
  ('40000000-0000-4000-8000-000000000301', 'Mechanical', 'tutorial-mechanical', 'TUTORIAL'),
  ('40000000-0000-4000-8000-000000000302', 'CAD', 'tutorial-cad', 'TUTORIAL'),
  ('40000000-0000-4000-8000-000000000303', 'Programming', 'tutorial-programming', 'TUTORIAL'),
  ('40000000-0000-4000-8000-000000000304', 'Electronics', 'tutorial-electronics', 'TUTORIAL'),
  ('40000000-0000-4000-8000-000000000305', 'FTC Basics', 'tutorial-ftc-basics', 'TUTORIAL'),
  ('40000000-0000-4000-8000-000000000306', 'Autonomous', 'tutorial-autonomous', 'TUTORIAL'),
  ('40000000-0000-4000-8000-000000000307', 'Vision', 'tutorial-vision', 'TUTORIAL'),
  ('40000000-0000-4000-8000-000000000308', 'Advanced', 'tutorial-advanced', 'TUTORIAL'),
  ('40000000-0000-4000-8000-000000000309', 'Other', 'tutorial-other', 'TUTORIAL')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tags (id, name, slug) VALUES
  ('50000000-0000-4000-8000-000000000001', 'horizontal', 'horizontal'),
  ('50000000-0000-4000-8000-000000000002', 'vertical', 'vertical'),
  ('50000000-0000-4000-8000-000000000003', 'intake', 'intake'),
  ('50000000-0000-4000-8000-000000000004', 'servo', 'servo'),
  ('50000000-0000-4000-8000-000000000005', 'motor', 'motor'),
  ('50000000-0000-4000-8000-000000000006', 'rev', 'rev'),
  ('50000000-0000-4000-8000-000000000007', 'gobilda', 'gobilda'),
  ('50000000-0000-4000-8000-000000000008', '3d-print', '3d-print'),
  ('50000000-0000-4000-8000-000000000009', 'mecanum', 'mecanum'),
  ('50000000-0000-4000-8000-000000000010', 'pid', 'pid'),
  ('50000000-0000-4000-8000-000000000011', 'odometry', 'odometry'),
  ('50000000-0000-4000-8000-000000000012', 'apriltag', 'apriltag'),
  ('50000000-0000-4000-8000-000000000013', 'java', 'java'),
  ('50000000-0000-4000-8000-000000000014', 'roadrunner', 'roadrunner'),
  ('50000000-0000-4000-8000-000000000015', 'pedro-pathing', 'pedro-pathing')
ON CONFLICT (id) DO NOTHING;
