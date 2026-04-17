-- ============================================================================
-- Migration 021: Add 'owner' tier for the platform owner account
--
-- The owner tier has all Designer capabilities plus platform admin access.
-- Only one account can ever hold the 'owner' tier (enforced by unique index).
-- Confirmed owner email: amelia-mara@outlook.com
--
-- Uses projects.created_by throughout (projects table has no owner_id column).
-- Safe to run on a live database — all statements are idempotent.
-- ============================================================================


-- 1. Add 'owner' to the tier CHECK constraint
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_tier_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_tier_check
  CHECK (tier IN ('daily', 'artist', 'supervisor', 'designer', 'owner'));


-- 2. Set the owner tier on the confirmed account
UPDATE public.users
SET tier = 'owner'
WHERE email = 'amelia-mara@outlook.com';


-- 3. Partial unique index — only one owner account can ever exist
CREATE UNIQUE INDEX IF NOT EXISTS one_owner_only
ON public.users ((true))
WHERE tier = 'owner';


-- 4. Update the enforce_has_prep_access trigger to allow 'owner' tier
--    (migration 020 created this function checking only 'designer')
CREATE OR REPLACE FUNCTION public.enforce_has_prep_access()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.has_prep_access = true THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE id = NEW.created_by
      AND tier IN ('designer', 'owner')
    ) THEN
      NEW.has_prep_access := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 5. Set has_prep_access on all projects created by the owner
UPDATE public.projects
SET has_prep_access = true
WHERE created_by = (SELECT id FROM public.users WHERE tier = 'owner');


-- ============================================================================
-- VERIFICATION (run manually after applying)
-- ============================================================================
--
-- SELECT constraint_name, check_clause
-- FROM information_schema.check_constraints
-- WHERE constraint_name = 'users_tier_check';
--
-- SELECT id, email, tier, beta_access FROM users WHERE tier = 'owner';
--
-- SELECT indexname, indexdef FROM pg_indexes WHERE indexname = 'one_owner_only';
--
-- SELECT trigger_name, event_manipulation, action_timing
-- FROM information_schema.triggers
-- WHERE event_object_table = 'projects' AND trigger_name = 'check_prep_access';
--
-- SELECT p.id, p.name, p.has_prep_access
-- FROM projects p
-- WHERE p.created_by = (SELECT id FROM users WHERE tier = 'owner');
--
-- SELECT tier, COUNT(*) FROM users GROUP BY tier ORDER BY tier;
-- ============================================================================
