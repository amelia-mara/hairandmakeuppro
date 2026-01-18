import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Project,
  Scene,
  Character,
  Look,
  SceneCapture,
  Photo,
  ContinuityFlags,
  ContinuityEvent,
  NavTab,
  SceneFilter,
} from '@/types';
import {
  createEmptyContinuityFlags,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface ProjectState {
  // Current state
  currentProject: Project | null;
  currentSceneId: string | null;
  currentCharacterId: string | null;
  activeTab: NavTab;
  sceneFilter: SceneFilter;
  searchQuery: string;

  // Scene captures (working data during shooting)
  sceneCaptures: Record<string, SceneCapture>;

  // Actions - Project
  setProject: (project: Project) => void;
  clearProject: () => void;

  // Actions - Navigation
  setActiveTab: (tab: NavTab) => void;
  setCurrentScene: (sceneId: string | null) => void;
  setCurrentCharacter: (characterId: string | null) => void;
  setSceneFilter: (filter: SceneFilter) => void;
  setSearchQuery: (query: string) => void;

  // Actions - Scene Capture
  getOrCreateSceneCapture: (sceneId: string, characterId: string) => SceneCapture;
  updateSceneCapture: (captureId: string, updates: Partial<SceneCapture>) => void;
  addPhotoToCapture: (captureId: string, photo: Photo, slot: keyof SceneCapture['photos'] | 'additional') => void;
  removePhotoFromCapture: (captureId: string, slot: keyof SceneCapture['photos'] | 'additional', photoId?: string) => void;
  toggleContinuityFlag: (captureId: string, flag: keyof ContinuityFlags) => void;
  addContinuityEvent: (captureId: string, event: ContinuityEvent) => void;
  updateContinuityEvent: (captureId: string, eventId: string, updates: Partial<ContinuityEvent>) => void;
  removeContinuityEvent: (captureId: string, eventId: string) => void;

  // Actions - Scene Completion
  markSceneComplete: (sceneId: string) => void;
  markSceneIncomplete: (sceneId: string) => void;
  copyToNextScene: (currentSceneId: string, characterId: string) => string | null;

  // Computed/Derived
  getScene: (sceneId: string) => Scene | undefined;
  getCharacter: (characterId: string) => Character | undefined;
  getLookForCharacterInScene: (characterId: string, sceneNumber: number) => Look | undefined;
  getSceneCapture: (sceneId: string, characterId: string) => SceneCapture | undefined;
  getFilteredScenes: () => Scene[];
  getScenesForLook: (lookId: string) => Scene[];
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentProject: null,
      currentSceneId: null,
      currentCharacterId: null,
      activeTab: 'scenes',
      sceneFilter: 'all',
      searchQuery: '',
      sceneCaptures: {},

      // Project actions
      setProject: (project) => set({ currentProject: project }),
      clearProject: () => set({
        currentProject: null,
        currentSceneId: null,
        currentCharacterId: null,
        sceneCaptures: {},
      }),

      // Navigation actions
      setActiveTab: (tab) => set({ activeTab: tab }),
      setCurrentScene: (sceneId) => set({ currentSceneId: sceneId }),
      setCurrentCharacter: (characterId) => set({ currentCharacterId: characterId }),
      setSceneFilter: (filter) => set({ sceneFilter: filter }),
      setSearchQuery: (query) => set({ searchQuery: query }),

      // Scene Capture actions
      getOrCreateSceneCapture: (sceneId, characterId) => {
        const state = get();
        const key = `${sceneId}-${characterId}`;
        const existing = state.sceneCaptures[key];

        if (existing) return existing;

        const look = state.currentProject?.looks.find(
          l => l.characterId === characterId &&
          l.scenes.includes(state.currentProject?.scenes.find(s => s.id === sceneId)?.sceneNumber ?? -1)
        );

        const newCapture: SceneCapture = {
          id: key,
          sceneId,
          characterId,
          lookId: look?.id ?? '',
          capturedAt: new Date(),
          photos: {},
          additionalPhotos: [],
          continuityFlags: createEmptyContinuityFlags(),
          continuityEvents: [],
          notes: '',
        };

        set((state) => ({
          sceneCaptures: {
            ...state.sceneCaptures,
            [key]: newCapture,
          },
        }));

        return newCapture;
      },

      updateSceneCapture: (captureId, updates) => {
        set((state) => ({
          sceneCaptures: {
            ...state.sceneCaptures,
            [captureId]: {
              ...state.sceneCaptures[captureId],
              ...updates,
            },
          },
        }));
      },

      addPhotoToCapture: (captureId, photo, slot) => {
        set((state) => {
          const capture = state.sceneCaptures[captureId];
          if (!capture) return state;

          if (slot === 'additional') {
            return {
              sceneCaptures: {
                ...state.sceneCaptures,
                [captureId]: {
                  ...capture,
                  additionalPhotos: [...capture.additionalPhotos, photo],
                },
              },
            };
          }

          return {
            sceneCaptures: {
              ...state.sceneCaptures,
              [captureId]: {
                ...capture,
                photos: {
                  ...capture.photos,
                  [slot]: photo,
                },
              },
            },
          };
        });
      },

      removePhotoFromCapture: (captureId, slot, photoId) => {
        set((state) => {
          const capture = state.sceneCaptures[captureId];
          if (!capture) return state;

          if (slot === 'additional' && photoId) {
            return {
              sceneCaptures: {
                ...state.sceneCaptures,
                [captureId]: {
                  ...capture,
                  additionalPhotos: capture.additionalPhotos.filter(p => p.id !== photoId),
                },
              },
            };
          }

          // Remove photo from specific slot (front, left, right, back)
          const photoSlot = slot as keyof SceneCapture['photos'];
          const newPhotos = { ...capture.photos };
          delete newPhotos[photoSlot];

          return {
            sceneCaptures: {
              ...state.sceneCaptures,
              [captureId]: {
                ...capture,
                photos: newPhotos,
              },
            },
          };
        });
      },

      toggleContinuityFlag: (captureId, flag) => {
        set((state) => {
          const capture = state.sceneCaptures[captureId];
          if (!capture) return state;

          return {
            sceneCaptures: {
              ...state.sceneCaptures,
              [captureId]: {
                ...capture,
                continuityFlags: {
                  ...capture.continuityFlags,
                  [flag]: !capture.continuityFlags[flag],
                },
              },
            },
          };
        });
      },

      addContinuityEvent: (captureId, event) => {
        set((state) => {
          const capture = state.sceneCaptures[captureId];
          if (!capture) return state;

          return {
            sceneCaptures: {
              ...state.sceneCaptures,
              [captureId]: {
                ...capture,
                continuityEvents: [...capture.continuityEvents, event],
              },
            },
          };
        });
      },

      updateContinuityEvent: (captureId, eventId, updates) => {
        set((state) => {
          const capture = state.sceneCaptures[captureId];
          if (!capture) return state;

          return {
            sceneCaptures: {
              ...state.sceneCaptures,
              [captureId]: {
                ...capture,
                continuityEvents: capture.continuityEvents.map((e) =>
                  e.id === eventId ? { ...e, ...updates } : e
                ),
              },
            },
          };
        });
      },

      removeContinuityEvent: (captureId, eventId) => {
        set((state) => {
          const capture = state.sceneCaptures[captureId];
          if (!capture) return state;

          return {
            sceneCaptures: {
              ...state.sceneCaptures,
              [captureId]: {
                ...capture,
                continuityEvents: capture.continuityEvents.filter((e) => e.id !== eventId),
              },
            },
          };
        });
      },

      // Scene completion
      markSceneComplete: (sceneId) => {
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

      markSceneIncomplete: (sceneId) => {
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

      copyToNextScene: (currentSceneId, characterId) => {
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
        const newCaptureId = `${nextScene.id}-${characterId}`;
        const newCapture: SceneCapture = {
          id: newCaptureId,
          sceneId: nextScene.id,
          characterId,
          lookId: currentCapture.lookId,
          capturedAt: new Date(),
          photos: {}, // Don't copy photos
          additionalPhotos: [], // Don't copy photos
          continuityFlags: { ...currentCapture.continuityFlags },
          continuityEvents: currentCapture.continuityEvents.map(e => ({ ...e, id: uuidv4() })),
          notes: currentCapture.notes,
          applicationTime: currentCapture.applicationTime,
        };

        set((state) => ({
          sceneCaptures: {
            ...state.sceneCaptures,
            [newCaptureId]: newCapture,
          },
          currentSceneId: nextScene.id,
        }));

        return nextScene.id;
      },

      // Getters
      getScene: (sceneId) => {
        return get().currentProject?.scenes.find(s => s.id === sceneId);
      },

      getCharacter: (characterId) => {
        return get().currentProject?.characters.find(c => c.id === characterId);
      },

      getLookForCharacterInScene: (characterId, sceneNumber) => {
        return get().currentProject?.looks.find(
          l => l.characterId === characterId && l.scenes.includes(sceneNumber)
        );
      },

      getSceneCapture: (sceneId, characterId) => {
        return get().sceneCaptures[`${sceneId}-${characterId}`];
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

        return scenes.sort((a, b) => a.sceneNumber - b.sceneNumber);
      },

      getScenesForLook: (lookId) => {
        const state = get();
        if (!state.currentProject) return [];

        const look = state.currentProject.looks.find(l => l.id === lookId);
        if (!look) return [];

        return state.currentProject.scenes
          .filter(s => look.scenes.includes(s.sceneNumber))
          .sort((a, b) => a.sceneNumber - b.sceneNumber);
      },
    }),
    {
      name: 'hair-makeup-pro-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentProject: state.currentProject,
        sceneCaptures: state.sceneCaptures,
      }),
    }
  )
);
