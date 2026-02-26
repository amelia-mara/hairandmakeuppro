import type { Scene, SceneCapture, SceneFilmingStatus } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectSet, ProjectGet } from './types';

export const createSceneSlice = (set: ProjectSet, get: ProjectGet) => ({
  // Scene management
  addScene: (sceneData: Partial<Scene> & { sceneNumber: string }): Scene => {
    const newScene: Scene = {
      id: uuidv4(),
      sceneNumber: sceneData.sceneNumber,
      slugline: sceneData.slugline || `Scene ${sceneData.sceneNumber}`,
      intExt: sceneData.intExt || 'INT',
      timeOfDay: sceneData.timeOfDay || 'DAY',
      synopsis: sceneData.synopsis,
      scriptContent: sceneData.scriptContent,
      characters: sceneData.characters || [],
      isComplete: false,
      characterConfirmationStatus: 'confirmed', // New scenes from call sheet are considered confirmed
      shootingDay: sceneData.shootingDay,
    };

    set((state) => {
      if (!state.currentProject) return state;

      // Insert scene in order by scene number
      const scenes = [...state.currentProject.scenes, newScene].sort((a, b) => {
        // Extract numeric part for sorting
        const numA = parseInt(a.sceneNumber.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.sceneNumber.replace(/\D/g, '')) || 0;
        if (numA !== numB) return numA - numB;
        // If same number, sort alphabetically
        return a.sceneNumber.localeCompare(b.sceneNumber);
      });

      return {
        currentProject: {
          ...state.currentProject,
          scenes,
        },
      };
    });

    return newScene;
  },

  addCharacterToScene: (sceneId: string, characterId: string) => {
    set((state) => {
      if (!state.currentProject) return state;

      return {
        currentProject: {
          ...state.currentProject,
          scenes: state.currentProject.scenes.map((s) =>
            s.id === sceneId && !s.characters.includes(characterId)
              ? { ...s, characters: [...s.characters, characterId] }
              : s
          ),
        },
      };
    });
  },

  // Scene completion
  markSceneComplete: (sceneId: string) => {
    set((state) => {
      if (!state.currentProject) return state;

      return {
        currentProject: {
          ...state.currentProject,
          scenes: state.currentProject.scenes.map((s) =>
            s.id === sceneId
              ? { ...s, isComplete: true, completedAt: new Date() }
              : s
          ),
        },
      };
    });
  },

  markSceneIncomplete: (sceneId: string) => {
    set((state) => {
      if (!state.currentProject) return state;

      return {
        currentProject: {
          ...state.currentProject,
          scenes: state.currentProject.scenes.map((s) =>
            s.id === sceneId
              ? { ...s, isComplete: false, completedAt: undefined }
              : s
          ),
        },
      };
    });
  },

  copyToNextScene: (currentSceneId: string, characterId: string): string | null => {
    const state = get();
    if (!state.currentProject) return null;

    const currentScene = state.currentProject.scenes.find(s => s.id === currentSceneId);
    if (!currentScene) return null;

    // Find next scene with this character
    const nextScene = state.currentProject.scenes.find(
      s => s.sceneNumber > currentScene.sceneNumber && s.characters.includes(characterId)
    );
    if (!nextScene) return null;

    const currentCapture = state.sceneCaptures[`${currentSceneId}-${characterId}`];
    if (!currentCapture) return nextScene.id;

    // Create new capture for next scene, copying data (but not photos)
    const newCaptureKey = `${nextScene.id}-${characterId}`;
    const newCapture: SceneCapture = {
      id: uuidv4(),
      sceneId: nextScene.id,
      characterId,
      lookId: currentCapture.lookId,
      capturedAt: new Date(),
      photos: {}, // Don't copy photos
      additionalPhotos: [], // Don't copy photos
      continuityFlags: { ...currentCapture.continuityFlags },
      continuityEvents: currentCapture.continuityEvents.map(e => ({ ...e, id: uuidv4() })),
      sfxDetails: {
        ...currentCapture.sfxDetails,
        sfxReferencePhotos: [], // Don't copy SFX reference photos
      },
      notes: currentCapture.notes,
      applicationTime: currentCapture.applicationTime,
    };

    set((state) => ({
      sceneCaptures: {
        ...state.sceneCaptures,
        [newCaptureKey]: newCapture,
      },
      currentSceneId: nextScene.id,
    }));

    return nextScene.id;
  },

  // Scene filming status - syncs to project scenes for Breakdown view
  updateSceneFilmingStatus: (sceneNumber: string, filmingStatus: SceneFilmingStatus, filmingNotes?: string) => {
    set((state) => {
      if (!state.currentProject) return state;

      return {
        currentProject: {
          ...state.currentProject,
          scenes: state.currentProject.scenes.map((s) =>
            s.sceneNumber === sceneNumber
              ? { ...s, filmingStatus, filmingNotes }
              : s
          ),
        },
      };
    });
  },

  // Scene synopsis - update a single scene's synopsis
  updateSceneSynopsis: (sceneId: string, synopsis: string) => {
    set((state) => {
      if (!state.currentProject) return state;

      return {
        currentProject: {
          ...state.currentProject,
          scenes: state.currentProject.scenes.map((s) =>
            s.id === sceneId ? { ...s, synopsis } : s
          ),
        },
      };
    });
  },

  // Scene synopsis - update all scenes with new synopsis data (used after sync/generate)
  updateAllSceneSynopses: (updatedScenes: Scene[]) => {
    set((state) => {
      if (!state.currentProject) return state;

      // Create a map of scene id to synopsis for quick lookup
      const synopsisMap = new Map<string, string | undefined>();
      updatedScenes.forEach(s => {
        if (s.synopsis) {
          synopsisMap.set(s.id, s.synopsis);
        }
      });

      return {
        currentProject: {
          ...state.currentProject,
          scenes: state.currentProject.scenes.map((s) => {
            const newSynopsis = synopsisMap.get(s.id);
            return newSynopsis ? { ...s, synopsis: newSynopsis } : s;
          }),
        },
      };
    });
  },

  // Getters
  getScene: (sceneId: string) => {
    return get().currentProject?.scenes.find(s => s.id === sceneId);
  },

  getFilteredScenes: () => {
    const state = get();
    if (!state.currentProject) return [];

    let scenes = [...state.currentProject.scenes];

    // Filter by completion status
    if (state.sceneFilter === 'complete') {
      scenes = scenes.filter(s => s.isComplete);
    } else if (state.sceneFilter === 'incomplete') {
      scenes = scenes.filter(s => !s.isComplete);
    }

    // Filter by search query
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      scenes = scenes.filter(
        s =>
          s.sceneNumber.toString().includes(query) ||
          s.slugline.toLowerCase().includes(query)
      );
    }

    return scenes.sort((a, b) => a.sceneNumber.localeCompare(b.sceneNumber, undefined, { numeric: true }));
  },

  getScenesForLook: (lookId: string) => {
    const state = get();
    if (!state.currentProject) return [];

    const look = state.currentProject.looks.find(l => l.id === lookId);
    if (!look) return [];

    return state.currentProject.scenes
      .filter(s => look.scenes.includes(s.sceneNumber))
      .sort((a, b) => a.sceneNumber.localeCompare(b.sceneNumber, undefined, { numeric: true }));
  },
});
