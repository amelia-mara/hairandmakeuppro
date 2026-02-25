import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createHybridStorage } from '@/db/zustandStorage';
import { useScheduleStore } from './scheduleStore';
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
  ProjectLifecycle,
  ProjectLifecycleState,
  ArchivedProjectSummary,
  SceneFilmingStatus,
  CharacterConfirmationStatus,
  CharacterDetectionStatus,
  CastProfile,
  ProductionSchedule,
} from '@/types';
import {
  syncCastDataToScenes,
  canSyncCastData,
  type CastSyncResult,
} from '@/services/castSyncService';
import {
  compareScriptAmendment,
  applyAmendmentToScenes,
  clearAmendmentFlags,
  getAmendmentCount,
  type AmendmentResult,
} from '@/services/scriptAmendmentService';
import type { FastParsedScene } from '@/utils/scriptParser';
import {
  createEmptyContinuityFlags,
  createEmptySFXDetails,
  createDefaultLifecycle,
  calculateDaysUntilDeletion,
  shouldTriggerWrap,
  PROJECT_RETENTION_DAYS,
  REMINDER_INTERVAL_DAYS,
  createEmptyMakeupDetails,
  createEmptyHairDetails,
  createEmptyCastProfile,
} from '@/types';
import type { SFXDetails } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Saved project data (indexed by project ID)
interface SavedProjectData {
  project: Project;
  sceneCaptures: Record<string, SceneCapture>;
  lifecycle: ProjectLifecycle;
  needsSetup: boolean;
}

interface ProjectState {
  // Current state
  currentProject: Project | null;
  currentSceneId: string | null;
  currentCharacterId: string | null;
  currentLookId: string | null;
  activeTab: NavTab;
  sceneFilter: SceneFilter;
  searchQuery: string;

  // Flag to indicate project needs setup (show upload flow)
  needsSetup: boolean;

  // Scene captures (working data during shooting)
  sceneCaptures: Record<string, SceneCapture>;

  // Project lifecycle
  lifecycle: ProjectLifecycle;
  showWrapPopup: boolean;
  wrapTriggerReason: ProjectLifecycle['wrapReason'] | null;

  // Saved projects (persisted by project ID for multi-project support)
  savedProjects: Record<string, SavedProjectData>;

  // Archived projects
  archivedProjects: Array<{
    project: Project;
    lifecycle: ProjectLifecycle;
    sceneCaptures: Record<string, SceneCapture>;
  }>;

  // Actions - Project
  setProject: (project: Project) => void;
  setProjectNeedsSetup: (project: Project) => void;
  clearNeedsSetup: () => void;
  setScriptPdf: (pdfData: string) => void;
  clearProject: () => void;
  saveAndClearProject: () => void;
  restoreSavedProject: (projectId: string) => boolean;
  hasSavedProject: (projectId: string) => boolean;
  removeSavedProject: (projectId: string) => void;

  // Actions - Navigation
  setActiveTab: (tab: NavTab) => void;
  setCurrentScene: (sceneId: string | null) => void;
  setCurrentCharacter: (characterId: string | null) => void;
  setCurrentLook: (lookId: string | null) => void;
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

  // Actions - SFX
  updateSFXDetails: (captureId: string, sfx: SFXDetails) => void;
  addSFXPhoto: (captureId: string, photo: Photo) => void;
  removeSFXPhoto: (captureId: string, photoId: string) => void;

  // Actions - Scene Management
  addScene: (sceneData: Partial<Scene> & { sceneNumber: string }) => Scene;
  addCharacterToScene: (sceneId: string, characterId: string) => void;

  // Actions - Scene Completion
  markSceneComplete: (sceneId: string) => void;
  markSceneIncomplete: (sceneId: string) => void;
  copyToNextScene: (currentSceneId: string, characterId: string) => string | null;

  // Actions - Scene Filming Status (synced between Today and Breakdown)
  updateSceneFilmingStatus: (sceneNumber: string, filmingStatus: SceneFilmingStatus, filmingNotes?: string) => void;

