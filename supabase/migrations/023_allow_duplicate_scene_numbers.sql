-- Drop the UNIQUE(project_id, scene_number) constraint on scenes.
--
-- The screenplay domain legitimately produces multiple distinct scenes
-- with the same scene_number:
--   * Split scenes: scene 7 INT/DAY + scene 7 EXT/NIGHT
--   * [FLASHBACK] continuations: scene 47 + scene 47 [FLASHBACK]
--   * Action breaks the parser produces as separate rows under one number
--
-- The previous constraint forced these into a single row, so the script
-- parser's output couldn't round-trip through the DB without data loss.
-- Each scene is uniquely identified by its id (UUID PK); that's enough.
--
-- Other tables that reference scene_number rather than scene_id (e.g.
-- look_scenes via UNIQUE(look_id, scene_number)) keep their own
-- constraints — those are intentional, since look assignments do
-- collapse split scenes onto the same look entry.

ALTER TABLE scenes DROP CONSTRAINT IF EXISTS scenes_project_id_scene_number_key;
