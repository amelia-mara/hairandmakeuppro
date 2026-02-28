-- ============================================================================
-- Migration: 012_create_project_rpc.sql
-- Purpose: Add a SECURITY DEFINER RPC for project creation.
--          Direct INSERT into the projects table can fail when the client JWT
--          is stale (auth.uid() returns NULL), which violates the RLS policy.
--          Using an RPC (same pattern as join_project_by_invite_code) bypasses
--          RLS and handles the project + member insert atomically.
--
-- HOW TO RUN:
--   1. Go to Supabase Dashboard → SQL Editor
--   2. Paste this entire file
--   3. Click "Run"
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_project(
  project_name TEXT,
  production_type_input TEXT DEFAULT 'film',
  owner_role_input TEXT DEFAULT 'designer'
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_invite_code TEXT;
  v_project_id UUID;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i INTEGER;
BEGIN
  -- Must be authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
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
  INSERT INTO public.projects (name, production_type, invite_code, created_by)
  VALUES (project_name, production_type_input, v_invite_code, v_user_id)
  RETURNING id INTO v_project_id;

  -- Add creator as owner
  INSERT INTO public.project_members (project_id, user_id, role, is_owner)
  VALUES (v_project_id, v_user_id, owner_role_input, true);

  -- Return the created project
  RETURN json_build_object(
    'id', v_project_id,
    'name', project_name,
    'production_type', production_type_input,
    'invite_code', v_invite_code,
    'created_by', v_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
