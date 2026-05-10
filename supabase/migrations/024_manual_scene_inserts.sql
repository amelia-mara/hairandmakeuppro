-- Add columns to support user-inserted scene breaks.
--
-- The screenplay parser occasionally misses a scene heading (e.g. when
-- the slugline is malformed or sits inline in action text). Users can
-- now right-click in the script viewer to insert a scene break at the
-- nearest paragraph boundary. These manually-inserted scenes need to
-- survive logout/login and round-trip through revisions, so we persist
-- three fields alongside the normal scene columns:
--
--   * manually_inserted — true for scenes the user added by hand. Used
--     by the re-parse merge to identify candidates for either
--     transferring breakdown data onto a freshly-parsed scene, or
--     re-injecting the manual scene into the new draft when the parser
--     still misses the heading.
--   * needs_review — flipped to true when a re-parse runs and the
--     manual scene couldn't be matched to a parsed scene. Surfaced as
--     a badge on the script-view heading so the user knows to confirm
--     the placement.
--   * number_suffix — an alphabetic suffix shown after scene_number
--     (e.g. "5A", "5B") so inserted scenes don't disturb the numbering
--     of existing scenes. Stored separately because scene_number is a
--     bigint column and cannot hold the letter.

ALTER TABLE scenes
  ADD COLUMN IF NOT EXISTS manually_inserted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS number_suffix text;
