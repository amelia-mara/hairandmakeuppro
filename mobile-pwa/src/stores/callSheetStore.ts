import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createHybridStorage } from '@/db/zustandStorage';
import type { CallSheet, CallSheetScene, ShootingSceneStatus, SceneFilmingStatus } from '@/types';
import { createEmptyMakeupDetails, createEmptyHairDetails } from '@/types';
import { parseCallSheetPDF } from '@/utils/callSheetParser';
import { useTimesheetStore } from './timesheetStore';
import { useProjectStore } from './projectStore';
import { v4 as uuidv4 } from 'uuid';

// Current version of the store schema - increment when making breaking changes
const STORE_VERSION = 3;

// Saved call sheet data (indexed by project ID)
interface SavedCallSheetData {
  callSheets: CallSheet[];
  activeCallSheetId: string | null;
}

interface CallSheetState {
  // Call sheets for the current project
  callSheets: CallSheet[];

  // Currently active call sheet (for "Today" view)
  activeCallSheetId: string | null;

  // Saved call sheets by project ID (for multi-project support)
  savedCallSheets: Record<string, SavedCallSheetData>;

  // Loading state
  isUploading: boolean;
  uploadError: string | null;

  // Actions
  uploadCallSheet: (file: File) => Promise<CallSheet>;
  setActiveCallSheet: (id: string) => void;
  getActiveCallSheet: () => CallSheet | null;
  getCallSheetByDate: (date: string) => CallSheet | null;
  getCallSheetByDay: (productionDay: number) => CallSheet | null;
  deleteCallSheet: (id: string) => void;

  // Scene status updates (syncs with Today page)
  updateSceneStatus: (callSheetId: string, sceneNumber: string, status: ShootingSceneStatus) => void;
  updateSceneFilmingStatus: (
    callSheetId: string,
    sceneNumber: string,
    filmingStatus: SceneFilmingStatus,
    filmingNotes?: string
  ) => void;

  // Clear all call sheets for current project
  clearAll: () => void;

  // Multi-project support: save/restore call sheet data
  saveCallSheetsForProject: (projectId: string) => void;
  restoreCallSheetsForProject: (projectId: string) => boolean;
  hasSavedCallSheets: (projectId: string) => boolean;
  clearCallSheetsForProject: () => void;
}

// Validate that a call sheet has proper structure (scenes belong to this call sheet only)
function validateCallSheet(cs: CallSheet): boolean {
  if (!cs.id || !cs.date || !Array.isArray(cs.scenes)) return false;
  // Ensure scenes array is reasonable (not accumulated from multiple days)
  // A single day's call sheet typically has 1-20 scenes, rarely more than 30
  if (cs.scenes.length > 50) {
    return false;
  }
  return true;
}

/**
 * Normalize scene numbers from various call sheet formats into a consistent format.
 * Handles split scenes like "2B", "2 Part 1", "2 Pt 1", "2 pt. 2", "Scene 2B", etc.
 * Outputs: "2", "2A", "2B", "2 PT1", "2 PT2", etc.
 */
function normalizeSceneNumber(raw: string): string {
  let s = raw.trim();

  // Strip leading "Scene" / "Sc" / "Sc." prefix (case-insensitive)
  s = s.replace(/^(?:scene|sc\.?)\s*/i, '');

  // Normalize "Part X" / "Pt X" / "Pt. X" → " PTX"
  s = s.replace(/\s*(?:part|pt\.?)\s*/gi, ' PT');

  // Collapse whitespace and uppercase
  s = s.replace(/\s+/g, ' ').trim().toUpperCase();

  return s;
}

/** Extract INT/EXT from a slugline like "EXT. FARMHOUSE - DRIVEWAY" */
function parseIntExt(setDescription: string): 'INT' | 'EXT' {
  const desc = (setDescription || '').toUpperCase();
  if (desc.startsWith('EXT')) return 'EXT';
  return 'INT';
}

/** Map call sheet day/night codes to breakdown time-of-day */
function parseTimeOfDay(dayNight: string): 'DAY' | 'NIGHT' | 'MORNING' | 'EVENING' | 'CONTINUOUS' {
  const dn = (dayNight || '').toUpperCase().trim();
  if (dn.startsWith('N')) return 'NIGHT';
  if (dn === 'DAWN' || dn === 'MORNING') return 'MORNING';
  if (dn === 'DUSK' || dn === 'EVENING') return 'EVENING';
  if (dn === 'CONTINUOUS' || dn === 'D/N') return 'CONTINUOUS';
  return 'DAY';
}

