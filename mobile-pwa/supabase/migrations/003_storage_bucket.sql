-- Checks Happy Storage Bucket Setup
-- ==============================================================================
-- Run this in Supabase SQL Editor AFTER running 001 and 002 migrations
--
-- IMPORTANT NOTES:
-- 1. The storage bucket can also be created via Dashboard > Storage > New Bucket
-- 2. The helper function is in the 'public' schema (not 'storage') because
--    users don't have permission to create functions in the storage schema
-- 3. If you get "permission denied for schema storage", make sure you're
--    running this as the postgres/service role, not anon/authenticated
-- ==============================================================================

-- ============================================
-- CREATE STORAGE BUCKET
-- ============================================
-- First, create the bucket via Supabase Dashboard > Storage > New Bucket
-- OR run this SQL (may require service_role permissions):
INSERT INTO storage.buckets (id, name, public)
VALUES ('continuity-photos', 'continuity-photos', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- HELPER FUNCTION (in PUBLIC schema)
-- ============================================
-- This function checks if the authenticated user can access a photo
-- based on project membership. It must be in the 'public' schema.
-- Path structure: {project_id}/{character_id}/{photo_id}.jpg

CREATE OR REPLACE FUNCTION public.can_access_storage_photo(object_path TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  project_uuid UUID;
  path_parts TEXT[];
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Extract project_id from path (first segment)
  path_parts := string_to_array(object_path, '/');

  IF array_length(path_parts, 1) < 1 THEN
    RETURN FALSE;
  END IF;

  -- Try to parse first path segment as UUID (project_id)
  BEGIN
    project_uuid := path_parts[1]::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
  END;

  -- Check if user is a member of this project
  RETURN EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = project_uuid
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STORAGE POLICIES
-- ============================================
-- Note: These policies use the public.can_access_storage_photo function

-- Policy: Project members can read photos in their projects
CREATE POLICY "Project members can view photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'continuity-photos'
    AND public.can_access_storage_photo(name)
  );

-- Policy: Project members can upload photos to their projects
CREATE POLICY "Project members can upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'continuity-photos'
    AND public.can_access_storage_photo(name)
  );

-- Policy: Project members can update photos in their projects
CREATE POLICY "Project members can update photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'continuity-photos'
    AND public.can_access_storage_photo(name)
  );

-- Policy: Project members can delete photos in their projects
CREATE POLICY "Project members can delete photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'continuity-photos'
    AND public.can_access_storage_photo(name)
  );
