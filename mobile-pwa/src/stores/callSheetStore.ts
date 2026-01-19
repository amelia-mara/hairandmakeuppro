import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CallSheet, CallSheetScene, ShootingSceneStatus, SceneFilmingStatus } from '@/types';
import { parseCallSheetPDF } from '@/utils/callSheetParser';

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

          // Check if we already have a call sheet for this day
          const existing = get().callSheets.find(
            cs => cs.date === callSheet.date || cs.productionDay === callSheet.productionDay
          );

          if (existing) {
            // Update existing call sheet
            set(state => ({
              callSheets: state.callSheets.map(cs =>
                cs.id === existing.id ? { ...callSheet, id: existing.id } : cs
              ),
              isUploading: false,
              activeCallSheetId: existing.id,
            }));
            return { ...callSheet, id: existing.id };
          }

          // Add new call sheet
          set(state => ({
            callSheets: [...state.callSheets, callSheet].sort(
              (a, b) => a.productionDay - b.productionDay
            ),
            isUploading: false,
            activeCallSheetId: callSheet.id,
          }));

          return callSheet;
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
                  ? { ...scene, filmingStatus, filmingNotes }
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
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        callSheets: state.callSheets,
        activeCallSheetId: state.activeCallSheetId,
      }),
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
