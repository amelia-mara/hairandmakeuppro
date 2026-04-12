-- ============================================================================
-- Migration 019: Add per-member access toggles to project_members
--
-- Enables project owners to toggle individual features on/off for each
-- team member. This is entirely separate from subscription tiers —
-- tiers gate own-project features, toggles gate joined-project features.
--
-- Budget defaults to OFF. Everything else defaults to ON. Inviting
-- someone gives full access by default; the owner restricts from there.
--
-- Safe to run on a live database — all statements use IF NOT EXISTS
-- or are additive-only.
-- ============================================================================

-- 1. Add access toggle columns
ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS access_breakdown BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS access_script BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS access_lookbook BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS access_callsheets BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS access_chat BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS access_continuity BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS access_hours BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS access_receipts BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS access_budget BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_export_hours BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS access_export_invoice BOOLEAN NOT NULL DEFAULT true;

-- 2. Existing RLS policies from migration 011 already cover SELECT/UPDATE
-- on project_members for members and owners respectively. The new columns
-- are automatically included in those policies since they use table-level
-- USING/WITH CHECK clauses. No new policies needed.
--
-- Existing policies:
--   SELECT: member of the project (via is_project_member)
--   UPDATE: project owner only (via is_project_owner)
--   INSERT: self-join (via join_project_by_invite_code RPC)
--   DELETE: project owner or self (leave)

-- 3. Enable Realtime on project_members so access changes propagate
-- immediately to the team member's open app.
ALTER TABLE public.project_members REPLICA IDENTITY FULL;

-- Check if already in publication before adding (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'project_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_members;
  END IF;
END $$;
