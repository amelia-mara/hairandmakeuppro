/**
 * Shared background character detection service.
 *
 * Extracted from Home.tsx so both the initial project creation flow
 * and the script-page upload flow can run the same detection logic.
 */

import { useProjectStore } from '@/stores/projectStore';
import { parseScriptText } from '@/utils/scriptParser';
import { saveInitialProjectData } from '@/services/supabaseProjects';
import type { Project } from '@/types';

/**
 * Run character detection in the background against parsed script text,
 * then update each scene's suggested characters and save to Supabase.
 *
 * Uses whole-script parseScriptText rather than per-scene batch
 * detection. Per-scene detection sees each scene in isolation, so a
 * wordless scene that mentions GWEN by name in action text would find
 * nothing (no cues there + the pass-2 known-name scan needs the
 * global speaker list, which can't be derived from a single scene).
 * Whole-script detection runs pass-1 (cues) across the full text first,
 * builds the canonical speaker list, then runs pass-2 per scene against
 * that global list — wordless scenes correctly back-fill.
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

    // Whole-script parse — produces per-scene character lists derived
    // from the global speaker list, so wordless scenes that mention
    // a character by name still get back-filled.
    const parsed = parseScriptText(rawText);

    // Build a sceneNumber -> character names map from the parsed result.
    const detectedByScene = new Map<string, string[]>();
    for (const ps of parsed.scenes) {
      detectedByScene.set(ps.sceneNumber, ps.characters);
    }

    // If a call-sheet cast list was supplied, fold those names in too:
    // a name from the schedule that appears in a scene's content (Title
    // Case or ALL CAPS) gets added even if pass-1 didn't see it as a
    // speaker. Useful for scripts where the schedule has more names
    // than the parser can validate via cue structure.
    const knownUpper = knownCharacters
      .map((n) => n.trim().toUpperCase())
      .filter((n) => n.length >= 3);

    // Update each scene with suggested characters. Use the current
    // store state to avoid stale closure on the `project` parameter.
    const store = useProjectStore.getState();
    const currentScenes = store.currentProject?.scenes || project.scenes;
    for (const scene of currentScenes) {
      const detected = detectedByScene.get(scene.sceneNumber) ?? [];
      const merged = new Set<string>(detected);
      // Add any schedule-known names that appear in this scene.
      if (knownUpper.length > 0 && scene.scriptContent) {
        const content = scene.scriptContent;
        for (const name of knownUpper) {
          if (merged.has(name)) continue;
          // Title Case / ALL CAPS, word-bounded — same rule as pass-2.
          const titled = name
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase());
          const re = new RegExp(`\\b(?:${name}|${titled})\\b`);
          if (re.test(content)) merged.add(name);
        }
      }
      if (merged.size > 0) {
        store.updateSceneSuggestedCharacters(scene.id, [...merged]);
      }
    }

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
            avatar_colour: c.avatarColour || '#D4943A',
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
