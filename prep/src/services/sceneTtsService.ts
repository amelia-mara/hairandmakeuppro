/**
 * Client wrapper for the scene-tts Edge Function.
 *
 * Returns a short-lived signed audio URL for a given (projectId, sceneId,
 * text) tuple. The function caches by content hash, so re-requesting the
 * same scene is free server-side; the only cost is the first generation.
 */

import { supabase } from '@/lib/supabase';

export interface SceneTtsResult {
  audioUrl: string;
  cached: boolean;
}

export async function fetchSceneAudio(args: {
  projectId: string;
  sceneId: string;
  text: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'nova' | 'onyx' | 'shimmer';
}): Promise<{ data: SceneTtsResult | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.functions.invoke<SceneTtsResult>(
      'scene-tts',
      { body: args },
    );
    if (error) throw error;
    if (!data) throw new Error('empty_response');
    return { data, error: null };
  } catch (err) {
    console.error('[sceneTts] failed:', err);
    return { data: null, error: err as Error };
  }
}
