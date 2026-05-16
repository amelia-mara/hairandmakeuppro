import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createHybridStorage } from '@/db/zustandStorage';
import { supabase } from '@/lib/supabase';
import * as supabaseStorage from '@/services/supabaseStorage';
import { setReceivingFromServer } from '@/services/syncChangeTracker';
import type {
  ProductionSchedule,
  ScheduleCastMember,
  ScheduleDay,
} from '@/types';
import { parseScheduleStage1 } from '@/utils/scheduleParser';
import { processScheduleStage2 } from '@/services/scheduleAIService';
import {
  compareScheduleAmendment,
  applyScheduleAmendment,
  type ScheduleAmendmentResult,
} from '@/services/scheduleAmendmentService';

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

  // Amendment state
  pendingSchedule: ProductionSchedule | null;

  // Actions
  setSchedule: (schedule: ProductionSchedule) => void;
  uploadScheduleStage1: (file: File) => Promise<ProductionSchedule>;
  uploadRevisionStage1: (file: File) => Promise<ProductionSchedule>;
  startStage2Processing: () => Promise<void>;
  startRevisionStage2Processing: () => Promise<void>;
  compareAmendment: () => ScheduleAmendmentResult | null;
  applyAmendment: (
    amendmentResult: ScheduleAmendmentResult,
    options?: {
      includeAddedScenes?: boolean;
      includeRemovedScenes?: boolean;
      includeMovedScenes?: boolean;
      includeCastChanges?: boolean;
      includeTimingChanges?: boolean;
    }
  ) => void;
  clearPendingSchedule: () => void;
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

  // Server fetch on project switch. setProject in projectStore fans
  // out to this so per-project stores own their own data loading.
  fetchForProject: (projectId: string) => Promise<void>;
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
      pendingSchedule: null,

      setSchedule: (schedule: ProductionSchedule) => {
        set({ schedule, isUploading: false, uploadError: null });
      },

      // Stage 1 upload - extracts cast list, production name, and stores PDF for viewing
      uploadScheduleStage1: async (file: File) => {
        set({ isUploading: true, uploadError: null });

        try {
          const result = await parseScheduleStage1(file);


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

      // Upload a revised schedule - stores as pending for comparison
      uploadRevisionStage1: async (file: File) => {
        set({ isUploading: true, uploadError: null });

        try {
          const result = await parseScheduleStage1(file);

          const pendingSchedule = {
            ...result.schedule,
            status: 'pending' as const,
          };

          set({
            pendingSchedule,
            isUploading: false,
          });

          return pendingSchedule;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to parse revised schedule';
          console.error('[ScheduleStore] Revision Stage 1 failed:', error);
          set({ isUploading: false, uploadError: message });
          throw error;
        }
      },

      // Process Stage 2 for the pending revision schedule
      startRevisionStage2Processing: async () => {
        const state = get();
        if (!state.pendingSchedule || state.isProcessingStage2) return;

        set({
          isProcessingStage2: true,
          stage2Error: null,
          stage2Progress: { current: 0, total: state.pendingSchedule.totalDays || 1 },
        });

        try {
          const result = await processScheduleStage2(
            state.pendingSchedule,
            (progress) => {
              set({ stage2Progress: progress });
            }
          );

          set((s) => ({
            pendingSchedule: s.pendingSchedule
              ? {
                  ...s.pendingSchedule,
                  days: result.days,
                  status: 'complete' as const,
                  processingProgress: { current: result.days.length, total: result.days.length },
                }
              : null,
            isProcessingStage2: false,
            stage2Progress: { current: result.days.length, total: result.days.length },
          }));

        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to process revised schedule';
          console.error('[ScheduleStore] Revision Stage 2 failed:', error);
          set({
            isProcessingStage2: false,
            stage2Error: message,
          });
        }
      },

      // Compare pending schedule against current schedule
      compareAmendment: () => {
        const state = get();
        if (!state.schedule || !state.pendingSchedule) return null;
        if (state.schedule.days.length === 0 || state.pendingSchedule.days.length === 0) return null;

        return compareScheduleAmendment(state.schedule, state.pendingSchedule);
      },

      // Apply amendment from pending schedule
      applyAmendment: (
        amendmentResult: ScheduleAmendmentResult,
        options?: {
          includeAddedScenes?: boolean;
          includeRemovedScenes?: boolean;
          includeMovedScenes?: boolean;
          includeCastChanges?: boolean;
          includeTimingChanges?: boolean;
        }
      ) => {
        const state = get();
        if (!state.schedule || !state.pendingSchedule) return;

        const mergedSchedule = applyScheduleAmendment(
          state.schedule,
          state.pendingSchedule,
          amendmentResult,
          options
        );

        set({
          schedule: mergedSchedule,
          pendingSchedule: null,
        });

      },

      // Clear the pending schedule without applying
      clearPendingSchedule: () => {
        set({ pendingSchedule: null });
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

      // Server fetch for a project. Called from projectStore.setProject
      // so this store owns its data ingress. Clears any in-flight state
      // first to keep render output deterministic during the switch.
      fetchForProject: async (projectId: string) => {
        set({
          schedule: null,
          isUploading: false,
          uploadError: null,
          isProcessingStage2: false,
          stage2Progress: { current: 0, total: 0 },
          stage2Error: null,
        });
        const { data, error } = await supabase
          .from('schedule_data')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(1);
        if (error) {
          console.warn('[scheduleStore.fetchForProject] query failed', error);
          return;
        }
        if (!data || data.length === 0) return;
        const db = data[0];
        if (!db.days && !db.cast_list) return;

        const schedule: ProductionSchedule = {
          id: db.id as string,
          status: (db.status as ProductionSchedule['status']) === 'complete' ? 'complete' : 'pending',
          castList: (db.cast_list as unknown as ScheduleCastMember[]) || [],
          days: (db.days as unknown as ScheduleDay[]) || [],
          totalDays: ((db.days as unknown as ScheduleDay[]) || []).length,
          uploadedAt: db.created_at ? new Date(db.created_at as string) : new Date(),
          rawText: (db.raw_pdf_text as string) || undefined,
        };
        setReceivingFromServer(true);
        try {
          get().setSchedule(schedule);
        } finally {
          setReceivingFromServer(false);
        }

        // PDF dataUri download runs detached so the rest of the
        // project-switch path isn't blocked on storage I/O. Guard the
        // setSchedule merge against the user having switched away
        // before the download resolved — we look up the schedule
        // again and bail if its id no longer matches.
        const storagePath = db.storage_path as string | null;
        if (storagePath) {
          supabaseStorage.downloadDocumentAsDataUri(storagePath)
            .then(({ dataUri, error: dlError }) => {
              if (dlError || !dataUri) {
                console.warn('[scheduleStore.fetchForProject] PDF download failed:', dlError?.message || 'no data', storagePath);
                return;
              }
              const current = get().schedule;
              if (!current || current.id !== db.id) return;
              setReceivingFromServer(true);
              try {
                get().setSchedule({ ...current, pdfUri: dataUri });
              } finally {
                setReceivingFromServer(false);
              }
            })
            .catch((err) => console.warn('[scheduleStore.fetchForProject] PDF download error:', err));
        }
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

