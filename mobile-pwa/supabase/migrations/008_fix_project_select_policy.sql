-- Fix overly permissive project SELECT policy
-- ==============================================================================
-- The "Users can lookup project by invite code" policy allowed ANY authenticated
-- user to SELECT all rows from the projects table. This leaked project names
-- and metadata to users who were not members.
--
-- Fix: Drop the permissive policy and create a SECURITY DEFINER RPC function
-- for invite-code lookups instead. The join RPC (004) already handles the join
-- flow; this new function handles the standalone "does this code exist?" lookup.
-- ==============================================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can lookup project by invite code" ON projects;

-- Create a secure RPC for looking up a project by invite code.
-- Returns minimal info (id, name, production_type) — just enough for the
-- client to show a confirmation before joining.
CREATE OR REPLACE FUNCTION lookup_project_by_invite_code(invite_code_input TEXT)
RETURNS JSON AS $$
DECLARE
  project_record RECORD;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Find project by invite code
  SELECT id, name, production_type, invite_code
  INTO project_record
  FROM projects
  WHERE invite_code = UPPER(invite_code_input);

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Invalid project code. Please check and try again.');
  END IF;

  RETURN json_build_object(
    'id', project_record.id,
    'name', project_record.name,
    'production_type', project_record.production_type,
    'invite_code', project_record.invite_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
