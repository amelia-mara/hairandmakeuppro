-- Checks Happy Storage Bucket Setup
-- Run this in Supabase SQL Editor

-- ============================================
-- CREATE STORAGE BUCKET
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('continuity-photos', 'continuity-photos', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES
-- ============================================

-- Helper function to check if user can access photo by path
-- Path structure: {project_id}/{character_id}/{photo_id}.jpg
CREATE OR REPLACE FUNCTION storage.can_access_photo(bucket_id TEXT, object_path TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  project_uuid UUID;
  path_parts TEXT[];
BEGIN
  -- Extract project_id from path (first segment)
  path_parts := string_to_array(object_path, '/');

  IF array_length(path_parts, 1) < 1 THEN
    RETURN FALSE;
  END IF;

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

-- Policy: Project members can read photos in their projects
CREATE POLICY "Project members can view photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'continuity-photos'
    AND storage.can_access_photo(bucket_id, name)
  );

-- Policy: Project members can upload photos to their projects
CREATE POLICY "Project members can upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'continuity-photos'
    AND storage.can_access_photo(bucket_id, name)
  );

-- Policy: Project members can update photos in their projects
CREATE POLICY "Project members can update photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'continuity-photos'
    AND storage.can_access_photo(bucket_id, name)
  );

-- Policy: Project members can delete photos in their projects
CREATE POLICY "Project members can delete photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'continuity-photos'
    AND storage.can_access_photo(bucket_id, name)
  );