  // Actions - Scene Synopsis
  updateSceneSynopsis: (sceneId: string, synopsis: string) => void;
  updateAllSceneSynopses: (scenes: Scene[]) => void;

  // Actions - Look Updates
  updateLook: (lookId: string, updates: Partial<Look>) => void;
  updateLookWithPropagation: (lookId: string, updates: Partial<Look>) => void;

  // Actions - Cast Profiles
  getCastProfile: (characterId: string) => CastProfile | undefined;
  updateCastProfile: (characterId: string, updates: Partial<CastProfile>) => void;

  // Actions - Character Confirmation (for progressive scene-by-scene workflow)
  startCharacterDetection: () => void;
  setCharacterDetectionStatus: (status: CharacterDetectionStatus) => void;
  updateSceneSuggestedCharacters: (sceneId: string, characters: string[]) => void;
  updateSceneConfirmationStatus: (sceneId: string, status: CharacterConfirmationStatus) => void;
  confirmSceneCharacters: (sceneId: string, confirmedCharacterIds: string[]) => void;
  addCharacterFromScene: (sceneId: string, characterName: string) => Character;
  getUnconfirmedScenesCount: () => number;
  getConfirmedScenesCount: () => number;

  // Actions - Cast Sync from Schedule
  syncCastDataFromSchedule: (
    schedule: ProductionSchedule,
    options?: { createMissingCharacters?: boolean; overwriteExisting?: boolean; autoConfirm?: boolean }
  ) => CastSyncResult | null;
  canSyncCastData: (schedule: ProductionSchedule | null) => { canSync: boolean; reason?: string };

  // Actions - Script Amendment (revised script uploads)
  compareScriptAmendment: (newParsedScenes: FastParsedScene[]) => AmendmentResult | null;
  applyScriptAmendment: (
    amendmentResult: AmendmentResult,
    options?: { includeNew?: boolean; includeModified?: boolean; includeDeleted?: boolean }
  ) => void;
  clearSceneAmendmentFlags: () => void;
  clearSingleSceneAmendment: (sceneId: string) => void;
  getAmendmentCounts: () => { total: number; new: number; modified: number; deleted: number };

  // Actions - Lifecycle
  updateActivity: () => void;
  checkWrapTrigger: () => void;
  wrapProject: (reason: ProjectLifecycle['wrapReason']) => void;
  dismissWrapPopup: (remindLater: boolean) => void;
  restoreProject: () => void;
  archiveProject: () => void;
  permanentlyDeleteProject: () => void;
  getArchivedProjects: () => ArchivedProjectSummary[];
  loadArchivedProject: (projectId: string) => void;
  getDaysUntilDeletion: () => number;
  getLifecycleBanner: () => { show: boolean; message: string; daysRemaining: number } | null;

  // Computed/Derived
  getScene: (sceneId: string) => Scene | undefined;
  getCharacter: (characterId: string) => Character | undefined;
  getLookForCharacterInScene: (characterId: string, sceneNumber: string) => Look | undefined;
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
      currentLookId: null,
      activeTab: 'today',
      sceneFilter: 'all',
      searchQuery: '',
      needsSetup: false,
      sceneCaptures: {},

      // Lifecycle initial state
      lifecycle: createDefaultLifecycle(),
      showWrapPopup: false,
      wrapTriggerReason: null,
      savedProjects: {},
      archivedProjects: [],

      // Project actions
      setProject: (project) => set({
        currentProject: project,
        needsSetup: false,
        lifecycle: createDefaultLifecycle(),
        showWrapPopup: false,
        wrapTriggerReason: null,
      }),
      setProjectNeedsSetup: (project) => set({
        currentProject: project,
        needsSetup: true,
        lifecycle: createDefaultLifecycle(),
        showWrapPopup: false,
        wrapTriggerReason: null,
      }),
      clearNeedsSetup: () => set({ needsSetup: false }),
      setScriptPdf: (pdfData) => set((state) => ({
        currentProject: state.currentProject
          ? { ...state.currentProject, scriptPdfData: pdfData }
          : null,
      })),
      clearProject: () => set({
        currentProject: null,
        currentSceneId: null,
        currentCharacterId: null,
        needsSetup: false,
        sceneCaptures: {},
        lifecycle: createDefaultLifecycle(),
        showWrapPopup: false,
        wrapTriggerReason: null,
      }),

