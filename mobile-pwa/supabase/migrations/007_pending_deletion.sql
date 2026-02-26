-- Add pending_deletion_at column to projects table
-- When an owner initiates deletion, this timestamp is set instead of immediately hard-deleting.
-- Synced (non-owner) members get a 48-hour grace period to download documents before the project
-- is permanently removed.

ALTER TABLE projects ADD COLUMN pending_deletion_at timestamptz DEFAULT NULL;

-- Allow project members to see the pending_deletion_at value so the client can show warnings
-- (existing SELECT RLS policies already grant this since we're adding to the projects table)
