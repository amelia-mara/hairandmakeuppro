-- Checks Happy Database Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'trainee' CHECK (tier IN ('trainee', 'artist', 'supervisor', 'designer')),
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  production_type TEXT NOT NULL DEFAULT 'film',
  status TEXT NOT NULL DEFAULT 'prep' CHECK (status IN ('prep', 'shooting', 'wrapped')),
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for invite code lookups
CREATE INDEX IF NOT EXISTS idx_projects_invite_code ON projects(invite_code);

-- ============================================
-- PROJECT MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'floor' CHECK (role IN ('designer', 'hod', 'supervisor', 'key', 'floor', 'daily', 'trainee')),
  is_owner BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Indexes for project member lookups
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- ============================================
-- CHARACTERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  actor_name TEXT,
  initials TEXT NOT NULL,
  avatar_colour TEXT NOT NULL DEFAULT '#C9A961',
  base_look_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id);

-- ============================================
-- SCENES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_number TEXT NOT NULL,
  int_ext TEXT,
  location TEXT,
  time_of_day TEXT,
  synopsis TEXT,
  page_count DECIMAL(5,2),
  story_day INTEGER,
  shooting_day INTEGER,
  filming_status TEXT,
  filming_notes TEXT,
  is_complete BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, scene_number)
);

CREATE INDEX IF NOT EXISTS idx_scenes_project ON scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_scenes_shooting_day ON scenes(project_id, shooting_day);

-- ============================================
-- SCENE_CHARACTERS (Junction Table)
-- ============================================
CREATE TABLE IF NOT EXISTS scene_characters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  UNIQUE(scene_id, character_id)
);

CREATE INDEX IF NOT EXISTS idx_scene_characters_scene ON scene_characters(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_characters_character ON scene_characters(character_id);

-- ============================================
-- LOOKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS looks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  estimated_time INTEGER NOT NULL DEFAULT 30,
  makeup_details JSONB,
  hair_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_looks_project ON looks(project_id);
CREATE INDEX IF NOT EXISTS idx_looks_character ON looks(character_id);

-- ============================================
-- LOOK_SCENES (Junction Table)
-- ============================================
CREATE TABLE IF NOT EXISTS look_scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  look_id UUID NOT NULL REFERENCES looks(id) ON DELETE CASCADE,
  scene_number TEXT NOT NULL,
  UNIQUE(look_id, scene_number)
);

CREATE INDEX IF NOT EXISTS idx_look_scenes_look ON look_scenes(look_id);

-- ============================================
-- CONTINUITY EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS continuity_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  look_id UUID REFERENCES looks(id) ON DELETE SET NULL,
  shooting_day INTEGER,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'checked')),
  hair_notes TEXT,
  makeup_notes TEXT,
  prosthetics_notes TEXT,
  wounds_blood_notes TEXT,
  general_notes TEXT,
  application_time INTEGER,
  continuity_flags JSONB,
  continuity_events_data JSONB,
  sfx_details JSONB,
  checked_by UUID REFERENCES users(id),
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(scene_id, character_id)
);

CREATE INDEX IF NOT EXISTS idx_continuity_events_scene ON continuity_events(scene_id);
CREATE INDEX IF NOT EXISTS idx_continuity_events_character ON continuity_events(character_id);

-- ============================================
-- PHOTOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  continuity_event_id UUID NOT NULL REFERENCES continuity_events(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  photo_type TEXT NOT NULL DEFAULT 'on_set' CHECK (photo_type IN ('reference', 'on_set', 'wrap')),
  angle TEXT NOT NULL DEFAULT 'front' CHECK (angle IN ('front', 'left', 'right', 'back', 'detail', 'additional')),
  notes TEXT,
  taken_by UUID REFERENCES users(id),
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photos_continuity_event ON photos(continuity_event_id);

-- ============================================
-- SCHEDULE DATA TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS schedule_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  raw_pdf_text TEXT,
  cast_list JSONB,
  days JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'partial')),
  processing_progress JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_data_project ON schedule_data(project_id);

-- ============================================
-- TIMESHEETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS timesheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_starting DATE NOT NULL,
  entries JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id, week_starting)
);

CREATE INDEX IF NOT EXISTS idx_timesheets_project_user ON timesheets(project_id, user_id);

-- ============================================
-- HELPER FUNCTION: Generate Invite Code
-- ============================================
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  -- Generate format: XXX-XXXX (e.g., TMK-4827)
  FOR i IN 1..3 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-generate invite code
-- ============================================
CREATE OR REPLACE FUNCTION set_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    NEW.invite_code := generate_invite_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_invite_code
  BEFORE INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION set_invite_code();

-- ============================================
-- TRIGGER: Update timesheets.updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_timesheets_updated_at
  BEFORE UPDATE ON timesheets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
