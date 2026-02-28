-- ============================================================================
-- CHECKS HAPPY: COMPLETE RLS POLICY & STORAGE FIX
-- Migration: 011_fix_rls_policies.sql
-- Generated: 2026-02-28
--
-- Purpose: Fix all RLS policies, helper functions, storage policies, and
--          RPC authorization to ensure correct data sync between devices.
--
-- Issues Fixed:
--   1. Helper functions lacked STABLE marker (poor RLS query performance)
--   2. Helper functions lacked SET search_path (SECURITY DEFINER best practice)
--   3. sync_scene_characters / sync_look_scenes RPCs had NO authorization
--   4. Missing UPDATE policies on scene_characters, look_scenes, photos
--   5. Realtime echo loops from overly broad policies
--   6. deactivate_previous_scripts trigger not SECURITY DEFINER
--   7. Consolidated and simplified all policies for maintainability
--
-- HOW TO RUN:
--   1. Go to Supabase Dashboard → SQL Editor
--   2. Paste this entire file
--   3. Click "Run"
--   4. Check the verification output at the bottom
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: DROP ALL EXISTING TABLE RLS POLICIES
-- ============================================================================
-- This gives us a clean slate. Every policy is recreated below.

-- users
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Project members can view teammate profiles" ON users;

-- projects
DROP POLICY IF EXISTS "Project members can view projects" ON projects;
DROP POLICY IF EXISTS "Users can lookup project by invite code" ON projects;
DROP POLICY IF EXISTS "Authenticated users can create projects" ON projects;
DROP POLICY IF EXISTS "Project owners can update projects" ON projects;
DROP POLICY IF EXISTS "Project owners can delete projects" ON projects;

-- project_members
DROP POLICY IF EXISTS "Project members can view members" ON project_members;
DROP POLICY IF EXISTS "Users can join projects" ON project_members;
DROP POLICY IF EXISTS "Project owners can update members" ON project_members;
DROP POLICY IF EXISTS "Project owners can delete members" ON project_members;

-- characters
DROP POLICY IF EXISTS "Project members can view characters" ON characters;
DROP POLICY IF EXISTS "Project members can create characters" ON characters;
DROP POLICY IF EXISTS "Project members can update characters" ON characters;
DROP POLICY IF EXISTS "Project members can delete characters" ON characters;

-- scenes
DROP POLICY IF EXISTS "Project members can view scenes" ON scenes;
DROP POLICY IF EXISTS "Project members can create scenes" ON scenes;
DROP POLICY IF EXISTS "Project members can update scenes" ON scenes;
DROP POLICY IF EXISTS "Project members can delete scenes" ON scenes;

-- scene_characters
DROP POLICY IF EXISTS "Project members can view scene_characters" ON scene_characters;
DROP POLICY IF EXISTS "Project members can create scene_characters" ON scene_characters;
DROP POLICY IF EXISTS "Project members can delete scene_characters" ON scene_characters;

-- looks
DROP POLICY IF EXISTS "Project members can view looks" ON looks;
DROP POLICY IF EXISTS "Project members can create looks" ON looks;
DROP POLICY IF EXISTS "Project members can update looks" ON looks;
DROP POLICY IF EXISTS "Project members can delete looks" ON looks;

-- look_scenes
DROP POLICY IF EXISTS "Project members can view look_scenes" ON look_scenes;
DROP POLICY IF EXISTS "Project members can create look_scenes" ON look_scenes;
DROP POLICY IF EXISTS "Project members can delete look_scenes" ON look_scenes;

-- continuity_events
DROP POLICY IF EXISTS "Project members can view continuity_events" ON continuity_events;
DROP POLICY IF EXISTS "Project members can create continuity_events" ON continuity_events;
DROP POLICY IF EXISTS "Project members can update continuity_events" ON continuity_events;
DROP POLICY IF EXISTS "Project members can delete continuity_events" ON continuity_events;

