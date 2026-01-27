import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createHybridStorage } from '@/db/zustandStorage';
import type { CallSheet, CallSheetScene, ShootingSceneStatus, SceneFilmingStatus } from '@/types';
import { parseCallSheetPDF } from '@/utils/callSheetParser';
import { useTimesheetStore } from './timesheetStore';
import { useProjectStore } from './projectStore';

// Current version of the store schema - increment when making breaking changes
const STORE_VERSION = 2;

interface CallSheetState {
  // All uploaded call sheets
  callSheets: CallSheet[];

  // Currently active call sheet (for "Today" view)
  activeCallSheetId: string | null;

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

  // Clear all call sheets
  clearAll: () => void;
}

// Validate that a call sheet has proper structure (scenes belong to this call sheet only)
function validateCallSheet(cs: CallSheet): boolean {
  if (!cs.id || !cs.date || !Array.isArray(cs.scenes)) return false;
  // Ensure scenes array is reasonable (not accumulated from multiple days)
  // A single day's call sheet typically has 1-20 scenes, rarely more than 30
  if (cs.scenes.length > 50) {
    console.warn(`Call sheet ${cs.id} has ${cs.scenes.length} scenes - possible data corruption`);
    return false;
  }
  return true;
}

export const useCallSheetStore = create<CallSheetState>()(
  persist(
    (set, get) => ({
      callSheets: [],
      activeCallSheetId: null,
      isUploading: false,
      uploadError: null,

      uploadCallSheet: async (file: File) => {
        set({ isUploading: true, uploadError: null });

        try {
          const callSheet = await parseCallSheetPDF(file);

          // Ensure the new call sheet has a clean scenes array (no merging)
          const cleanCallSheet: CallSheet = {
            ...callSheet,
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
            const projectStore = useProjectStore.getState();
            const project = projectStore.currentProject;
            if (!project?.scenes) return;

            // For each scene in the call sheet that has an action/log line
            cs.scenes.forEach(callSheetScene => {
              if (!callSheetScene.action) return;

              // Find matching scene in the breakdown by scene number
              const breakdownScene = project.scenes.find(
                s => s.sceneNumber === callSheetScene.sceneNumber
              );

              // If found and doesn't already have a synopsis, update it
              if (breakdownScene && !breakdownScene.synopsis) {
                projectStore.updateSceneSynopsis(breakdownScene.id, callSheetScene.action);
              }
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
                  ? { ...scene, status }
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
                  ? { ...scene, filmingStatus, filmingNotes, status: 'wrapped' as ShootingSceneStatus }
                  : scene
              ),
            };
          }),
        }));
      },

      clearAll: () => {
        set({ callSheets: [], activeCallSheetId: null });
      },
    }),
    {
      name: 'hair-makeup-callsheets',
      version: STORE_VERSION,
      storage: createHybridStorage('hair-makeup-callsheets'),
      partialize: (state) => ({
        callSheets: state.callSheets,
        activeCallSheetId: state.activeCallSheetId,
      }),
      // Migrate from old versions or corrupted data
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Partial<CallSheetState>;

        // If coming from an older version or no version, validate and clean data
        if (version < STORE_VERSION) {
          console.log(`Migrating call sheet store from version ${version} to ${STORE_VERSION}`);

          // Filter out any corrupted call sheets
          const validCallSheets = (state.callSheets || []).filter(validateCallSheet);

          // If we filtered out corrupted data, log it
          if (validCallSheets.length !== (state.callSheets || []).length) {
            console.warn('Removed corrupted call sheet data during migration');
          }

          return {
            callSheets: validCallSheets,
            activeCallSheetId: state.activeCallSheetId || null,
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
