/**
 * Shared background character detection service.
 *
 * Extracted from Home.tsx so both the initial project creation flow
 * and the script-page upload flow can run the same detection logic.
 */

import { useProjectStore } from '@/stores/projectStore';
import { detectCharactersForScenesBatch } from '@/utils/scriptParser';
import { saveInitialProjectData } from '@/services/supabaseProjects';
import type { Project } from '@/types';

/**
 * Run character detection in the background against parsed script text,
 * then update each scene's suggested characters and save to Supabase.
 */
export async function runBackgroundCharacterDetection(
  project: Project,
  rawText: string,
  knownCharacters: string[] = [],
  projectId?: string,
  userId?: string | null,
): Promise<void> {
  try {
    // Mark detection as running
    useProjectStore.getState().startCharacterDetection();

    // Prepare scenes for batch detection
    const scenesToDetect = project.scenes.map((s) => ({
      sceneNumber: s.sceneNumber,
      scriptContent: s.scriptContent || '',
    }));

    // Detect characters in batches
    const results = await detectCharactersForScenesBatch(
      scenesToDetect,
      rawText,
      {
        useAI: false, // Use regex only for fast initial detection
        knownCharacters: knownCharacters.length > 0 ? knownCharacters : undefined,
        onProgress: () => {},
      }
    );

    // Update each scene with suggested characters
    // Use current store state to avoid stale closure on `project` parameter
    const store = useProjectStore.getState();
    const currentScenes = store.currentProject?.scenes || project.scenes;
    results.forEach((characters, sceneNumber) => {
      const scene = currentScenes.find((s) => s.sceneNumber === sceneNumber);
      if (scene) {
        store.updateSceneSuggestedCharacters(scene.id, characters);
      }
    });

    // Mark detection as complete
    store.setCharacterDetectionStatus('complete');

    // Save detected characters to Supabase
    const pid = projectId || store.currentProject?.id;
    if (pid) {
      const updatedProject = useProjectStore.getState().currentProject;
      if (updatedProject && updatedProject.characters.length > 0) {
        const { error: saveErr } = await saveInitialProjectData({
          projectId: pid,
          userId: userId ?? null,
          scenes: [], // already saved
          characters: updatedProject.characters.map(c => ({
            id: c.id,
            name: c.name,
            initials: c.initials,
            avatar_colour: c.avatarColour || '#C9A961',
          })),
          sceneCharacters: updatedProject.scenes.flatMap(s =>
            s.characters.map(charId => ({ scene_id: s.id, character_id: charId }))
          ),
        });
        if (saveErr) {
          console.error('[CharDetection] Failed to save characters to server:', saveErr);
        }
      }
    }
  } catch (error) {
    console.error('Background character detection failed:', error);
    // Still mark as complete so user can manually add characters
    useProjectStore.getState().setCharacterDetectionStatus('complete');
  }
}