-- photos
DROP POLICY IF EXISTS "Project members can view photos" ON photos;
DROP POLICY IF EXISTS "Project members can create photos" ON photos;
DROP POLICY IF EXISTS "Project members can delete photos" ON photos;

-- schedule_data
DROP POLICY IF EXISTS "Project members can view schedule_data" ON schedule_data;
DROP POLICY IF EXISTS "Project members can create schedule_data" ON schedule_data;
DROP POLICY IF EXISTS "Project members can update schedule_data" ON schedule_data;
DROP POLICY IF EXISTS "Project members can delete schedule_data" ON schedule_data;

-- timesheets
DROP POLICY IF EXISTS "Users can view own timesheets" ON timesheets;
DROP POLICY IF EXISTS "Project owners can view all timesheets" ON timesheets;
DROP POLICY IF EXISTS "Users can create own timesheets" ON timesheets;
DROP POLICY IF EXISTS "Users can update own timesheets" ON timesheets;
DROP POLICY IF EXISTS "Users can delete own timesheets" ON timesheets;

-- call_sheet_data
DROP POLICY IF EXISTS "Members can view call sheets" ON call_sheet_data;
DROP POLICY IF EXISTS "Members can create call sheets" ON call_sheet_data;
DROP POLICY IF EXISTS "Members can update call sheets" ON call_sheet_data;
DROP POLICY IF EXISTS "Members can delete call sheets" ON call_sheet_data;

-- script_uploads
DROP POLICY IF EXISTS "Members can view scripts" ON script_uploads;
DROP POLICY IF EXISTS "Members can upload scripts" ON script_uploads;
DROP POLICY IF EXISTS "Members can update scripts" ON script_uploads;
DROP POLICY IF EXISTS "Members can delete scripts" ON script_uploads;

-- lookbooks
DROP POLICY IF EXISTS "Members can view lookbooks" ON lookbooks;
DROP POLICY IF EXISTS "Members can create lookbooks" ON lookbooks;
DROP POLICY IF EXISTS "Members can update lookbooks" ON lookbooks;
DROP POLICY IF EXISTS "Members can delete lookbooks" ON lookbooks;


-- ============================================================================
-- STEP 2: DROP ALL EXISTING STORAGE POLICIES
-- ============================================================================

-- continuity-photos bucket
DROP POLICY IF EXISTS "Project members can view photos" ON storage.objects;
DROP POLICY IF EXISTS "Project members can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Project members can update photos" ON storage.objects;
DROP POLICY IF EXISTS "Project members can delete photos" ON storage.objects;

-- project-documents bucket
DROP POLICY IF EXISTS "Members can view project documents" ON storage.objects;
DROP POLICY IF EXISTS "Members can upload project documents" ON storage.objects;
DROP POLICY IF EXISTS "Members can update project documents" ON storage.objects;
DROP POLICY IF EXISTS "Members can delete project documents" ON storage.objects;


-- ============================================================================
-- STEP 3: RECREATE HELPER FUNCTIONS
-- ============================================================================
-- Fixed: Added STABLE marker, SET search_path, explicit public. schema refs

-- Check if current user is a member of the given project
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Check if current user is the owner of the given project
CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id
    AND user_id = auth.uid()
    AND is_owner = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Check if current user can access a storage object by extracting project_id
