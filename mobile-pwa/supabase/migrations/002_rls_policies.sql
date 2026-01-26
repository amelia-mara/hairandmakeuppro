-- Checks Happy Row-Level Security Policies
-- Run this AFTER 001_initial_schema.sql

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scene_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE looks ENABLE ROW LEVEL SECURITY;
ALTER TABLE look_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE continuity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: Check if user is project member
-- ============================================
CREATE OR REPLACE FUNCTION is_project_member(project_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = project_uuid
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HELPER FUNCTION: Check if user is project owner
-- ============================================
CREATE OR REPLACE FUNCTION is_project_owner(project_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = project_uuid
    AND user_id = auth.uid()
    AND is_owner = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- USERS POLICIES
-- ============================================
-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile (during signup)
CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- PROJECTS POLICIES
-- ============================================
-- Members can view projects they belong to
CREATE POLICY "Project members can view projects"
  ON projects FOR SELECT
  USING (is_project_member(id));

-- Authenticated users can create projects
CREATE POLICY "Authenticated users can create projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Only owners can update projects
CREATE POLICY "Project owners can update projects"
  ON projects FOR UPDATE
  USING (is_project_owner(id));

-- Only owners can delete projects
CREATE POLICY "Project owners can delete projects"
  ON projects FOR DELETE
  USING (is_project_owner(id));

-- Allow anyone to look up projects by invite code (for joining)
CREATE POLICY "Anyone can lookup project by invite code"
  ON projects FOR SELECT
  USING (TRUE);

-- ============================================
-- PROJECT MEMBERS POLICIES
-- ============================================
-- Members can view other members of their projects
CREATE POLICY "Project members can view members"
  ON project_members FOR SELECT
  USING (is_project_member(project_id));

-- Users can insert themselves as members (when joining)
CREATE POLICY "Users can join projects"
  ON project_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Owners can update member roles
CREATE POLICY "Project owners can update members"
  ON project_members FOR UPDATE
  USING (is_project_owner(project_id));

-- Owners can remove members, users can remove themselves
CREATE POLICY "Project owners can delete members"
  ON project_members FOR DELETE
  USING (is_project_owner(project_id) OR auth.uid() = user_id);

-- ============================================
-- CHARACTERS POLICIES
-- ============================================
CREATE POLICY "Project members can view characters"
  ON characters FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY "Project members can create characters"
  ON characters FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY "Project members can update characters"
  ON characters FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY "Project members can delete characters"
  ON characters FOR DELETE
  USING (is_project_member(project_id));

-- ============================================
-- SCENES POLICIES
-- ============================================
CREATE POLICY "Project members can view scenes"
  ON scenes FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY "Project members can create scenes"
  ON scenes FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY "Project members can update scenes"
  ON scenes FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY "Project members can delete scenes"
  ON scenes FOR DELETE
  USING (is_project_member(project_id));

-- ============================================
-- SCENE_CHARACTERS POLICIES
-- ============================================
CREATE POLICY "Project members can view scene_characters"
  ON scene_characters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM scenes s
      WHERE s.id = scene_id
      AND is_project_member(s.project_id)
    )
  );

CREATE POLICY "Project members can create scene_characters"
  ON scene_characters FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scenes s
      WHERE s.id = scene_id
      AND is_project_member(s.project_id)
    )
  );

CREATE POLICY "Project members can delete scene_characters"
  ON scene_characters FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM scenes s
      WHERE s.id = scene_id
      AND is_project_member(s.project_id)
    )
  );

-- ============================================
-- LOOKS POLICIES
-- ============================================
CREATE POLICY "Project members can view looks"
  ON looks FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY "Project members can create looks"
  ON looks FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY "Project members can update looks"
  ON looks FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY "Project members can delete looks"
  ON looks FOR DELETE
  USING (is_project_member(project_id));

-- ============================================
-- LOOK_SCENES POLICIES
-- ============================================
CREATE POLICY "Project members can view look_scenes"
  ON look_scenes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM looks l
      WHERE l.id = look_id
      AND is_project_member(l.project_id)
    )
  );

CREATE POLICY "Project members can create look_scenes"
  ON look_scenes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM looks l
      WHERE l.id = look_id
      AND is_project_member(l.project_id)
    )
  );

CREATE POLICY "Project members can delete look_scenes"
  ON look_scenes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM looks l
      WHERE l.id = look_id
      AND is_project_member(l.project_id)
    )
  );

-- ============================================
-- CONTINUITY EVENTS POLICIES
-- ============================================
CREATE POLICY "Project members can view continuity_events"
  ON continuity_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM scenes s
      WHERE s.id = scene_id
      AND is_project_member(s.project_id)
    )
  );

CREATE POLICY "Project members can create continuity_events"
  ON continuity_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scenes s
      WHERE s.id = scene_id
      AND is_project_member(s.project_id)
    )
  );

CREATE POLICY "Project members can update continuity_events"
  ON continuity_events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM scenes s
      WHERE s.id = scene_id
      AND is_project_member(s.project_id)
    )
  );

CREATE POLICY "Project members can delete continuity_events"
  ON continuity_events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM scenes s
      WHERE s.id = scene_id
      AND is_project_member(s.project_id)
    )
  );

-- ============================================
-- PHOTOS POLICIES
-- ============================================
CREATE POLICY "Project members can view photos"
  ON photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM continuity_events ce
      JOIN scenes s ON s.id = ce.scene_id
      WHERE ce.id = continuity_event_id
      AND is_project_member(s.project_id)
    )
  );

CREATE POLICY "Project members can create photos"
  ON photos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM continuity_events ce
      JOIN scenes s ON s.id = ce.scene_id
      WHERE ce.id = continuity_event_id
      AND is_project_member(s.project_id)
    )
  );

CREATE POLICY "Project members can delete photos"
  ON photos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM continuity_events ce
      JOIN scenes s ON s.id = ce.scene_id
      WHERE ce.id = continuity_event_id
      AND is_project_member(s.project_id)
    )
  );

-- ============================================
-- SCHEDULE DATA POLICIES
-- ============================================
CREATE POLICY "Project members can view schedule_data"
  ON schedule_data FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY "Project members can create schedule_data"
  ON schedule_data FOR INSERT
  WITH CHECK (is_project_member(project_id));

CREATE POLICY "Project members can update schedule_data"
  ON schedule_data FOR UPDATE
  USING (is_project_member(project_id));

CREATE POLICY "Project members can delete schedule_data"
  ON schedule_data FOR DELETE
  USING (is_project_member(project_id));

-- ============================================
-- TIMESHEETS POLICIES
-- ============================================
-- Users can view their own timesheets
CREATE POLICY "Users can view own timesheets"
  ON timesheets FOR SELECT
  USING (auth.uid() = user_id);

-- Owners/supervisors can view all timesheets in their projects
CREATE POLICY "Project owners can view all timesheets"
  ON timesheets FOR SELECT
  USING (is_project_owner(project_id));

-- Users can create their own timesheets
CREATE POLICY "Users can create own timesheets"
  ON timesheets FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_project_member(project_id));

-- Users can update their own timesheets
CREATE POLICY "Users can update own timesheets"
  ON timesheets FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own timesheets
CREATE POLICY "Users can delete own timesheets"
  ON timesheets FOR DELETE
  USING (auth.uid() = user_id);
