-- ============================================================================
-- 022_scene_tts_audio.sql
-- Storage bucket for cached scene-by-scene TTS audio.
--
-- The Edge Function `scene-tts` calls OpenAI's TTS API and uploads the
-- resulting MP3 here, keyed `${projectId}/${sceneId}-${textHash}.mp3`. The
-- text-hash suffix invalidates the cache automatically when a script
-- revision changes the scene's content.
--
-- Owner-tier gate is enforced inside the Edge Function (which has service
-- role); this RLS just protects direct client access to the bucket.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('scene-audio', 'scene-audio', false)
ON CONFLICT (id) DO NOTHING;

-- Project members can read audio for projects they belong to. The path
-- always starts with the projectId, so we extract it via split_part.
CREATE POLICY "Project members can read scene audio"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'scene-audio'
    AND EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = auth.uid()
        AND pm.project_id::text = split_part(name, '/', 1)
    )
  );

-- Direct writes from the client are blocked — only the Edge Function
-- (running with service role) writes to this bucket.
