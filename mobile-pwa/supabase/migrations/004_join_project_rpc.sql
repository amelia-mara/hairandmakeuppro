-- Join Project RPC Function
-- ==============================================================================
-- A SECURITY DEFINER function that allows authenticated users to join a project
-- by invite code. This bypasses RLS so the INSERT into project_members succeeds
-- even when the user isn't yet a member of that project.
-- ==============================================================================

CREATE OR REPLACE FUNCTION join_project_by_invite_code(
  invite_code_input TEXT,
  role_input TEXT DEFAULT 'floor'
)
RETURNS JSON AS $$
DECLARE
  project_record RECORD;
  existing_member RECORD;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Find project by invite code
  SELECT * INTO project_record
  FROM projects
  WHERE invite_code = UPPER(invite_code_input);

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Invalid project code. Please check and try again.');
  END IF;

  -- Check if already a member
  SELECT * INTO existing_member
  FROM project_members
  WHERE project_id = project_record.id
  AND user_id = auth.uid();

  IF FOUND THEN
    -- Already a member, just return the project
    RETURN json_build_object(
      'project_id', project_record.id,
      'project_name', project_record.name,
      'production_type', project_record.production_type,
      'invite_code', project_record.invite_code,
      'created_at', project_record.created_at,
      'already_member', true
    );
  END IF;

  -- Add as member
  INSERT INTO project_members (project_id, user_id, role, is_owner)
  VALUES (project_record.id, auth.uid(), role_input, false);

  RETURN json_build_object(
    'project_id', project_record.id,
    'project_name', project_record.name,
    'production_type', project_record.production_type,
    'invite_code', project_record.invite_code,
    'created_at', project_record.created_at,
    'already_member', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