      // Save current project data before clearing (preserves data for later restoration)
      saveAndClearProject: () => {
        const state = get();
        if (state.currentProject) {
          // Capture references before set() to avoid stale closure issues
          const projectId = state.currentProject.id;
          const projectToSave = state.currentProject;
          const capturesToSave = state.sceneCaptures;
          const lifecycleToSave = state.lifecycle;
          const needsSetupToSave = state.needsSetup;

          // Also save the schedule data for this project
          useScheduleStore.getState().saveScheduleForProject(projectId);

          set((s) => ({
            savedProjects: {
              ...s.savedProjects,
              [projectId]: {
                project: projectToSave,
                sceneCaptures: capturesToSave,
                lifecycle: lifecycleToSave,
                needsSetup: needsSetupToSave,
              },
            },
            currentProject: null,
            currentSceneId: null,
            currentCharacterId: null,
            needsSetup: false,
            sceneCaptures: {},
            lifecycle: createDefaultLifecycle(),
            showWrapPopup: false,
            wrapTriggerReason: null,
          }));
        } else {
          // Clear schedule data when clearing project without saving
          useScheduleStore.getState().clearScheduleForProject();

          set({
            currentProject: null,
            currentSceneId: null,
            currentCharacterId: null,
            needsSetup: false,
            sceneCaptures: {},
            lifecycle: createDefaultLifecycle(),
            showWrapPopup: false,
            wrapTriggerReason: null,
          });
        }
      },

      // Restore a previously saved project
      restoreSavedProject: (projectId: string) => {
        const state = get();
        const savedData = state.savedProjects[projectId];
        if (!savedData) return false;

        // Remove from saved and set as current
        const newSavedProjects = { ...state.savedProjects };
        delete newSavedProjects[projectId];

        // Also restore the schedule data for this project
        useScheduleStore.getState().restoreScheduleForProject(projectId);

        set({
          currentProject: savedData.project,
          sceneCaptures: savedData.sceneCaptures,
          lifecycle: savedData.lifecycle,
          needsSetup: savedData.needsSetup,
          savedProjects: newSavedProjects,
          currentSceneId: null,
          currentCharacterId: null,
          showWrapPopup: false,
          wrapTriggerReason: null,
        });
        return true;
      },

      // Check if a project has saved data
      hasSavedProject: (projectId: string) => {
        return !!get().savedProjects[projectId];
      },

      // Remove a saved project from storage
      removeSavedProject: (projectId: string) => {
        const newSavedProjects = { ...get().savedProjects };
        delete newSavedProjects[projectId];
        set({ savedProjects: newSavedProjects });
      },

      // Navigation actions
      setActiveTab: (tab) => set({ activeTab: tab }),
      setCurrentScene: (sceneId) => set({ currentSceneId: sceneId }),
      setCurrentCharacter: (characterId) => set({ currentCharacterId: characterId }),
      setCurrentLook: (lookId) => set({ currentLookId: lookId }),
      setSceneFilter: (filter) => set({ sceneFilter: filter }),
      setSearchQuery: (query) => set({ searchQuery: query }),

