import type { Look, Scene, SceneCapture } from '@/types';
import type { ProjectSet, ProjectGet } from './types';

export const createLookSlice = (set: ProjectSet, get: ProjectGet) => ({
  // Look updates
  updateLook: (lookId: string, updates: Partial<Look>) => {
    set((state) => {
      if (!state.currentProject) return state;

      return {
        currentProject: {
          ...state.currentProject,
          looks: state.currentProject.looks.map((look) =>
            look.id === lookId ? { ...look, ...updates } : look
          ),
        },
      };
    });
  },

  // Update look and propagate defaults to scene captures that haven't been customized
  updateLookWithPropagation: (lookId: string, updates: Partial<Look>) => {
    const state = get();
    if (!state.currentProject) return;

    const look = state.currentProject.looks.find(l => l.id === lookId);
    if (!look) return;

    // First update the look itself
    set((s) => {
      if (!s.currentProject) return s;
      return {
        currentProject: {
          ...s.currentProject,
          looks: s.currentProject.looks.map((l) =>
            l.id === lookId ? { ...l, ...updates } : l
          ),
        },
      };
    });

    // Then propagate to scene captures
    const newCaptures = { ...state.sceneCaptures };
    let changed = false;

    for (const sceneNum of look.scenes) {
      const scene: Scene | undefined = state.currentProject.scenes.find(s => s.sceneNumber === sceneNum);
      if (!scene) continue;

      const captureKey = `${scene.id}-${look.characterId}`;
      const capture = newCaptures[captureKey];
      if (!capture) continue;

      const captureUpdates: Partial<SceneCapture> = {};

      // Propagate continuity flags if scene capture still has all-false defaults
      if (updates.continuityFlags) {
        const flags = capture.continuityFlags;
        const allDefault = !flags.sweat && !flags.dishevelled && !flags.blood && !flags.dirt && !flags.wetHair && !flags.tears;
        if (allDefault) {
          captureUpdates.continuityFlags = { ...updates.continuityFlags };
        }
      }

      // Propagate notes if scene capture notes are empty
      if (updates.notes !== undefined && !capture.notes) {
        captureUpdates.notes = updates.notes;
      }

      // Propagate SFX if scene capture has default SFX (not required, no types)
      if (updates.sfxDetails) {
        if (!capture.sfxDetails.sfxRequired && capture.sfxDetails.sfxTypes.length === 0) {
          captureUpdates.sfxDetails = { ...updates.sfxDetails };
        }
      }

      if (Object.keys(captureUpdates).length > 0) {
        newCaptures[captureKey] = { ...capture, ...captureUpdates };
        changed = true;
      }
    }

    if (changed) {
      set({ sceneCaptures: newCaptures });
    }
  },

  getLookForCharacterInScene: (characterId: string, sceneNumber: string) => {
    return get().currentProject?.looks.find(
      l => l.characterId === characterId && l.scenes.includes(sceneNumber)
    );
  },
});