export const useCallSheetStore = create<CallSheetState>()(
  persist(
    (set, get) => ({
      callSheets: [],
      activeCallSheetId: null,
      savedCallSheets: {},
      isUploading: false,
      uploadError: null,

      uploadCallSheet: async (file: File) => {
        set({ isUploading: true, uploadError: null });

        try {
          // Pull the project's cast roster (character actorNumbers) so the
          // parser can drop misclassified tokens that aren't real cast IDs.
          const project = useProjectStore.getState().currentProject;
          const validCastNumbers = new Set<number>();
          for (const c of project?.characters ?? []) {
            if (typeof c.actorNumber === 'number') validCastNumbers.add(c.actorNumber);
          }
          const callSheet = await parseCallSheetPDF(
            file,
            validCastNumbers.size > 0 ? { validCastNumbers } : undefined,
          );

          // Tag the call sheet with the current project ID
          const currentProjectId = useProjectStore.getState().currentProject?.id;

          // Ensure the new call sheet has a clean scenes array (no merging)
          const cleanCallSheet: CallSheet = {
            ...callSheet,
            projectId: currentProjectId,
            // Explicitly create a new scenes array to prevent any reference issues
            scenes: [...callSheet.scenes],
          };

          // Check if we already have a call sheet for this day (by date OR production day)
          const existing = get().callSheets.find(
            cs => cs.date === cleanCallSheet.date || cs.productionDay === cleanCallSheet.productionDay
          );

          // Auto-fill timesheet from call sheet data
          const autoFillTimesheet = (cs: CallSheet) => {
            if (cs.date) {
              const timesheetStore = useTimesheetStore.getState();
              const autoFilledEntry = timesheetStore.autoFillFromCallSheet(cs.date, cs);
              timesheetStore.saveEntry(autoFilledEntry);
            }
          };

          // Sync scene log lines to breakdown synopsis
          const syncSceneSynopsesToBreakdown = (cs: CallSheet) => {
            // Re-fetch project state to pick up any scenes just added by syncNewScenesToBreakdown
            const latestProjectState = useProjectStore.getState();
            const project = latestProjectState.currentProject;
            if (!project?.scenes) return;

            // For each scene in the call sheet that has an action/log line
            cs.scenes.forEach(callSheetScene => {
              if (!callSheetScene.action) return;

              const normalizedCallSheet = normalizeSceneNumber(callSheetScene.sceneNumber);

              // Find matching scene in the breakdown by normalized scene number
              const breakdownScene = project.scenes.find(
                s => normalizeSceneNumber(s.sceneNumber) === normalizedCallSheet
              );

              // If found and doesn't already have a synopsis, update it
              if (breakdownScene && !breakdownScene.synopsis) {
                latestProjectState.updateSceneSynopsis(breakdownScene.id, callSheetScene.action);
              }
            });
          };

          // Auto-add scenes from call sheet that don't exist in the breakdown
          // Handles split scenes like "2B", "2 Part 1", "2 Pt 1", etc.
          const syncNewScenesToBreakdown = (cs: CallSheet) => {
            const projectStore = useProjectStore.getState();
            const project = projectStore.currentProject;
            if (!project) return;

            const existingSceneNumbers = new Set(
              project.scenes.map(s => normalizeSceneNumber(s.sceneNumber))
            );

            cs.scenes.forEach(callSheetScene => {
              const normalized = normalizeSceneNumber(callSheetScene.sceneNumber);
              if (existingSceneNumbers.has(normalized)) return;

              // Parse INT/EXT and time of day from the set description
              const intExt = parseIntExt(callSheetScene.setDescription);
              const timeOfDay = parseTimeOfDay(callSheetScene.dayNight);

              projectStore.addScene({
                sceneNumber: normalizeSceneNumber(callSheetScene.sceneNumber),
                slugline: callSheetScene.setDescription || `Scene ${callSheetScene.sceneNumber}`,
                intExt,
                timeOfDay,
                synopsis: callSheetScene.action,
                shootingDay: cs.productionDay,
              });

              // Track that we've added this scene so we don't double-add
              existingSceneNumbers.add(normalized);
            });
          };

          // Auto-add characters from call sheet cast that don't exist in the breakdown
          const syncNewCharactersToBreakdown = (cs: CallSheet) => {
            const projectStore = useProjectStore.getState();
            const project = projectStore.currentProject;
            if (!project || !cs.castCalls?.length) return;

            // Build a lookup of existing characters by normalized name
            const existingNames = new Set(
              project.characters.map(c => c.name.trim().toUpperCase())
            );

            const colors = ['#D4943A', '#E8621A', '#F0882A', '#4ABFB0', '#F5A623', '#5A3E28', '#F2C4A0', '#C4522A'];

            cs.castCalls.forEach(castCall => {
              const characterName = castCall.character.trim();
              if (!characterName) return;

              const normalizedName = characterName.toUpperCase();
              if (existingNames.has(normalizedName)) return;

              // Create the character
              const characterId = uuidv4();
              const initials = characterName
                .split(' ')
                .map(w => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

              const currentProject = useProjectStore.getState().currentProject;
              const charCount = currentProject?.characters.length || 0;
              const avatarColour = colors[charCount % colors.length];

              const castNumber = parseInt(castCall.id, 10);

              const newCharacter = {
                id: characterId,
                name: characterName,
                initials,
                avatarColour,
                actorNumber: isNaN(castNumber) ? undefined : castNumber,
                role: undefined as 'lead' | 'supporting' | 'background' | undefined,
              };

              // Create a default look for the character
              const newLook = {
                id: uuidv4(),
                characterId,
                name: 'Day 1',
                scenes: [] as string[],
                estimatedTime: 30,
                makeup: createEmptyMakeupDetails(),
                hair: createEmptyHairDetails(),
              };

              // Find which scenes this character appears in from the call sheet
              const scenesForCharacter: string[] = [];
              cs.scenes.forEach(scene => {
                if (scene.cast?.includes(castCall.id)) {
                  scenesForCharacter.push(normalizeSceneNumber(scene.sceneNumber));
                }
              });
              newLook.scenes = scenesForCharacter.sort((a, b) =>
                a.localeCompare(b, undefined, { numeric: true })
              );

              // Add character and look to the project directly via the store
              const latestProject = useProjectStore.getState().currentProject;
              if (latestProject) {
                useProjectStore.setState({
                  currentProject: {
                    ...latestProject,
                    characters: [...latestProject.characters, newCharacter],
                    looks: [...latestProject.looks, newLook],
                    scenes: latestProject.scenes.map(s => {
                      if (scenesForCharacter.includes(s.sceneNumber)) {
                        return {
                          ...s,
                          characters: s.characters.includes(characterId)
                            ? s.characters
                            : [...s.characters, characterId],
                        };
                      }
                      return s;
                    }),
                  },
                });
              }

              existingNames.add(normalizedName);
            });
          };

          if (existing) {
            // COMPLETELY REPLACE existing call sheet - do not merge scenes
            const replacementSheet: CallSheet = {
              ...cleanCallSheet,
              id: existing.id, // Keep the same ID for reference stability
            };

            set(state => ({
              callSheets: state.callSheets.map(cs =>
                cs.id === existing.id ? replacementSheet : cs
              ),
              isUploading: false,
              activeCallSheetId: existing.id,
            }));

            // Auto-fill timesheet with call times
            autoFillTimesheet(replacementSheet);

            // Auto-add new scenes and characters from call sheet to breakdown
            syncNewScenesToBreakdown(replacementSheet);
            syncNewCharactersToBreakdown(replacementSheet);

            // Sync scene log lines to breakdown
            syncSceneSynopsesToBreakdown(replacementSheet);

            return replacementSheet;
          }

          // Add new call sheet (not replacing any existing)
          set(state => ({
            callSheets: [...state.callSheets, cleanCallSheet].sort(
              (a, b) => a.productionDay - b.productionDay
            ),
            isUploading: false,
            activeCallSheetId: cleanCallSheet.id,
          }));

          // Auto-fill timesheet with call times
          autoFillTimesheet(cleanCallSheet);

          // Auto-add new scenes and characters from call sheet to breakdown
          syncNewScenesToBreakdown(cleanCallSheet);
          syncNewCharactersToBreakdown(cleanCallSheet);

          // Sync scene log lines to breakdown
          syncSceneSynopsesToBreakdown(cleanCallSheet);

          return cleanCallSheet;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to parse call sheet';
          set({ isUploading: false, uploadError: message });
          throw error;
        }
      },

      setActiveCallSheet: (id: string) => {
        set({ activeCallSheetId: id });
      },

      getActiveCallSheet: () => {
        const state = get();
        if (!state.activeCallSheetId) {
          // Default to most recent call sheet
          const sorted = [...state.callSheets].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          return sorted[0] || null;
        }
        return state.callSheets.find(cs => cs.id === state.activeCallSheetId) || null;
      },

      getCallSheetByDate: (date: string) => {
        return get().callSheets.find(cs => cs.date === date) || null;
      },

      getCallSheetByDay: (productionDay: number) => {
        return get().callSheets.find(cs => cs.productionDay === productionDay) || null;
      },

      deleteCallSheet: (id: string) => {
        set(state => ({
          callSheets: state.callSheets.filter(cs => cs.id !== id),
          activeCallSheetId: state.activeCallSheetId === id ? null : state.activeCallSheetId,
        }));
      },

      updateSceneStatus: (callSheetId, sceneNumber, status) => {
        set(state => ({
          callSheets: state.callSheets.map(cs => {
            if (cs.id !== callSheetId) return cs;
            return {
              ...cs,
              scenes: cs.scenes.map(scene =>
                scene.sceneNumber === sceneNumber
                  ? {
                      ...scene,
                      status,
                      // Record completion time when marked as wrapped
                      completedAt: status === 'wrapped' ? new Date().toISOString() : scene.completedAt,
                    }
                  : scene
              ),
            };
          }),
        }));
      },

      updateSceneFilmingStatus: (callSheetId, sceneNumber, filmingStatus, filmingNotes) => {
        set(state => ({
          callSheets: state.callSheets.map(cs => {
            if (cs.id !== callSheetId) return cs;
            return {
              ...cs,
              scenes: cs.scenes.map(scene =>
                scene.sceneNumber === sceneNumber
                  ? {
                      ...scene,
                      filmingStatus,
                      filmingNotes,
                      status: 'wrapped' as ShootingSceneStatus,
                      completedAt: new Date().toISOString(),
                    }
                  : scene
              ),
            };
          }),
        }));
      },

      clearAll: () => {
        set({ callSheets: [], activeCallSheetId: null });
      },

      // Save current call sheet data for a project (before switching projects)
      saveCallSheetsForProject: (projectId: string) => {
        const state = get();
        if (state.callSheets.length > 0) {
          set((s) => ({
            savedCallSheets: {
              ...s.savedCallSheets,
              [projectId]: {
                callSheets: s.callSheets,
                activeCallSheetId: s.activeCallSheetId,
              },
            },
            // Clear current call sheets after saving
            callSheets: [],
            activeCallSheetId: null,
            isUploading: false,
            uploadError: null,
          }));
        } else {
          // No call sheets to save, just clear state
          set({
            callSheets: [],
            activeCallSheetId: null,
            isUploading: false,
            uploadError: null,
          });
        }
      },

      // Restore call sheet data for a project (when returning to a project)
      restoreCallSheetsForProject: (projectId: string) => {
        const state = get();
        const savedData = state.savedCallSheets[projectId];
        if (!savedData) return false;

        // Remove from saved and set as current
        const newSavedCallSheets = { ...state.savedCallSheets };
        delete newSavedCallSheets[projectId];

        set({
          callSheets: savedData.callSheets,
          activeCallSheetId: savedData.activeCallSheetId,
          savedCallSheets: newSavedCallSheets,
          isUploading: false,
          uploadError: null,
        });
        return true;
      },

      // Check if a project has saved call sheet data
      hasSavedCallSheets: (projectId: string) => {
        return !!get().savedCallSheets[projectId];
      },

      // Clear current call sheets without saving (for switching to a new project)
      clearCallSheetsForProject: () => {
        set({
          callSheets: [],
          activeCallSheetId: null,
          isUploading: false,
          uploadError: null,
        });
      },
    }),
    {
      name: 'hair-makeup-callsheets',
      version: STORE_VERSION,
      storage: createHybridStorage('hair-makeup-callsheets'),
      partialize: (state) => ({
        callSheets: state.callSheets,
        activeCallSheetId: state.activeCallSheetId,
        savedCallSheets: state.savedCallSheets,
      }),
      // Migrate from old versions or corrupted data
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Partial<CallSheetState>;

        // If coming from an older version or no version, validate and clean data
        if (version < STORE_VERSION) {

          // Filter out any corrupted call sheets
          const validCallSheets = (state.callSheets || []).filter(validateCallSheet);

          return {
            callSheets: validCallSheets,
            activeCallSheetId: state.activeCallSheetId || null,
            savedCallSheets: state.savedCallSheets || {},
            isUploading: false,
            uploadError: null,
          };
        }

        return state as CallSheetState;
      },
      // Custom merge to ensure clean state on rehydration
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<CallSheetState>;

        // Validate persisted call sheets before merging
        const validCallSheets = (persisted.callSheets || []).filter(validateCallSheet);

        return {
          ...currentState,
          callSheets: validCallSheets,
          activeCallSheetId: persisted.activeCallSheetId || null,
          savedCallSheets: persisted.savedCallSheets || {},
        };
      },
    }
  )
);

// Helper function to get today's call sheet
export function getTodayCallSheet(): CallSheet | null {
  const today = new Date().toISOString().split('T')[0];
  return useCallSheetStore.getState().getCallSheetByDate(today);
}

// Helper to check if current user (HMU) has pre-call
export function getHMUPreCall(callSheet: CallSheet | null): string | null {
  if (!callSheet?.preCalls?.hmu) return null;
  return callSheet.preCalls.hmu;
}

// Helper to get HMU notes for a scene
export function getSceneHMUNotes(scene: CallSheetScene): string | null {
  if (!scene.notes) return null;
  const hmuMatch = scene.notes.match(/HMU[:\s]*([^|]+)/i);
  return hmuMatch ? hmuMatch[1].trim() : null;
}
