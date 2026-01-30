import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createHybridStorage } from '@/db/zustandStorage';
import type {
  ProductionSchedule,
  ScheduleCastMember,
} from '@/types';
import { parseScheduleStage1 } from '@/utils/scheduleParser';

interface SavedScheduleData {
  schedule: ProductionSchedule | null;
}

interface ScheduleState {
  // The uploaded production schedule (contains cast list and PDF)
  schedule: ProductionSchedule | null;

  // Saved schedules by project ID (for multi-project support)
  savedSchedules: Record<string, SavedScheduleData>;

  // Loading state
  isUploading: boolean;
  uploadError: string | null;

  // Actions
  setSchedule: (schedule: ProductionSchedule) => void;
  uploadScheduleStage1: (file: File) => Promise<ProductionSchedule>;
  clearSchedule: () => void;

  // Cast list helpers
  getCastMemberByNumber: (num: number) => ScheduleCastMember | null;
  getCastMemberByName: (name: string) => ScheduleCastMember | null;
  getCastNamesForNumbers: (numbers: number[]) => string[];

  // Multi-project support: save/restore schedule data
  saveScheduleForProject: (projectId: string) => void;
  restoreScheduleForProject: (projectId: string) => boolean;
  hasSavedSchedule: (projectId: string) => boolean;
  clearScheduleForProject: () => void;
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      schedule: null,
      savedSchedules: {},
      isUploading: false,
      uploadError: null,

      setSchedule: (schedule: ProductionSchedule) => {
        set({ schedule, isUploading: false, uploadError: null });
      },

      // Stage 1 upload - extracts cast list, production name, and stores PDF for viewing
      uploadScheduleStage1: async (file: File) => {
        set({ isUploading: true, uploadError: null });

        try {
          console.log('[ScheduleStore] Starting Stage 1 parsing...');
          const result = await parseScheduleStage1(file);

          console.log('[ScheduleStore] Stage 1 complete:', {
            castCount: result.schedule.castList.length,
            totalDays: result.schedule.totalDays,
            productionName: result.schedule.productionName,
          });

          // Mark as complete since we're only doing PDF viewing now
          const schedule = {
            ...result.schedule,
            status: 'complete' as const,
          };

          set({
            schedule,
            isUploading: false,
          });

          return schedule;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to parse schedule';
          console.error('[ScheduleStore] Stage 1 failed:', error);
          set({ isUploading: false, uploadError: message });
          throw error;
        }
      },

      clearSchedule: () => {
        set({
          schedule: null,
        });
      },

      getCastMemberByNumber: (num: number) => {
        const schedule = get().schedule;
        if (!schedule) return null;
        return schedule.castList.find(c => c.number === num) || null;
      },

      getCastMemberByName: (name: string) => {
        const schedule = get().schedule;
        if (!schedule) return null;
        const normalizedName = name.toUpperCase().trim();
        return schedule.castList.find(
          c => c.name.toUpperCase().includes(normalizedName) ||
               (c.character && c.character.toUpperCase().includes(normalizedName))
        ) || null;
      },

      getCastNamesForNumbers: (numbers: number[]) => {
        const schedule = get().schedule;
        if (!schedule) return [];
        return numbers
          .map(num => {
            const member = schedule.castList.find(c => c.number === num);
            return member ? (member.character || member.name) : `Cast #${num}`;
          });
      },

      // Save current schedule data for a project (before switching projects)
      saveScheduleForProject: (projectId: string) => {
        const state = get();
        if (state.schedule) {
          set((s) => ({
            savedSchedules: {
              ...s.savedSchedules,
              [projectId]: {
                schedule: s.schedule,
              },
            },
            // Clear current schedule after saving
            schedule: null,
            isUploading: false,
            uploadError: null,
          }));
        }
      },

      // Restore schedule data for a project (when returning to a project)
      restoreScheduleForProject: (projectId: string) => {
        const state = get();
        const savedData = state.savedSchedules[projectId];
        if (!savedData) return false;

        // Remove from saved and set as current
        const newSavedSchedules = { ...state.savedSchedules };
        delete newSavedSchedules[projectId];

        set({
          schedule: savedData.schedule,
          savedSchedules: newSavedSchedules,
          isUploading: false,
          uploadError: null,
        });
        return true;
      },

      // Check if a project has saved schedule data
      hasSavedSchedule: (projectId: string) => {
        return !!get().savedSchedules[projectId];
      },

      // Clear current schedule without saving (for switching to a new project)
      clearScheduleForProject: () => {
        set({
          schedule: null,
          isUploading: false,
          uploadError: null,
        });
      },
    }),
    {
      name: 'hair-makeup-schedule',
      storage: createHybridStorage('hair-makeup-schedule'),
      partialize: (state) => ({
        schedule: state.schedule,
        savedSchedules: state.savedSchedules,
      }),
    }
  )
);

// Helper to get character name from cast number (for call sheets)
export function getCastNameFromNumber(num: number): string {
  const member = useScheduleStore.getState().getCastMemberByNumber(num);
  return member ? (member.character || member.name) : `Cast #${num}`;
}
