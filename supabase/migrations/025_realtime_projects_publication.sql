-- F-33: §2.4 Realtime DELETE subscription on the `projects` table
-- silently no-ops because `projects` is not in the supabase_realtime
-- publication. Postgres Realtime accepts the subscription and reports
-- SUBSCRIBED, but no events ever arrive. Publish DELETE-only — the
-- only consumer (handleProjectDeleted in realtimeSync.ts) wants
-- DELETE; UPDATE / INSERT remain silent so project metadata (name,
-- has_prep_access, pending_deletion_at) does not broadcast on the
-- channel, narrowing the metadata-leak surface compared to a full
-- publish.
ALTER PUBLICATION supabase_realtime
  ADD TABLE projects WITH (publish = 'delete');

-- F-33b (drive-by): self-heal `project_members` publication if it's
-- missing. Migration 019 attempted to add it via an idempotent
-- DO-block, but an audit of the live database via
-- pg_publication_tables returned empty for project_members on the
-- environment where F-33 was first reproduced — either 019 didn't
-- land here, the publication was reset via Studio's UI, or some
-- other path dropped the membership. handleMemberAccessChange in
-- realtimeSync.ts would silently no-op in exactly the same way as
-- §2.4 did. Idempotent block prevents a duplicate-add error if the
-- table is already in the publication.
--
-- Full publish (not delete-only) because handleMemberAccessChange
-- legitimately wants UPDATE when access toggles flip, plus DELETE
-- when a user is removed. project_members rows are scoped to
-- (project_id, user_id) so the metadata-leak surface is narrower
-- than for the projects table itself.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'project_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE project_members;
  END IF;
END $$;
