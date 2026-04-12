-- ============================================================================
-- Migration 021: Add 'owner' tier for the platform owner account
--
-- The owner tier has all Designer capabilities plus platform admin access.
-- Only one account can ever hold the 'owner' tier (enforced by unique index).
-- The confirmed owner email is: amelia-mara@outlook.com
--
-- IMPORTANT: This migration uses projects.created_by (NOT owner_id).
-- The projects table has no owner_id column — verified against 001_initial_schema.sql.
-- ============================================================================


-- Step 2: Add 'owner' to the tier constraint
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_tier_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_tier_check
  CHECK (tier IN ('daily', 'artist', 'supervisor', 'designer', 'owner'));


-- Step 3: Set the owner tier
UPDATE public.users
SET tier = 'owner'
WHERE email = 'amelia-mara@outlook.com';


-- Step 4: Uniqueness constraint — only one owner account ever
CREATE UNIQUE INDEX IF NOT EXISTS one_owner_only
ON public.users ((tier = 'owner'))
WHERE tier = 'owner';


-- Step 5: Update the has_prep_access trigger to allow owner tier
-- Uses created_by (the actual column) not owner_id (which doesn't exist)
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

-- The trigger itself already exists from migration 020 — just verify
-- it's still attached (CREATE OR REPLACE above updates the function body,
-- the existing trigger continues to call it).


-- Step 6: Set has_prep_access on owner's projects
UPDATE public.projects
SET has_prep_access = true
WHERE created_by = (SELECT id FROM public.users WHERE tier = 'owner');


-- ============================================================================
-- Verification queries (run these after applying to confirm):
--
-- SELECT tier, COUNT(*) FROM users GROUP BY tier ORDER BY tier;
-- SELECT id, email, tier, beta_access FROM users WHERE tier = 'owner';
-- SELECT indexname FROM pg_indexes WHERE indexname = 'one_owner_only';
-- SELECT trigger_name FROM information_schema.triggers
--   WHERE event_object_table = 'projects' AND trigger_name = 'check_prep_access';
-- SELECT constraint_name, check_clause FROM information_schema.check_constraints
--   WHERE constraint_name = 'users_tier_check';
-- ============================================================================
