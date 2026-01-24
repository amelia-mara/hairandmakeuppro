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
  ProjectLifecycle,
  ProjectLifecycleState,
  ArchivedProjectSummary,
  SceneFilmingStatus,
  CharacterConfirmationStatus,
  CharacterDetectionStatus,
} from '@/types';
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
} from '@/types';
import type { SFXDetails } from '@/types';
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

  // Project lifecycle
  lifecycle: ProjectLifecycle;
  showWrapPopup: boolean;
  wrapTriggerReason: ProjectLifecycle['wrapReason'] | null;

  // Archived projects
  archivedProjects: Array<{
    project: Project;
    lifecycle: ProjectLifecycle;
    sceneCaptures: Record<string, SceneCapture>;
  }>;

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

  // Actions - SFX
  updateSFXDetails: (captureId: string, sfx: SFXDetails) => void;
  addSFXPhoto: (captureId: string, photo: Photo) => void;
  removeSFXPhoto: (captureId: string, photoId: string) => void;

  // Actions - Scene Completion
  markSceneComplete: (sceneId: string) => void;
  markSceneIncomplete: (sceneId: string) => void;
  copyToNextScene: (currentSceneId: string, characterId: string) => string | null;

  // Actions - Scene Filming Status (synced between Today and Breakdown)
  updateSceneFilmingStatus: (sceneNumber: string, filmingStatus: SceneFilmingStatus, filmingNotes?: string) => void;

  // Actions - Scene Synopsis
  updateSceneSynopsis: (sceneId: string, synopsis: string) => void;
  updateAllSceneSynopses: (scenes: Scene[]) => void;

  // Actions - Schedule Integration
  updateSceneShootingDays: (
    shootingDayMap: Record<string, number>,
    discrepancies: Array<{ sceneNumber: string }>
  ) => void;

  // Actions - Look Updates
  updateLook: (lookId: string, updates: Partial<Look>) => void;

  // Actions - Character Confirmation (for progressive scene-by-scene workflow)
  startCharacterDetection: () => void;
  setCharacterDetectionStatus: (status: CharacterDetectionStatus) => void;
  updateSceneSuggestedCharacters: (sceneId: string, characters: string[]) => void;
  updateSceneConfirmationStatus: (sceneId: string, status: CharacterConfirmationStatus) => void;
  confirmSceneCharacters: (sceneId: string, confirmedCharacterIds: string[]) => void;
  addCharacterFromScene: (sceneId: string, characterName: string) => Character;
  getUnconfirmedScenesCount: () => number;
  getConfirmedScenesCount: () => number;

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
      activeTab: 'today',
      sceneFilter: 'all',
      searchQuery: '',
      sceneCaptures: {},

      // Lifecycle initial state
      lifecycle: createDefaultLifecycle(),
      showWrapPopup: false,
      wrapTriggerReason: null,
      archivedProjects: [],

      // Project actions
      setProject: (project) => set({
        currentProject: project,
        lifecycle: createDefaultLifecycle(),
        showWrapPopup: false,
        wrapTriggerReason: null,
      }),
      clearProject: () => set({
        currentProject: null,
        currentSceneId: null,
        currentCharacterId: null,
        sceneCaptures: {},
        lifecycle: createDefaultLifecycle(),
        showWrapPopup: false,
        wrapTriggerReason: null,
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

      // Schedule integration - update shooting days and discrepancy flags
      updateSceneShootingDays: (shootingDayMap, discrepancies) => {
        set((state) => {
          if (!state.currentProject) return state;

          const discrepancyScenes = new Set(discrepancies.map(d => d.sceneNumber));

          return {
            currentProject: {
              ...state.currentProject,
              scenes: state.currentProject.scenes.map((s) => ({
                ...s,
                shootingDay: shootingDayMap[s.sceneNumber] ?? s.shootingDay,
                hasScheduleDiscrepancy: discrepancyScenes.has(s.sceneNumber),
              })),
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

          // Update looks to include the confirmed characters in this scene
          const scene = updatedScenes.find((s) => s.id === sceneId);
          const updatedLooks = state.currentProject.looks.map((look) => {
            if (scene && confirmedCharacterIds.includes(look.characterId)) {
              // Add this scene to the character's look if not already there
              if (!look.scenes.includes(scene.sceneNumber)) {
                return {
                  ...look,
                  scenes: [...look.scenes, scene.sceneNumber].sort((a, b) =>
                    a.localeCompare(b, undefined, { numeric: true })
                  ),
                };
              }
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
            name: 'Look 1',
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
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentProject: state.currentProject,
        sceneCaptures: state.sceneCaptures,
        lifecycle: state.lifecycle,
        archivedProjects: state.archivedProjects,
      }),
    }
  )
);
