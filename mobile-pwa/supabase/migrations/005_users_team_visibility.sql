-- Users Team Visibility Policy
-- ==============================================================================
-- Run this AFTER 004_join_project_rpc.sql
--
-- Problem: The existing "Users can view own profile" policy only allows users
-- to see their own row in the users table. When getProjectMembers() joins
-- project_members with users, the INNER JOIN filters out all other members
-- because the current user can't read other users' profiles.
--
-- Fix: Add a SELECT policy that lets project members see the profiles of
-- other members who share at least one project with them.
-- ==============================================================================

-- Allow project members to view profiles of teammates
CREATE POLICY "Project members can view teammate profiles"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM project_members my_membership
      JOIN project_members their_membership
        ON my_membership.project_id = their_membership.project_id
      WHERE my_membership.user_id = auth.uid()
        AND their_membership.user_id = users.id
    )
  );