      // Scene Capture actions
      getOrCreateSceneCapture: (sceneId, characterId) => {
        const state = get();
        const key = `${sceneId}-${characterId}`;
        const existing = state.sceneCaptures[key];

        if (existing) return existing;

        const sceneNumber = state.currentProject?.scenes.find(s => s.id === sceneId)?.sceneNumber;
        const look = state.currentProject?.looks.find(
          l => l.characterId === characterId &&
          sceneNumber !== undefined && l.scenes.includes(sceneNumber)
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
          sfxDetails: createEmptySFXDetails(),
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

      // SFX actions
      updateSFXDetails: (captureId, sfx) => {
        set((state) => {
          const capture = state.sceneCaptures[captureId];
          if (!capture) return state;

          return {
            sceneCaptures: {
              ...state.sceneCaptures,
              [captureId]: {
                ...capture,
                sfxDetails: sfx,
              },
            },
          };
        });
      },

      addSFXPhoto: (captureId, photo) => {
        set((state) => {
          const capture = state.sceneCaptures[captureId];
          if (!capture) return state;

          return {
            sceneCaptures: {
              ...state.sceneCaptures,
              [captureId]: {
                ...capture,
                sfxDetails: {
                  ...capture.sfxDetails,
                  sfxReferencePhotos: [...capture.sfxDetails.sfxReferencePhotos, photo],
                },
              },
            },
          };
        });
      },

      removeSFXPhoto: (captureId, photoId) => {
        set((state) => {
          const capture = state.sceneCaptures[captureId];
          if (!capture) return state;

          return {
            sceneCaptures: {
              ...state.sceneCaptures,
              [captureId]: {
                ...capture,
                sfxDetails: {
                  ...capture.sfxDetails,
                  sfxReferencePhotos: capture.sfxDetails.sfxReferencePhotos.filter(p => p.id !== photoId),
                },
              },
            },
          };
        });
      },

      // Scene management
      addScene: (sceneData) => {
        const newScene: Scene = {
          id: `scene-${sceneData.sceneNumber}-${Date.now()}`,
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

      addCharacterToScene: (sceneId, characterId) => {
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
            [newCaptureId]: newCapture,
          },
          currentSceneId: nextScene.id,
        }));

        return nextScene.id;
      },