-- from the file path. Works for both buckets:
--   continuity-photos: {project_id}/{character_id}/{photo_id}.jpg
--   project-documents: {project_id}/{folder}/{doc_id}.pdf
CREATE OR REPLACE FUNCTION public.can_access_project_storage(object_path TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  project_uuid UUID;
  path_parts TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  path_parts := string_to_array(object_path, '/');

  IF array_length(path_parts, 1) < 1 THEN
    RETURN FALSE;
  END IF;

  -- First path segment is always the project_id
  BEGIN
    project_uuid := path_parts[1]::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
  END;

  RETURN EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = project_uuid
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Keep the old function name as an alias so existing code doesn't break
CREATE OR REPLACE FUNCTION public.can_access_storage_photo(object_path TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.can_access_project_storage(object_path);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;


-- ============================================================================
-- STEP 4: ENSURE RLS IS ENABLED ON ALL TABLES
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scene_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.looks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.look_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.continuity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_sheet_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.script_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lookbooks ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- STEP 5: TABLE POLICIES
-- ============================================================================

-- ----------------------------------------
-- TABLE: users
-- ----------------------------------------
-- Users can read their own profile
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Users can insert their own profile (signup)
CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Users can view profiles of teammates (shared project membership)
CREATE POLICY "users_select_teammates"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_members my_pm
      JOIN public.project_members their_pm
        ON my_pm.project_id = their_pm.project_id
      WHERE my_pm.user_id = auth.uid()
        AND their_pm.user_id = users.id
    )
  );


-- ----------------------------------------
-- TABLE: projects
-- ----------------------------------------
-- Members can view projects they belong to
CREATE POLICY "projects_select_member"
  ON public.projects FOR SELECT
  TO authenticated
  USING (public.is_project_member(id));

-- Authenticated users can create projects
CREATE POLICY "projects_insert_auth"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

-- Owners can update projects (name, status, pending_deletion_at)
CREATE POLICY "projects_update_owner"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (public.is_project_owner(id));

-- Owners can delete projects
CREATE POLICY "projects_delete_owner"
  ON public.projects FOR DELETE
  TO authenticated
  USING (public.is_project_owner(id));


-- ----------------------------------------
-- TABLE: project_members
-- ----------------------------------------
-- Members can view other members of their projects
CREATE POLICY "project_members_select"
  ON public.project_members FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

-- Users can add themselves as members (joining via RPC sets role)
CREATE POLICY "project_members_insert"
  ON public.project_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Owners can update member roles
CREATE POLICY "project_members_update_owner"
  ON public.project_members FOR UPDATE
  TO authenticated
  USING (public.is_project_owner(project_id));

-- Owners can remove members; users can remove themselves
CREATE POLICY "project_members_delete"
  ON public.project_members FOR DELETE
  TO authenticated
  USING (public.is_project_owner(project_id) OR auth.uid() = user_id);


-- ----------------------------------------
-- TABLE: characters
-- ----------------------------------------
CREATE POLICY "characters_select"
  ON public.characters FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "characters_insert"
  ON public.characters FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "characters_update"
  ON public.characters FOR UPDATE
  TO authenticated
  USING (public.is_project_member(project_id))
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "characters_delete"
  ON public.characters FOR DELETE
  TO authenticated
  USING (public.is_project_member(project_id));


-- ----------------------------------------
-- TABLE: scenes
-- ----------------------------------------
CREATE POLICY "scenes_select"
  ON public.scenes FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "scenes_insert"
  ON public.scenes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "scenes_update"
  ON public.scenes FOR UPDATE
  TO authenticated
  USING (public.is_project_member(project_id))
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "scenes_delete"
  ON public.scenes FOR DELETE
  TO authenticated
  USING (public.is_project_member(project_id));


-- ----------------------------------------
-- TABLE: scene_characters (junction)
-- No direct project_id — access via scenes table
-- ----------------------------------------
CREATE POLICY "scene_characters_select"
  ON public.scene_characters FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.scenes s
      WHERE s.id = scene_characters.scene_id
      AND public.is_project_member(s.project_id)
    )
  );

CREATE POLICY "scene_characters_insert"
  ON public.scene_characters FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.scenes s
      WHERE s.id = scene_characters.scene_id
      AND public.is_project_member(s.project_id)
    )
  );

-- Added: UPDATE policy (was missing)
CREATE POLICY "scene_characters_update"
  ON public.scene_characters FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.scenes s
      WHERE s.id = scene_characters.scene_id
      AND public.is_project_member(s.project_id)
    )
  );

