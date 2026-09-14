-- Interactive CAD / MODEL preview (visualization only).
--
-- Adds GLB/glTF for CAD, and mesh formats for MODEL, so the shared Three.js
-- viewer can load files contributors actually upload. STEP, IGES, Fusion,
-- SolidWorks, and Blender stay out of the viewer — they need conversion or
-- would execute a DCC scene.
--
-- No preview_asset table. Preview still uses resource_files + signed URLs.
--
-- Rollback: DELETE FROM public.upload_allowed_extension WHERE extension IN
-- ('glb', 'gltf') OR (resource_type = 'MODEL' AND extension IN ('stl', 'obj', '3mf'));

INSERT INTO public.upload_allowed_extension (resource_type, extension) VALUES
  ('CAD', 'glb'),
  ('CAD', 'gltf'),
  ('MODEL', 'glb'),
  ('MODEL', 'gltf'),
  ('MODEL', 'stl'),
  ('MODEL', 'obj'),
  ('MODEL', '3mf')
ON CONFLICT DO NOTHING;
