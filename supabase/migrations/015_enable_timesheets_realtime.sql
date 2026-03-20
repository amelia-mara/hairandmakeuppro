-- ============================================================================
-- Migration 015: Enable Realtime on timesheets table
-- Required for Prep ↔ App timesheet sync (hours logging + approval)
-- ============================================================================

-- Enable Realtime for timesheets (was missing from initial setup)
ALTER TABLE timesheets REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE timesheets;