      // Scene filming status - syncs to project scenes for Breakdown view
      updateSceneFilmingStatus: (sceneNumber, filmingStatus, filmingNotes) => {
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
      updateSceneSynopsis: (sceneId, synopsis) => {
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
      updateAllSceneSynopses: (updatedScenes) => {
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

      // Look updates
      updateLook: (lookId, updates) => {
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
      updateLookWithPropagation: (lookId, updates) => {
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

      // Cast profile actions
      getCastProfile: (characterId) => {
        const state = get();
        if (!state.currentProject) return undefined;
        return state.currentProject.castProfiles?.find(cp => cp.characterId === characterId);
      },

      updateCastProfile: (characterId, updates) => {
        set((state) => {
          if (!state.currentProject) return state;

          const existingProfiles = state.currentProject.castProfiles || [];
          const existingIndex = existingProfiles.findIndex(cp => cp.characterId === characterId);

          let updatedProfiles: CastProfile[];
          if (existingIndex >= 0) {
            // Update existing profile
            updatedProfiles = existingProfiles.map((cp, idx) =>
              idx === existingIndex ? { ...cp, ...updates } : cp
            );
          } else {
            // Create new profile with updates
            const newProfile = { ...createEmptyCastProfile(characterId), ...updates };
            updatedProfiles = [...existingProfiles, newProfile];
          }

          return {
            currentProject: {
              ...state.currentProject,
              castProfiles: updatedProfiles,
            },
          };
        });
      },

      // Character confirmation actions (for progressive scene-by-scene workflow)
      startCharacterDetection: () => {
        set((state) => {
          if (!state.currentProject) return state;

          return {
            currentProject: {
              ...state.currentProject,
              characterDetectionStatus: 'running',
              scenes: state.currentProject.scenes.map((s) => ({
                ...s,
                characterConfirmationStatus: s.characterConfirmationStatus === 'confirmed'
                  ? 'confirmed'
                  : 'detecting',
              })),
            },
          };
        });
      },

      setCharacterDetectionStatus: (status) => {
        set((state) => {
          if (!state.currentProject) return state;

          return {
            currentProject: {
              ...state.currentProject,
              characterDetectionStatus: status,
            },
          };
        });
      },

      updateSceneSuggestedCharacters: (sceneId, characters) => {
        set((state) => {
          if (!state.currentProject) return state;

          return {
            currentProject: {
              ...state.currentProject,
              scenes: state.currentProject.scenes.map((s) =>
                s.id === sceneId
                  ? {
                      ...s,
                      suggestedCharacters: characters,
                      characterConfirmationStatus: s.characterConfirmationStatus === 'confirmed'
                        ? 'confirmed'
                        : 'ready',
                    }
                  : s
              ),
            },
          };
        });
      },

      updateSceneConfirmationStatus: (sceneId, status) => {
        set((state) => {
          if (!state.currentProject) return state;

          return {
            currentProject: {
              ...state.currentProject,
              scenes: state.currentProject.scenes.map((s) =>
                s.id === sceneId ? { ...s, characterConfirmationStatus: status } : s
              ),
            },
          };
        });
      },

      confirmSceneCharacters: (sceneId, confirmedCharacterIds) => {
        set((state) => {
          if (!state.currentProject) return state;

          // Get previous characters before updating (to detect removals)
          const previousScene = state.currentProject.scenes.find(s => s.id === sceneId);
          const previousCharacterIds = previousScene?.characters || [];

          const updatedScenes = state.currentProject.scenes.map((s) =>
            s.id === sceneId
              ? {
                  ...s,
                  characters: confirmedCharacterIds,
                  characterConfirmationStatus: 'confirmed' as CharacterConfirmationStatus,
                  suggestedCharacters: undefined, // Clear suggestions after confirmation
                }
              : s
          );

          // Count confirmed scenes
          const scenesConfirmed = updatedScenes.filter(
            (s) => s.characterConfirmationStatus === 'confirmed'
          ).length;

          const scene = updatedScenes.find((s) => s.id === sceneId);

          // Characters removed from this scene — their looks should drop this scene
          const removedCharacterIds = previousCharacterIds.filter(
            id => !confirmedCharacterIds.includes(id)
          );

          // Track which characters already have this scene in one of their looks
          const characterHasScene = new Set<string>();
          for (const look of state.currentProject.looks) {
            if (scene && look.scenes.includes(scene.sceneNumber)) {
              characterHasScene.add(look.characterId);
            }
          }

          // Track characters we've already added the scene to (for multi-look chars)
          const addedTo = new Set<string>();

          const updatedLooks = state.currentProject.looks.map((look) => {
            if (!scene) return look;

            // Remove scene from looks of characters no longer in this scene
            if (removedCharacterIds.includes(look.characterId) && look.scenes.includes(scene.sceneNumber)) {
              return {
                ...look,
                scenes: look.scenes.filter(s => s !== scene.sceneNumber),
              };
            }

            // Add scene to first look of newly confirmed characters (if not already in any of their looks)
            if (
              confirmedCharacterIds.includes(look.characterId) &&
              !characterHasScene.has(look.characterId) &&
              !addedTo.has(look.characterId)
            ) {
              addedTo.add(look.characterId);
              return {
                ...look,
                scenes: [...look.scenes, scene.sceneNumber].sort((a, b) =>
                  a.localeCompare(b, undefined, { numeric: true })
                ),
              };
            }

            return look;
          });

          return {
            currentProject: {
              ...state.currentProject,
              scenes: updatedScenes,
              looks: updatedLooks,
              scenesConfirmed,
            },
          };
        });
      },

      addCharacterFromScene: (sceneId, characterName) => {
        const state = get();
        if (!state.currentProject) {
          throw new Error('No project loaded');
        }

        // Generate a new character
        const id = `char-${uuidv4().slice(0, 8)}`;
        const initials = characterName
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2);

        // Assign color based on existing character count
        const colors = ['#C9A961', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#6366F1'];
        const avatarColour = colors[state.currentProject.characters.length % colors.length];

        const newCharacter: Character = {
          id,
          name: characterName,
          initials,
          avatarColour,
        };

        // Find the scene to get its sceneNumber
        const scene = state.currentProject.scenes.find((s) => s.id === sceneId);

        set((state) => {
          if (!state.currentProject) return state;

          // Create a new look for this character
          const newLook: Look = {
            id: `look-${newCharacter.id}`,
            characterId: newCharacter.id,
            name: 'Day 1',
            scenes: scene ? [scene.sceneNumber] : [],
            estimatedTime: 30,
            makeup: createEmptyMakeupDetails(),
            hair: createEmptyHairDetails(),
          };

          return {
            currentProject: {
              ...state.currentProject,
              characters: [...state.currentProject.characters, newCharacter],
              looks: [...state.currentProject.looks, newLook],
            },
          };
        });

        return newCharacter;
      },

      getUnconfirmedScenesCount: () => {
        const state = get();
        if (!state.currentProject) return 0;

        return state.currentProject.scenes.filter(
          (s) => s.characterConfirmationStatus !== 'confirmed'
        ).length;
      },

      getConfirmedScenesCount: () => {
        const state = get();
        if (!state.currentProject) return 0;

        return state.currentProject.scenes.filter(
          (s) => s.characterConfirmationStatus === 'confirmed'
        ).length;
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

        return scenes.sort((a, b) => a.sceneNumber.localeCompare(b.sceneNumber, undefined, { numeric: true }));
      },

      getScenesForLook: (lookId) => {
        const state = get();
        if (!state.currentProject) return [];

        const look = state.currentProject.looks.find(l => l.id === lookId);
        if (!look) return [];

        return state.currentProject.scenes
          .filter(s => look.scenes.includes(s.sceneNumber))
          .sort((a, b) => a.sceneNumber.localeCompare(b.sceneNumber, undefined, { numeric: true }));
      },

      // Cast Sync from Schedule
      syncCastDataFromSchedule: (schedule, options = {}) => {
        const state = get();
        if (!state.currentProject) return null;

        const { canSync, reason } = canSyncCastData(schedule);
        if (!canSync) {
          console.error('[ProjectStore] Cannot sync cast data:', reason);
          return null;
        }

        const { result, updatedScenes, updatedCharacters, updatedLooks } = syncCastDataToScenes(
          schedule,
          state.currentProject.scenes,
          state.currentProject.characters,
          state.currentProject.looks,
          options
        );

        if (result.scenesUpdated > 0 || result.charactersCreated > 0) {
          set((s) => {
            if (!s.currentProject) return {};

            // Migrate cast profiles from placeholder IDs (cast-N) to real character IDs.
            // Before the schedule finishes processing, the Lookbooks page shows placeholder
            // characters with IDs like "cast-1" from the cast list. If the user edits a
            // cast profile for one of these, the profile is saved under that placeholder ID.
            // When the sync creates real characters (char-XXXX), those profiles become
            // orphaned. This migrates them to the correct new character IDs.
            const existingProfiles = s.currentProject.castProfiles || [];
            const migratedProfiles = existingProfiles.map(profile => {
              const placeholderMatch = profile.characterId.match(/^cast-(\d+)$/);
              if (!placeholderMatch) return profile;

              const castNumber = parseInt(placeholderMatch[1], 10);
              const castMember = schedule.castList.find(c => c.number === castNumber);
              if (!castMember) return profile;

              const castName = (castMember.character || castMember.name)
                .replace(/^\d+\.\s*/, '').trim().toUpperCase();
              const realChar = updatedCharacters.find(
                c => c.name.trim().toUpperCase() === castName
              );
              if (!realChar) return profile;

              console.log(
                `[ProjectStore] Migrating cast profile from placeholder ${profile.characterId} to ${realChar.id} (${realChar.name})`
              );
              return {
                ...profile,
                characterId: realChar.id,
                id: `cast-${realChar.id}`,
              };
            });

            return {
              currentProject: {
                ...s.currentProject,
                scenes: updatedScenes,
                characters: updatedCharacters,
                looks: updatedLooks,
                castProfiles: migratedProfiles,
              },
            };
          });

          console.log('[ProjectStore] Cast sync complete:', {
            scenesUpdated: result.scenesUpdated,
            charactersCreated: result.charactersCreated,
          });
        }

        return result;
      },

      canSyncCastData: (schedule) => canSyncCastData(schedule),

      // Script Amendment actions
      compareScriptAmendment: (newParsedScenes) => {
        const { currentProject } = get();
        if (!currentProject?.scenes) return null;
        return compareScriptAmendment(currentProject.scenes, newParsedScenes);
      },

      applyScriptAmendment: (amendmentResult, options = { includeNew: true, includeModified: true, includeDeleted: false }) => {
        const { currentProject } = get();
        if (!currentProject) return;

        const updatedScenes = applyAmendmentToScenes(
          currentProject.scenes,
          amendmentResult,
          options
        );

        set({
          currentProject: {
            ...currentProject,
            scenes: updatedScenes,
            updatedAt: new Date(),
          },
        });
      },

      clearSceneAmendmentFlags: () => {
        const { currentProject } = get();
        if (!currentProject) return;

        const clearedScenes = clearAmendmentFlags(currentProject.scenes);

        set({
          currentProject: {
            ...currentProject,
            scenes: clearedScenes,
          },
        });
      },

      clearSingleSceneAmendment: (sceneId) => {
        const { currentProject } = get();
        if (!currentProject) return;

        const updatedScenes = currentProject.scenes.map(scene =>
          scene.id === sceneId
            ? {
                ...scene,
                amendmentStatus: undefined,
                amendmentNotes: undefined,
                previousScriptContent: undefined,
              }
            : scene
        );

        set({
          currentProject: {
            ...currentProject,
            scenes: updatedScenes,
          },
        });
      },

      getAmendmentCounts: () => {
        const { currentProject } = get();
        if (!currentProject?.scenes) {
          return { total: 0, new: 0, modified: 0, deleted: 0 };
        }
        return getAmendmentCount(currentProject.scenes);
      },

      // Lifecycle actions
      updateActivity: () => {
        set((state) => ({
          lifecycle: {
            ...state.lifecycle,
            lastActivityAt: new Date(),
          },
        }));
      },

      checkWrapTrigger: () => {
        const state = get();
        if (!state.currentProject) return;

        // Check if reminder should show again
        if (state.lifecycle.nextReminderAt) {
          const now = new Date();
          if (now >= new Date(state.lifecycle.nextReminderAt)) {
            set({
              showWrapPopup: true,
              wrapTriggerReason: state.lifecycle.wrapReason || 'manual',
            });
            return;
          }
        }

        const result = shouldTriggerWrap(state.currentProject, state.lifecycle);
        if (result.trigger && result.reason) {
          set({
            showWrapPopup: true,
            wrapTriggerReason: result.reason,
          });
        }
      },

      wrapProject: (reason) => {
        const now = new Date();
        const deletionDate = new Date(now);
        deletionDate.setDate(deletionDate.getDate() + PROJECT_RETENTION_DAYS);

        set((state) => ({
          lifecycle: {
            ...state.lifecycle,
            state: 'wrapped',
            wrappedAt: now,
            wrapReason: reason,
            deletionDate: deletionDate,
          },
          showWrapPopup: false,
          wrapTriggerReason: null,
        }));
      },

      dismissWrapPopup: (remindLater) => {
        if (remindLater) {
          const nextReminder = new Date();
          nextReminder.setDate(nextReminder.getDate() + REMINDER_INTERVAL_DAYS);
          set((state) => ({
            showWrapPopup: false,
            lifecycle: {
              ...state.lifecycle,
              reminderDismissedAt: new Date(),
              nextReminderAt: nextReminder,
            },
          }));
        } else {
          set({ showWrapPopup: false });
        }
      },

      restoreProject: () => {
        set((state) => ({
          lifecycle: {
            ...state.lifecycle,
            state: 'active',
            wrappedAt: undefined,
            deletionDate: undefined,
            archiveDate: undefined,
            reminderDismissedAt: undefined,
            nextReminderAt: undefined,
            lastActivityAt: new Date(),
          },
        }));
      },

      archiveProject: () => {
        const state = get();
        if (!state.currentProject) return;

        const archiveDate = new Date();
        const archivedEntry = {
          project: state.currentProject,
          lifecycle: {
            ...state.lifecycle,
            state: 'archived' as ProjectLifecycleState,
            archiveDate: archiveDate,
          },
          sceneCaptures: state.sceneCaptures,
        };

        set((state) => ({
          archivedProjects: [...state.archivedProjects, archivedEntry],
          currentProject: null,
          sceneCaptures: {},
          lifecycle: createDefaultLifecycle(),
        }));
      },

      permanentlyDeleteProject: () => {
        set({
          currentProject: null,
          sceneCaptures: {},
          lifecycle: createDefaultLifecycle(),
        });
      },

      getArchivedProjects: () => {
        const state = get();
        return state.archivedProjects.map((archived) => {
          const photosCount = Object.values(archived.sceneCaptures).reduce((count, capture) => {
            let photos = 0;
            if (capture.photos.front) photos++;
            if (capture.photos.left) photos++;
            if (capture.photos.right) photos++;
            if (capture.photos.back) photos++;
            photos += capture.additionalPhotos.length;
            return count + photos;
          }, 0);

          return {
            id: archived.project.id,
            name: archived.project.name,
            state: archived.lifecycle.state,
            wrappedAt: archived.lifecycle.wrappedAt,
            daysUntilDeletion: archived.lifecycle.wrappedAt
              ? calculateDaysUntilDeletion(new Date(archived.lifecycle.wrappedAt))
              : 0,
            scenesCount: archived.project.scenes.length,
            charactersCount: archived.project.characters.length,
            photosCount,
          };
        });
      },

      loadArchivedProject: (projectId) => {
        const state = get();
        const archivedIndex = state.archivedProjects.findIndex(
          a => a.project.id === projectId
        );

        if (archivedIndex === -1) return;

        const archived = state.archivedProjects[archivedIndex];
        const newArchivedProjects = [...state.archivedProjects];
        newArchivedProjects.splice(archivedIndex, 1);

        set({
          currentProject: archived.project,
          sceneCaptures: archived.sceneCaptures,
          lifecycle: archived.lifecycle,
          archivedProjects: newArchivedProjects,
        });
      },

      getDaysUntilDeletion: () => {
        const state = get();
        if (state.lifecycle.state === 'active' || !state.lifecycle.wrappedAt) {
          return -1;
        }
        return calculateDaysUntilDeletion(new Date(state.lifecycle.wrappedAt));
      },

      getLifecycleBanner: () => {
        const state = get();
        if (state.lifecycle.state === 'active') return null;

        const daysRemaining = state.lifecycle.wrappedAt
          ? calculateDaysUntilDeletion(new Date(state.lifecycle.wrappedAt))
          : 0;

        if (state.lifecycle.state === 'wrapped') {
          return {
            show: true,
            message: `Project wrapped. ${daysRemaining} days until archive.`,
            daysRemaining,
          };
        }

        if (state.lifecycle.state === 'archived') {
          return {
            show: true,
            message: `Archived. Export to restore.`,
            daysRemaining,
          };
        }

        return null;
      },
    }),
    {
      name: 'hair-makeup-pro-storage',
      // Use IndexedDB with debounced writes for large project data
      storage: createHybridStorage('hair-makeup-pro-storage'),
      partialize: (state) => ({
        currentProject: state.currentProject,
        sceneCaptures: state.sceneCaptures,
        lifecycle: state.lifecycle,
        savedProjects: state.savedProjects,
        archivedProjects: state.archivedProjects,
        needsSetup: state.needsSetup,
      }),
    }
  )
);