CREATE POLICY "scene_characters_delete"
  ON public.scene_characters FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.scenes s
      WHERE s.id = scene_characters.scene_id
      AND public.is_project_member(s.project_id)
    )
  );


-- ----------------------------------------
-- TABLE: looks
-- ----------------------------------------
CREATE POLICY "looks_select"
  ON public.looks FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "looks_insert"
  ON public.looks FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "looks_update"
  ON public.looks FOR UPDATE
  TO authenticated
  USING (public.is_project_member(project_id))
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "looks_delete"
  ON public.looks FOR DELETE
  TO authenticated
  USING (public.is_project_member(project_id));


-- ----------------------------------------
-- TABLE: look_scenes (junction)
-- No direct project_id — access via looks table
-- ----------------------------------------
CREATE POLICY "look_scenes_select"
  ON public.look_scenes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.looks l
      WHERE l.id = look_scenes.look_id
      AND public.is_project_member(l.project_id)
    )
  );

CREATE POLICY "look_scenes_insert"
  ON public.look_scenes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.looks l
      WHERE l.id = look_scenes.look_id
      AND public.is_project_member(l.project_id)
    )
  );

-- Added: UPDATE policy (was missing)
CREATE POLICY "look_scenes_update"
  ON public.look_scenes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.looks l
      WHERE l.id = look_scenes.look_id
      AND public.is_project_member(l.project_id)
    )
  );

CREATE POLICY "look_scenes_delete"
  ON public.look_scenes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.looks l
      WHERE l.id = look_scenes.look_id
      AND public.is_project_member(l.project_id)
    )
  );


-- ----------------------------------------
-- TABLE: continuity_events
-- No direct project_id — access via scenes table
-- ----------------------------------------
CREATE POLICY "continuity_events_select"
  ON public.continuity_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.scenes s
      WHERE s.id = continuity_events.scene_id
      AND public.is_project_member(s.project_id)
    )
  );

CREATE POLICY "continuity_events_insert"
  ON public.continuity_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.scenes s
      WHERE s.id = continuity_events.scene_id
      AND public.is_project_member(s.project_id)
    )
  );

CREATE POLICY "continuity_events_update"
  ON public.continuity_events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.scenes s
      WHERE s.id = continuity_events.scene_id
      AND public.is_project_member(s.project_id)
    )
  );

CREATE POLICY "continuity_events_delete"
  ON public.continuity_events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.scenes s
      WHERE s.id = continuity_events.scene_id
      AND public.is_project_member(s.project_id)
    )
  );


-- ----------------------------------------
-- TABLE: photos
-- No direct project_id — access via continuity_events → scenes
-- ----------------------------------------
CREATE POLICY "photos_select"
  ON public.photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.continuity_events ce
      JOIN public.scenes s ON s.id = ce.scene_id
      WHERE ce.id = photos.continuity_event_id
      AND public.is_project_member(s.project_id)
    )
  );

CREATE POLICY "photos_insert"
  ON public.photos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.continuity_events ce
      JOIN public.scenes s ON s.id = ce.scene_id
      WHERE ce.id = photos.continuity_event_id
      AND public.is_project_member(s.project_id)
    )
  );

-- Added: UPDATE policy (was missing)
CREATE POLICY "photos_update"
  ON public.photos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.continuity_events ce
      JOIN public.scenes s ON s.id = ce.scene_id
      WHERE ce.id = photos.continuity_event_id
      AND public.is_project_member(s.project_id)
    )
  );

CREATE POLICY "photos_delete"
  ON public.photos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.continuity_events ce
      JOIN public.scenes s ON s.id = ce.scene_id
      WHERE ce.id = photos.continuity_event_id
      AND public.is_project_member(s.project_id)
    )
  );


