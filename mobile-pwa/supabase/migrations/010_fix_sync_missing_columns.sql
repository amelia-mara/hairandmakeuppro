-- Fix Sync: Enable Realtime publication for live collaboration
-- ==============================================================================
-- This migration fixes a critical issue preventing real-time sync between users:
--
-- Supabase Realtime requires tables to be explicitly added to the
-- supabase_realtime publication. Without this, postgres_changes
-- subscriptions never fire, so User A's changes are never broadcast
-- to User B in real-time. Users would only see updates after a full
-- page refresh (which triggers a fresh pull from the server).
--
-- Also ensures the script_content and storage_path columns exist
-- (these may have already been added manually via SQL Editor).
--
-- Run this in Supabase SQL Editor AFTER running migrations 001-009.
-- ==============================================================================


-- ============================================
-- 1. ENSURE MISSING COLUMNS EXIST
-- ============================================
-- These store parsed script text per scene and schedule PDF path.
-- IF NOT EXISTS makes this safe to re-run if already added.
ALTER TABLE scenes ADD COLUMN IF NOT EXISTS script_content TEXT;
ALTER TABLE schedule_data ADD COLUMN IF NOT EXISTS storage_path TEXT;


-- ============================================
-- 2. ENABLE REALTIME FOR SYNC-CRITICAL TABLES
-- ============================================
-- Supabase Realtime uses PostgreSQL logical replication. Tables must
-- be added to the supabase_realtime publication AND have REPLICA
-- IDENTITY FULL so UPDATE/DELETE payloads include all columns.

-- Set REPLICA IDENTITY FULL so realtime payloads include all row data
ALTER TABLE scenes REPLICA IDENTITY FULL;
ALTER TABLE characters REPLICA IDENTITY FULL;
ALTER TABLE looks REPLICA IDENTITY FULL;
ALTER TABLE continuity_events REPLICA IDENTITY FULL;
ALTER TABLE photos REPLICA IDENTITY FULL;
ALTER TABLE schedule_data REPLICA IDENTITY FULL;
ALTER TABLE call_sheet_data REPLICA IDENTITY FULL;
ALTER TABLE script_uploads REPLICA IDENTITY FULL;
ALTER TABLE scene_characters REPLICA IDENTITY FULL;
ALTER TABLE look_scenes REPLICA IDENTITY FULL;

-- Add tables to the realtime publication
-- (Supabase creates supabase_realtime automatically)
ALTER PUBLICATION supabase_realtime ADD TABLE scenes;
ALTER PUBLICATION supabase_realtime ADD TABLE characters;
ALTER PUBLICATION supabase_realtime ADD TABLE looks;
ALTER PUBLICATION supabase_realtime ADD TABLE continuity_events;
ALTER PUBLICATION supabase_realtime ADD TABLE photos;
ALTER PUBLICATION supabase_realtime ADD TABLE schedule_data;
ALTER PUBLICATION supabase_realtime ADD TABLE call_sheet_data;
ALTER PUBLICATION supabase_realtime ADD TABLE script_uploads;
ALTER PUBLICATION supabase_realtime ADD TABLE scene_characters;
ALTER PUBLICATION supabase_realtime ADD TABLE look_scenes;
