-- ============================================================================
-- Migration: 013_add_department_column.sql
-- Purpose: Add a `department` column to the projects table so the chosen
--          department (hmu or costume) persists in the database and survives
--          logout/login cycles.
--          Also updates the create_project and join_project_by_invite_code
--          RPCs to handle the new column.
--
-- HOW TO RUN:
--   1. Go to Supabase Dashboard → SQL Editor
--   2. Paste this entire file
--   3. Click "Run"
-- ============================================================================

-- 1. Add the department column (defaults to 'hmu' for existing projects)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT 'hmu'
  CHECK (department IN ('hmu', 'costume'));

-- 2. Update create_project RPC to accept and store department
CREATE OR REPLACE FUNCTION public.create_project(
  project_name TEXT,
  production_type_input TEXT DEFAULT 'film',
  owner_role_input TEXT DEFAULT 'designer',
  department_input TEXT DEFAULT 'hmu'
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_invite_code TEXT;
  v_project_id UUID;
  v_department TEXT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i INTEGER;
BEGIN
  -- Must be authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Validate department
  v_department := COALESCE(department_input, 'hmu');
  IF v_department NOT IN ('hmu', 'costume') THEN
    v_department := 'hmu';
  END IF;

  -- Generate invite code (format: XXX-XXXX)
  v_invite_code := '';
  FOR i IN 1..3 LOOP
    v_invite_code := v_invite_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  v_invite_code := v_invite_code || '-';
  FOR i IN 1..4 LOOP
    v_invite_code := v_invite_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;

  -- Create the project
  INSERT INTO public.projects (name, production_type, department, invite_code, created_by)
  VALUES (project_name, production_type_input, v_department, v_invite_code, v_user_id)
  RETURNING id INTO v_project_id;

  -- Add creator as owner
  INSERT INTO public.project_members (project_id, user_id, role, is_owner)
  VALUES (v_project_id, v_user_id, owner_role_input, true);

  -- Return the created project
  RETURN json_build_object(
    'id', v_project_id,
    'name', project_name,
    'production_type', production_type_input,
    'department', v_department,
    'invite_code', v_invite_code,
    'created_by', v_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Update join_project_by_invite_code RPC to return department
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
      'department', project_record.department,
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
    'department', project_record.department,
    'invite_code', project_record.invite_code,
    'created_at', project_record.created_at,
    'already_member', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