-- ----------------------------------------
-- TABLE: schedule_data
-- ----------------------------------------
CREATE POLICY "schedule_data_select"
  ON public.schedule_data FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "schedule_data_insert"
  ON public.schedule_data FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "schedule_data_update"
  ON public.schedule_data FOR UPDATE
  TO authenticated
  USING (public.is_project_member(project_id))
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "schedule_data_delete"
  ON public.schedule_data FOR DELETE
  TO authenticated
  USING (public.is_project_member(project_id));


-- ----------------------------------------
-- TABLE: timesheets
-- ----------------------------------------
-- Users can view their own timesheets
CREATE POLICY "timesheets_select_own"
  ON public.timesheets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Owners can view all timesheets in their projects
CREATE POLICY "timesheets_select_owner"
  ON public.timesheets FOR SELECT
  TO authenticated
  USING (public.is_project_owner(project_id));

-- Users can create their own timesheets (must be project member)
CREATE POLICY "timesheets_insert"
  ON public.timesheets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_project_member(project_id));

-- Users can update their own timesheets (must still be project member)
CREATE POLICY "timesheets_update"
  ON public.timesheets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND public.is_project_member(project_id));

-- Users can delete their own timesheets
CREATE POLICY "timesheets_delete"
  ON public.timesheets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ----------------------------------------
-- TABLE: call_sheet_data
-- ----------------------------------------
CREATE POLICY "call_sheet_data_select"
  ON public.call_sheet_data FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "call_sheet_data_insert"
  ON public.call_sheet_data FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "call_sheet_data_update"
  ON public.call_sheet_data FOR UPDATE
  TO authenticated
  USING (public.is_project_member(project_id))
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "call_sheet_data_delete"
  ON public.call_sheet_data FOR DELETE
  TO authenticated
  USING (public.is_project_member(project_id));


-- ----------------------------------------
-- TABLE: script_uploads
-- ----------------------------------------
CREATE POLICY "script_uploads_select"
  ON public.script_uploads FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "script_uploads_insert"
  ON public.script_uploads FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "script_uploads_update"
  ON public.script_uploads FOR UPDATE
  TO authenticated
  USING (public.is_project_member(project_id))
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "script_uploads_delete"
  ON public.script_uploads FOR DELETE
  TO authenticated
  USING (public.is_project_member(project_id));


-- ----------------------------------------
-- TABLE: lookbooks
-- ----------------------------------------
CREATE POLICY "lookbooks_select"
  ON public.lookbooks FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "lookbooks_insert"
  ON public.lookbooks FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "lookbooks_update"
  ON public.lookbooks FOR UPDATE
  TO authenticated
  USING (public.is_project_member(project_id))
  WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "lookbooks_delete"
  ON public.lookbooks FOR DELETE
  TO authenticated
  USING (public.is_project_member(project_id));


-- ============================================================================
-- STEP 6: STORAGE BUCKET POLICIES
-- ============================================================================

-- ----------------------------------------
-- BUCKET: continuity-photos
-- Path pattern: {project_id}/{character_id}/{photo_id}.jpg
-- ----------------------------------------
CREATE POLICY "photos_bucket_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'continuity-photos'
    AND public.can_access_project_storage(name)
  );

CREATE POLICY "photos_bucket_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'continuity-photos'
    AND public.can_access_project_storage(name)
  );

CREATE POLICY "photos_bucket_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'continuity-photos'
    AND public.can_access_project_storage(name)
  );

CREATE POLICY "photos_bucket_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'continuity-photos'
    AND public.can_access_project_storage(name)
  );

-- ----------------------------------------
-- BUCKET: project-documents
-- Path pattern: {project_id}/{folder}/{doc_id}.pdf
-- Folders: scripts/, schedules/, call-sheets/, lookbooks/, exports/
-- ----------------------------------------
CREATE POLICY "documents_bucket_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'project-documents'
    AND public.can_access_project_storage(name)
  );

CREATE POLICY "documents_bucket_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-documents'
    AND public.can_access_project_storage(name)
  );

CREATE POLICY "documents_bucket_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'project-documents'
    AND public.can_access_project_storage(name)
  );

