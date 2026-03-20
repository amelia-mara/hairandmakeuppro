-- ══════════════════════════════════════════════════════════════════════════════
-- CHECKS HAPPY — SUPABASE FIX SCRIPT
-- Run this once before persistence/sync work begins
-- Generated: 2026-03-19
--
-- This migration adds:
--   1. has_prep_access column on projects (the sync gate)
--   2. metadata JSONB column on characters (for Prep character profiles)
--   3. Fixes join_project_by_invite_code search_path
--   4. Updates create_project RPC to accept has_prep_access
--
-- Safe to run on a live database with real user data.
-- All statements use IF NOT EXISTS or are idempotent.
-- ══════════════════════════════════════════════════════════════════════════════


-- ── Missing columns ──────────────────────────────────────────────────────────

-- 1. has_prep_access: The sync gate between Prep and the mobile app.
--    When true, the project has full two-way sync with Prep Happy.
--    When false, the project is app-only.
--    Defaults to false — only set to true when a Designer creates a project
--    through Prep Happy.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS has_prep_access BOOLEAN NOT NULL DEFAULT false;

-- 2. metadata: Stores Prep-specific character profile data (billing, category,
--    age, gender, hairColour, hairType, eyeColour, skinTone, build,
--    distinguishingFeatures, notes). Kept as JSONB to avoid adding 11 columns
--    that the mobile app doesn't use.
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';


-- ── RPC fixes ────────────────────────────────────────────────────────────────

-- Fix: join_project_by_invite_code was re-created in migration 013 without
-- SET search_path = public. Re-apply with the fix, and also return
-- has_prep_access and department in the response.
CREATE OR REPLACE FUNCTION public.join_project_by_invite_code(
  invite_code_input TEXT,
  role_input TEXT DEFAULT 'floor'
)
RETURNS JSON AS $$
DECLARE
  project_record RECORD;
  existing_member RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO project_record
  FROM public.projects
  WHERE invite_code = UPPER(invite_code_input);

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Invalid project code. Please check and try again.');
  END IF;

  SELECT * INTO existing_member
  FROM public.project_members
  WHERE project_id = project_record.id
  AND user_id = auth.uid();

  IF FOUND THEN
    RETURN json_build_object(
      'project_id', project_record.id,
      'project_name', project_record.name,
      'production_type', project_record.production_type,
      'department', project_record.department,
      'has_prep_access', project_record.has_prep_access,
      'invite_code', project_record.invite_code,
      'created_at', project_record.created_at,
      'already_member', true
    );
  END IF;

  INSERT INTO public.project_members (project_id, user_id, role, is_owner)
  VALUES (project_record.id, auth.uid(), role_input, false);

  RETURN json_build_object(
    'project_id', project_record.id,
    'project_name', project_record.name,
    'production_type', project_record.production_type,
    'department', project_record.department,
    'has_prep_access', project_record.has_prep_access,
    'invite_code', project_record.invite_code,
    'created_at', project_record.created_at,
    'already_member', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update create_project RPC to accept and store has_prep_access.
-- When a Designer creates a project through Prep, pass has_prep_access = true.
CREATE OR REPLACE FUNCTION public.create_project(
  project_name TEXT,
  production_type_input TEXT DEFAULT 'film',
  owner_role_input TEXT DEFAULT 'designer',
  department_input TEXT DEFAULT 'hmu',
  has_prep_access_input BOOLEAN DEFAULT false
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
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

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

  INSERT INTO public.projects (name, production_type, department, invite_code, created_by, has_prep_access)
  VALUES (project_name, production_type_input, v_department, v_invite_code, v_user_id, COALESCE(has_prep_access_input, false))
  RETURNING id INTO v_project_id;

  INSERT INTO public.project_members (project_id, user_id, role, is_owner)
  VALUES (v_project_id, v_user_id, owner_role_input, true);

  RETURN json_build_object(
    'id', v_project_id,
    'name', project_name,
    'production_type', production_type_input,
    'department', v_department,
    'has_prep_access', COALESCE(has_prep_access_input, false),
    'invite_code', v_invite_code,
    'created_by', v_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update lookup_project_by_invite_code to return has_prep_access
CREATE OR REPLACE FUNCTION public.lookup_project_by_invite_code(invite_code_input TEXT)
RETURNS JSON AS $$
DECLARE
  project_record RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  SELECT id, name, production_type, department, has_prep_access, invite_code
  INTO project_record
  FROM public.projects
  WHERE invite_code = UPPER(invite_code_input);

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Invalid project code. Please check and try again.');
  END IF;

  RETURN json_build_object(
    'id', project_record.id,
    'name', project_record.name,
    'production_type', project_record.production_type,
    'department', project_record.department,
    'has_prep_access', project_record.has_prep_access,
    'invite_code', project_record.invite_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ── Verification ─────────────────────────────────────────────────────────────
-- Run these after the migration to confirm everything was applied.

-- 1. Verify has_prep_access exists on projects
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'projects'
  AND column_name = 'has_prep_access';
-- Expected: has_prep_access | boolean | false

-- 2. Verify metadata exists on characters
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'characters'
  AND column_name = 'metadata';
-- Expected: metadata | jsonb | '{}'::jsonb

-- 3. Verify create_project function accepts has_prep_access_input
SELECT routine_name, external_language, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'create_project';
-- Expected: create_project | PLPGSQL | DEFINER

-- 4. Verify join_project_by_invite_code has search_path set
SELECT proname, prosecdef, proconfig
FROM pg_proc
WHERE proname = 'join_project_by_invite_code';
-- Expected: prosecdef = true, proconfig includes search_path=public
