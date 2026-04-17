-- ============================================================================
-- Migration 020: Enforce has_prep_access integrity via trigger
--
-- Prevents a bug from setting has_prep_access = true on a project whose
-- creator is not a Designer. Uses projects.created_by (not owner_id).
--
-- The trigger checks the creator's tier on INSERT and UPDATE. If the
-- creator is not a designer, has_prep_access is forced to false.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_has_prep_access()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.has_prep_access = true THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE id = NEW.created_by
      AND tier = 'designer'
    ) THEN
      NEW.has_prep_access := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS check_prep_access ON public.projects;

CREATE TRIGGER check_prep_access
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_has_prep_access();