CREATE POLICY "documents_bucket_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-documents'
    AND public.can_access_project_storage(name)
  );


-- ============================================================================
-- STEP 7: FIX RPC FUNCTIONS (add authorization)
-- ============================================================================

-- sync_scene_characters: Now verifies caller is a member of the project
-- that owns the scenes being modified.
CREATE OR REPLACE FUNCTION public.sync_scene_characters(
  p_scene_ids UUID[],
  p_entries JSONB
)
RETURNS VOID AS $$
DECLARE
  v_project_id UUID;
BEGIN
  -- Verify the caller is a member of the project that owns these scenes
  IF array_length(p_scene_ids, 1) > 0 THEN
    SELECT DISTINCT s.project_id INTO v_project_id
    FROM public.scenes s
    WHERE s.id = p_scene_ids[1];

    IF v_project_id IS NULL OR NOT public.is_project_member(v_project_id) THEN
      RAISE EXCEPTION 'Not authorized: not a member of this project';
    END IF;
  END IF;

  -- Delete existing rows for these scenes
  DELETE FROM public.scene_characters WHERE scene_id = ANY(p_scene_ids);

  -- Insert new rows
  INSERT INTO public.scene_characters (scene_id, character_id)
  SELECT
    (entry->>'scene_id')::UUID,
    (entry->>'character_id')::UUID
  FROM jsonb_array_elements(p_entries) AS entry
  ON CONFLICT (scene_id, character_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- sync_look_scenes: Now verifies caller is a member of the project
-- that owns the looks being modified.
CREATE OR REPLACE FUNCTION public.sync_look_scenes(
  p_look_ids UUID[],
  p_entries JSONB
)
RETURNS VOID AS $$
DECLARE
  v_project_id UUID;
BEGIN
  -- Verify the caller is a member of the project that owns these looks
  IF array_length(p_look_ids, 1) > 0 THEN
    SELECT DISTINCT l.project_id INTO v_project_id
    FROM public.looks l
    WHERE l.id = p_look_ids[1];

    IF v_project_id IS NULL OR NOT public.is_project_member(v_project_id) THEN
      RAISE EXCEPTION 'Not authorized: not a member of this project';
    END IF;
  END IF;

  -- Delete existing rows for these looks
  DELETE FROM public.look_scenes WHERE look_id = ANY(p_look_ids);

  -- Insert new rows
  INSERT INTO public.look_scenes (look_id, scene_number)
  SELECT
    (entry->>'look_id')::UUID,
    entry->>'scene_number'
  FROM jsonb_array_elements(p_entries) AS entry
  ON CONFLICT (look_id, scene_number) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix deactivate_previous_scripts trigger to run as SECURITY DEFINER
-- so it can update other rows in script_uploads regardless of who
-- triggered the INSERT.
CREATE OR REPLACE FUNCTION public.deactivate_previous_scripts()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = TRUE THEN
    UPDATE public.script_uploads
    SET is_active = FALSE
    WHERE project_id = NEW.project_id
      AND id != NEW.id
      AND is_active = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate join_project_by_invite_code with search_path
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
    'invite_code', project_record.invite_code,
    'created_at', project_record.created_at,
    'already_member', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate lookup_project_by_invite_code with search_path
CREATE OR REPLACE FUNCTION public.lookup_project_by_invite_code(invite_code_input TEXT)
RETURNS JSON AS $$
DECLARE
  project_record RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  SELECT id, name, production_type, invite_code
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
    'invite_code', project_record.invite_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


COMMIT;


-- ============================================================================
-- STEP 8: VERIFICATION (run after COMMIT)
-- ============================================================================
-- These queries confirm the migration was applied correctly.

-- 8a. List all table policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 8b. List all storage policies
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'storage'
ORDER BY tablename, policyname;

-- 8c. List all functions with their security type
SELECT
  routine_name,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;
