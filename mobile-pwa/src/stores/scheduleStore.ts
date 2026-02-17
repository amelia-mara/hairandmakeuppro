import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createHybridStorage } from '@/db/zustandStorage';
import type {
  ProductionSchedule,
  ScheduleCastMember,
  ScheduleDay,
} from '@/types';
import { parseScheduleStage1 } from '@/utils/scheduleParser';
import { processScheduleStage2 } from '@/services/scheduleAIService';

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

  // Stage 2 processing state
  isProcessingStage2: boolean;
  stage2Progress: { current: number; total: number; message?: string };
  stage2Error: string | null;

  // Actions
  setSchedule: (schedule: ProductionSchedule) => void;
  uploadScheduleStage1: (file: File) => Promise<ProductionSchedule>;
  startStage2Processing: () => Promise<void>;
  updateDayData: (dayNumber: number, day: ScheduleDay) => void;
  clearSchedule: () => void;

  // Cast list helpers
  getCastMemberByNumber: (num: number) => ScheduleCastMember | null;
  getCastMemberByName: (name: string) => ScheduleCastMember | null;
  getCastNamesForNumbers: (numbers: number[]) => string[];

  // Schedule scene helpers
  getScenesForShootingDay: (dayNumber: number) => ScheduleDay | null;
  getShootingDayForScene: (sceneNumber: string) => number | null;

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
      isProcessingStage2: false,
      stage2Progress: { current: 0, total: 0 },
      stage2Error: null,

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

          // Mark as pending - Stage 2 can now be triggered
          const schedule = {
            ...result.schedule,
            status: 'pending' as const,
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

      // Stage 2: AI-powered scene extraction per shooting day
      startStage2Processing: async () => {
        const state = get();
        if (!state.schedule || state.isProcessingStage2) return;

        set({
          isProcessingStage2: true,
          stage2Error: null,
          stage2Progress: { current: 0, total: state.schedule.totalDays || 1 },
        });

        // Update schedule status to processing
        set((s) => ({
          schedule: s.schedule ? { ...s.schedule, status: 'processing' as const } : null,
        }));

        try {
          const result = await processScheduleStage2(
            state.schedule,
            (progress) => {
              set({
                stage2Progress: progress,
              });
            }
          );

          // Update schedule with parsed days
          set((s) => ({
            schedule: s.schedule
              ? {
                  ...s.schedule,
                  days: result.days,
                  status: 'complete' as const,
                  processingProgress: { current: result.days.length, total: result.days.length },
                }
              : null,
            isProcessingStage2: false,
            stage2Progress: { current: result.days.length, total: result.days.length },
          }));

          console.log('[ScheduleStore] Stage 2 complete:', {
            daysProcessed: result.days.length,
            totalScenes: result.days.reduce((sum, d) => sum + d.scenes.length, 0),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to process schedule';
          console.error('[ScheduleStore] Stage 2 failed:', error);
          set({
            isProcessingStage2: false,
            stage2Error: message,
            schedule: get().schedule
              ? { ...get().schedule!, status: 'partial' as const, processingError: message }
              : null,
          });
        }
      },

      // Update data for a specific day (used for incremental updates)
      updateDayData: (dayNumber: number, day: ScheduleDay) => {
        set((s) => {
          if (!s.schedule) return s;
          const existingIndex = s.schedule.days.findIndex((d) => d.dayNumber === dayNumber);
          const newDays = [...s.schedule.days];
          if (existingIndex >= 0) {
            newDays[existingIndex] = day;
          } else {
            newDays.push(day);
            newDays.sort((a, b) => a.dayNumber - b.dayNumber);
          }
          return {
            schedule: { ...s.schedule, days: newDays },
          };
        });
      },

      clearSchedule: () => {
        set({
          schedule: null,
          isProcessingStage2: false,
          stage2Progress: { current: 0, total: 0 },
          stage2Error: null,
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

      // Get the schedule day entry for a specific shooting day number
      getScenesForShootingDay: (dayNumber: number) => {
        const schedule = get().schedule;
        if (!schedule) return null;
        return schedule.days.find(d => d.dayNumber === dayNumber) || null;
      },

      // Find which shooting day a scene is scheduled on
      getShootingDayForScene: (sceneNumber: string) => {
        const schedule = get().schedule;
        if (!schedule) return null;
        const normalized = sceneNumber.replace(/\s+/g, '').toUpperCase();
        for (const day of schedule.days) {
          for (const scene of day.scenes) {
            if (scene.sceneNumber.replace(/\s+/g, '').toUpperCase() === normalized) {
              return day.dayNumber;
            }
          }
        }
        return null;
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
            isProcessingStage2: false,
            stage2Progress: { current: 0, total: 0 },
            stage2Error: null,
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
          isProcessingStage2: false,
          stage2Progress: { current: 0, total: 0 },
          stage2Error: null,
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
          isProcessingStage2: false,
          stage2Progress: { current: 0, total: 0 },
          stage2Error: null,
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
