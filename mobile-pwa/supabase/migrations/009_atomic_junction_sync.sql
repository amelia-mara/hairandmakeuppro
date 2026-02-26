-- Atomic junction table sync functions
-- ==============================================================================
-- The client-side sync used separate DELETE then INSERT calls to update
-- scene_characters and look_scenes junction tables. If two clients synced
-- simultaneously, Client B's DELETE could wipe out Client A's INSERT,
-- silently losing data.
--
-- Fix: Wrap each delete+insert in a single SECURITY DEFINER function so
-- the entire operation runs inside one database transaction.
-- ==============================================================================

-- Atomically replace scene_characters for a set of scenes.
-- Accepts a JSON array of { scene_id, character_id } objects.
CREATE OR REPLACE FUNCTION sync_scene_characters(
  p_scene_ids UUID[],
  p_entries JSONB
)
RETURNS VOID AS $$
BEGIN
  -- Delete existing rows for these scenes
  DELETE FROM scene_characters WHERE scene_id = ANY(p_scene_ids);

  -- Insert new rows
  INSERT INTO scene_characters (scene_id, character_id)
  SELECT
    (entry->>'scene_id')::UUID,
    (entry->>'character_id')::UUID
  FROM jsonb_array_elements(p_entries) AS entry
  ON CONFLICT (scene_id, character_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomically replace look_scenes for a set of looks.
-- Accepts a JSON array of { look_id, scene_number } objects.
CREATE OR REPLACE FUNCTION sync_look_scenes(
  p_look_ids UUID[],
  p_entries JSONB
)
RETURNS VOID AS $$
BEGIN
  -- Delete existing rows for these looks
  DELETE FROM look_scenes WHERE look_id = ANY(p_look_ids);

  -- Insert new rows
  INSERT INTO look_scenes (look_id, scene_number)
  SELECT
    (entry->>'look_id')::UUID,
    entry->>'scene_number'
  FROM jsonb_array_elements(p_entries) AS entry
  ON CONFLICT (look_id, scene_number) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
