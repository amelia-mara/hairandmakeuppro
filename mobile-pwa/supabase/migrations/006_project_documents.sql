-- Project Documents Storage & Tables
-- ==============================================================================
-- Run this in Supabase SQL Editor AFTER running migrations 001-005
--
-- This migration adds:
-- 1. A 'project-documents' storage bucket for PDFs and generated files
-- 2. A 'call_sheet_data' table for parsed call sheet data (currently local-only)
-- 3. A 'script_uploads' table for tracking script PDF versions/revisions
-- 4. A 'lookbooks' table for generated lookbook metadata
-- 5. RLS policies for all new tables and storage
--
-- Storage folder structure:
--   {project_id}/call-sheets/{filename}
--   {project_id}/scripts/{filename}
--   {project_id}/schedules/{filename}
--   {project_id}/lookbooks/{filename}
--   {project_id}/exports/{filename}
-- ==============================================================================


-- ============================================
-- 1. STORAGE BUCKET: project-documents
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', false)
ON CONFLICT (id) DO NOTHING;


-- ============================================
-- 2. STORAGE POLICIES (reuse existing helper)
-- ============================================
-- The can_access_storage_photo() function works for any bucket
-- because it just checks project_id (first path segment) membership.
-- We reuse it here for project-documents.

CREATE POLICY "Members can view project documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-documents'
    AND public.can_access_storage_photo(name)
  );

CREATE POLICY "Members can upload project documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-documents'
    AND public.can_access_storage_photo(name)
  );

CREATE POLICY "Members can update project documents"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'project-documents'
    AND public.can_access_storage_photo(name)
  );

CREATE POLICY "Members can delete project documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-documents'
    AND public.can_access_storage_photo(name)
  );


-- ============================================
-- 3. CALL SHEET DATA TABLE
-- ============================================
-- Stores parsed call sheet data so it syncs across team members.
-- The 'parsed_data' JSONB column holds the full CallSheet object
-- (scenes, cast calls, pre-calls, weather, etc.)
CREATE TABLE IF NOT EXISTS call_sheet_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Key identifiers
  shoot_date DATE NOT NULL,                    -- The date this call sheet is for
  production_day INTEGER NOT NULL,             -- Day 1, Day 2, etc.

  -- Raw source
  storage_path TEXT,                           -- Path in project-documents bucket
  raw_text TEXT,                               -- Extracted PDF text

  -- Parsed call sheet data (full CallSheet JSON minus the pdfUri)
  parsed_data JSONB NOT NULL DEFAULT '{}',

  -- Metadata
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One call sheet per project per shoot date
  UNIQUE(project_id, shoot_date)
);

CREATE INDEX IF NOT EXISTS idx_call_sheet_data_project ON call_sheet_data(project_id);
CREATE INDEX IF NOT EXISTS idx_call_sheet_data_date ON call_sheet_data(project_id, shoot_date);
CREATE INDEX IF NOT EXISTS idx_call_sheet_data_day ON call_sheet_data(project_id, production_day);


-- ============================================
-- 4. SCRIPT UPLOADS TABLE
-- ============================================
-- Tracks script PDF versions so users can compare revisions.
-- Each upload is a version; the latest is the "active" script.
CREATE TABLE IF NOT EXISTS script_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Version tracking
  version_label TEXT,                          -- e.g. "Pink Draft", "Blue Revisions", "v2"
  version_number INTEGER NOT NULL DEFAULT 1,   -- Auto-incrementing per project

  -- Storage
  storage_path TEXT NOT NULL,                  -- Path in project-documents bucket
  file_name TEXT NOT NULL,                     -- Original filename
  file_size INTEGER,                           -- Bytes

  -- Parsed data
  raw_text TEXT,                               -- Extracted PDF text
  scene_count INTEGER,                         -- Number of scenes detected
  character_count INTEGER,                     -- Number of characters detected
  parsed_data JSONB,                           -- Full breakdown JSON (scenes, characters)

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,     -- Is this the current active script?
  status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'parsing', 'parsed', 'error')),

  -- Metadata
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_script_uploads_project ON script_uploads(project_id);
CREATE INDEX IF NOT EXISTS idx_script_uploads_active ON script_uploads(project_id, is_active)
  WHERE is_active = TRUE;

