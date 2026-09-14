-- Replace ALGORITHM with MODEL as a top-level resource type.
-- Baseline migrations still create ALGORITHM CHECKs so already-applied databases can evolve.

-- Development ALGORITHM rows were explanations (PID write-ups, odometry notes, etc.),
-- not interactive models. Remove them rather than converting them into fake MODEL resources.
DELETE FROM public.resources
WHERE resource_type = 'ALGORITHM';

DELETE FROM public.categories
WHERE resource_type = 'ALGORITHM';

ALTER TABLE public.categories
  DROP CONSTRAINT categories_resource_type_check;

ALTER TABLE public.categories
  ADD CONSTRAINT categories_resource_type_check
  CHECK (resource_type IN ('CAD', 'CODE', 'TUTORIAL', 'MODEL'));

ALTER TABLE public.resources
  DROP CONSTRAINT resources_type_check;

ALTER TABLE public.resources
  ADD CONSTRAINT resources_type_check
  CHECK (resource_type IN ('CAD', 'CODE', 'TUTORIAL', 'MODEL'));