-- When a new script is marked active, deactivate previous ones
CREATE OR REPLACE FUNCTION deactivate_previous_scripts()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = TRUE THEN
    UPDATE script_uploads
    SET is_active = FALSE
    WHERE project_id = NEW.project_id
      AND id != NEW.id
      AND is_active = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_deactivate_previous_scripts
  AFTER INSERT OR UPDATE OF is_active ON script_uploads
  FOR EACH ROW
  WHEN (NEW.is_active = TRUE)
  EXECUTE FUNCTION deactivate_previous_scripts();


-- ============================================
-- 5. LOOKBOOKS TABLE
-- ============================================
-- Stores generated lookbook metadata. A lookbook is a PDF/document
-- generated from character looks, scene data, and reference photos.
CREATE TABLE IF NOT EXISTS lookbooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- What the lookbook covers
  title TEXT NOT NULL,                         -- e.g. "EMMA - All Looks", "Day 3 Lookbook"
  lookbook_type TEXT NOT NULL DEFAULT 'character'
    CHECK (lookbook_type IN ('character', 'shooting_day', 'full_project', 'custom')),

  -- Optional scoping
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  shooting_day INTEGER,                        -- For day-specific lookbooks

  -- Storage
  storage_path TEXT NOT NULL,                  -- Path in project-documents bucket
  file_name TEXT NOT NULL,
  file_size INTEGER,

  -- Content summary
  look_count INTEGER DEFAULT 0,               -- Number of looks included
  page_count INTEGER DEFAULT 0,               -- Number of pages
  scene_count INTEGER DEFAULT 0,              -- Number of scenes referenced

  -- Source info (what generated this lookbook)
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'script', 'schedule', 'auto')),

  -- Metadata
  generated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lookbooks_project ON lookbooks(project_id);
CREATE INDEX IF NOT EXISTS idx_lookbooks_character ON lookbooks(character_id);
CREATE INDEX IF NOT EXISTS idx_lookbooks_type ON lookbooks(project_id, lookbook_type);


-- ============================================
-- 6. ENABLE RLS ON NEW TABLES
-- ============================================
ALTER TABLE call_sheet_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lookbooks ENABLE ROW LEVEL SECURITY;


-- ============================================
-- 7. RLS POLICIES: call_sheet_data
-- ============================================
CREATE POLICY "Members can view call sheets"
  ON call_sheet_data FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY "Members can create call sheets"
  ON call_sheet_data FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY "Members can update call sheets"
  ON call_sheet_data FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY "Members can delete call sheets"
  ON call_sheet_data FOR DELETE
  USING (is_project_member(project_id));


-- ============================================
-- 8. RLS POLICIES: script_uploads
-- ============================================
CREATE POLICY "Members can view scripts"
  ON script_uploads FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY "Members can upload scripts"
  ON script_uploads FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY "Members can update scripts"
  ON script_uploads FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY "Members can delete scripts"
  ON script_uploads FOR DELETE
  USING (is_project_member(project_id));


-- ============================================
-- 9. RLS POLICIES: lookbooks
-- ============================================
CREATE POLICY "Members can view lookbooks"
  ON lookbooks FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY "Members can create lookbooks"
  ON lookbooks FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY "Members can update lookbooks"
  ON lookbooks FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY "Members can delete lookbooks"
  ON lookbooks FOR DELETE
  USING (is_project_member(project_id));


-- ============================================
-- 10. UPDATE TRIGGERS (updated_at)
-- ============================================
CREATE TRIGGER trigger_call_sheet_data_updated_at
  BEFORE UPDATE ON call_sheet_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_lookbooks_updated_at
  BEFORE UPDATE ON lookbooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
