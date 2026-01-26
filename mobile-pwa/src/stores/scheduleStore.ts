import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createHybridStorage } from '@/db/zustandStorage';
import type {
  ProductionSchedule,
  ScheduleCastMember,
  SceneDiscrepancy,
  Scene,
  ScheduleDay,
  ScheduleStatus,
} from '@/types';
import { parseScheduleStage1, parseSchedulePDF, type Stage1Result } from '@/utils/scheduleParser';
import {
  parseScheduleWithAI,
  parseSingleDayWithAI,
  shouldUseAIProcessing,
  type AIScheduleProcessingStatus,
} from '@/services/scheduleAIService';
import {
  getBaseSceneNumber,
  sceneExistsInSet,
  findMatchingSceneData,
} from '@/utils/helpers';

interface ScheduleState {
  // The uploaded production schedule
  schedule: ProductionSchedule | null;

  // Stage 1 result for Stage 2 processing
  stage1Result: Stage1Result | null;

  // Discrepancies found when cross-referencing with breakdown
  discrepancies: SceneDiscrepancy[];

  // Loading state
  isUploading: boolean;
  uploadError: string | null;

  // Stage 2 processing state
  isProcessingStage2: boolean;
  stage2Progress: { current: number; total: number; message: string };

  // Legacy AI processing state (for backwards compatibility)
  aiProcessingStatus: AIScheduleProcessingStatus;
  isAIProcessing: boolean;

  // Show discrepancy modal
  showDiscrepancyModal: boolean;

  // Actions
  setSchedule: (schedule: ProductionSchedule) => void;
  uploadSchedule: (file: File) => Promise<ProductionSchedule>;
  uploadScheduleStage1: (file: File) => Promise<ProductionSchedule>;
  clearSchedule: () => void;

  // Stage 2 processing (background)
  startStage2Processing: () => Promise<void>;
  updateDayData: (dayNumber: number, dayData: ScheduleDay) => void;
  setScheduleStatus: (status: ScheduleStatus, error?: string) => void;

  // Legacy AI processing actions (for backwards compatibility)
  startAIProcessing: () => Promise<void>;
  setAIProcessingStatus: (status: AIScheduleProcessingStatus) => void;

  // Cast list helpers
  getCastMemberByNumber: (num: number) => ScheduleCastMember | null;
  getCastMemberByName: (name: string) => ScheduleCastMember | null;
  getCastNamesForNumbers: (numbers: number[]) => string[];

  // Discrepancy management
  setDiscrepancies: (discrepancies: SceneDiscrepancy[]) => void;
  clearDiscrepancies: () => void;
  getDiscrepancyForScene: (sceneNumber: string) => SceneDiscrepancy | null;
  setShowDiscrepancyModal: (show: boolean) => void;

  // Cross-reference with breakdown
  crossReferenceWithBreakdown: (breakdownScenes: Scene[]) => SceneDiscrepancy[];

  // Get shooting day for a scene
  getShootingDayForScene: (sceneNumber: string) => number | null;

  // Get shooting info (day and order) for a scene
  getShootingInfoForScene: (sceneNumber: string) => { dayNumber: number; shootOrder: number } | null;
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      schedule: null,
      stage1Result: null,
      discrepancies: [],
      isUploading: false,
      uploadError: null,
      showDiscrepancyModal: false,
      isProcessingStage2: false,
      stage2Progress: { current: 0, total: 0, message: '' },
      aiProcessingStatus: {
        status: 'idle',
        progress: 0,
        message: '',
      },
      isAIProcessing: false,

      setSchedule: (schedule: ProductionSchedule) => {
        set({ schedule, isUploading: false, uploadError: null });
      },

      setScheduleStatus: (status: ScheduleStatus, error?: string) => {
        const schedule = get().schedule;
        if (schedule) {
          set({
            schedule: {
              ...schedule,
              status,
              processingError: error,
            },
          });
        }
      },

      updateDayData: (dayNumber: number, dayData: ScheduleDay) => {
        const schedule = get().schedule;
        if (!schedule) return;

        // Check if day already exists
        const existingIndex = schedule.days.findIndex(d => d.dayNumber === dayNumber);
        let newDays: ScheduleDay[];

        if (existingIndex >= 0) {
          // Update existing day
          newDays = [...schedule.days];
          newDays[existingIndex] = dayData;
        } else {
          // Add new day and sort by day number
          newDays = [...schedule.days, dayData].sort((a, b) => a.dayNumber - b.dayNumber);
        }

        // Update progress
        const newProgress = {
          current: newDays.length,
          total: schedule.totalDays,
        };

        set({
          schedule: {
            ...schedule,
            days: newDays,
            processingProgress: newProgress,
          },
          stage2Progress: {
            current: newDays.length,
            total: schedule.totalDays,
            message: `Parsed Day ${dayNumber} of ${schedule.totalDays}`,
          },
        });
      },

      setAIProcessingStatus: (status: AIScheduleProcessingStatus) => {
        set({
          aiProcessingStatus: status,
          isAIProcessing: status.status === 'processing',
        });
      },

      // NEW: Stage 1 upload (instant - cast list, day count, production name only)
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

          set({
            schedule: result.schedule,
            stage1Result: result,
            isUploading: false,
            stage2Progress: {
              current: 0,
              total: result.schedule.totalDays,
              message: 'Ready to process scenes...',
            },
          });

          // Start Stage 2 processing in background after short delay
          setTimeout(() => {
            get().startStage2Processing();
          }, 500);

          return result.schedule;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to parse schedule';
          console.error('[ScheduleStore] Stage 1 failed:', error);
          set({ isUploading: false, uploadError: message });
          throw error;
        }
      },

      // NEW: Stage 2 background processing (day-by-day AI parsing)
      startStage2Processing: async () => {
        const { schedule, stage1Result, setScheduleStatus, updateDayData } = get();

        if (!schedule || !stage1Result) {
          console.log('[ScheduleStore] No schedule or stage1Result for Stage 2 processing');
          return;
        }

        console.log('[ScheduleStore] Starting Stage 2 processing...');
        set({
          isProcessingStage2: true,
          stage2Progress: {
            current: 0,
            total: schedule.totalDays,
            message: 'Starting scene extraction...',
          },
        });

        setScheduleStatus('processing');

        const { dayTextBlocks } = stage1Result;
        const castReference = schedule.castList.map(c => `${c.number}.${c.name}`).join(', ');
        let successCount = 0;
        let failCount = 0;

        // Process each day
        for (let i = 0; i < schedule.totalDays; i++) {
          const dayNum = i + 1;

          set({
            stage2Progress: {
              current: i,
              total: schedule.totalDays,
              message: `Parsing Day ${dayNum} of ${schedule.totalDays}...`,
            },
          });

          try {
            // Get text block for this day
            const dayText = dayTextBlocks[i] || '';

            if (dayText.length < 50) {
              console.log(`[ScheduleStore] Day ${dayNum}: No text block, skipping`);
              continue;
            }

            // Call AI to parse this day's scenes
            const dayData = await parseSingleDayWithAI(dayNum, dayText, castReference);

            if (dayData && dayData.scenes.length > 0) {
              updateDayData(dayNum, dayData);
              successCount++;
              console.log(`[ScheduleStore] Day ${dayNum}: Parsed ${dayData.scenes.length} scenes`);
            } else {
              console.log(`[ScheduleStore] Day ${dayNum}: No scenes found`);
              failCount++;
            }
          } catch (error) {
            console.error(`[ScheduleStore] Day ${dayNum} failed:`, error);
            failCount++;
            // Continue with other days even if one fails
          }
        }

        // Determine final status
        const finalStatus: ScheduleStatus = failCount === 0 ? 'complete' :
                                            successCount > 0 ? 'partial' : 'pending';
        const errorMessage = failCount > 0 ? `${failCount} days could not be parsed` : undefined;

        setScheduleStatus(finalStatus, errorMessage);

        set({
          isProcessingStage2: false,
          stage2Progress: {
            current: schedule.totalDays,
            total: schedule.totalDays,
            message: finalStatus === 'complete'
              ? `Successfully parsed ${successCount} days`
              : `Parsed ${successCount} days, ${failCount} incomplete`,
          },
        });

        console.log(`[ScheduleStore] Stage 2 complete: ${successCount} success, ${failCount} failed`);
      },

      // LEGACY: Full AI processing (for backwards compatibility)
      startAIProcessing: async () => {
        const { schedule, setAIProcessingStatus, setSchedule } = get();
        console.log('[ScheduleStore] startAIProcessing called');
        console.log('[ScheduleStore] Has schedule:', !!schedule);
        console.log('[ScheduleStore] Has rawText:', !!schedule?.rawText);
        console.log('[ScheduleStore] rawText length:', schedule?.rawText?.length || 0);

        if (!schedule || !schedule.rawText) {
          console.log('[ScheduleStore] No schedule or raw text available for AI processing');
          setAIProcessingStatus({
            status: 'complete',
            progress: 100,
            message: 'Using initial parsing results',
          });
          return;
        }

        // Check if AI processing would be beneficial
        if (!shouldUseAIProcessing(schedule)) {
          console.log('[ScheduleStore] AI processing not needed - regex parsing was sufficient');
          const totalScenes = schedule.days.reduce((sum, d) => sum + d.scenes.length, 0);
          setAIProcessingStatus({
            status: 'complete',
            progress: 100,
            message: `Schedule parsed: ${totalScenes} scenes across ${schedule.days.length} days`,
          });
          return;
        }

        console.log('[ScheduleStore] Starting AI processing...');
        set({ isAIProcessing: true });

        try {
          const aiSchedule = await parseScheduleWithAI(
            schedule.rawText,
            schedule,
            (status) => {
              console.log('[ScheduleStore] AI progress:', status.progress, status.message);
              setAIProcessingStatus(status);
            }
          );

          // Only update schedule if AI found more/different data
          const aiSceneCount = aiSchedule.days.reduce((sum, d) => sum + d.scenes.length, 0);
          const originalSceneCount = schedule.days.reduce((sum, d) => sum + d.scenes.length, 0);

          console.log('[ScheduleStore] AI found', aiSceneCount, 'scenes, original had', originalSceneCount);

          // Update schedule with AI-parsed data if it found scenes
          if (aiSceneCount > 0) {
            setSchedule(aiSchedule);
            setAIProcessingStatus({
              status: 'complete',
              progress: 100,
              message: `Successfully identified ${aiSceneCount} scenes across ${aiSchedule.days.length} days`,
            });
          } else {
            // AI didn't find anything, keep original
            console.log('[ScheduleStore] AI found no scenes, keeping original results');
            setAIProcessingStatus({
              status: 'complete',
              progress: 100,
              message: `Using initial parsing: ${originalSceneCount} scenes across ${schedule.days.length} days`,
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('[ScheduleStore] AI schedule processing failed:', error);

          // Don't show error status if we have regex results - just note that AI enhancement failed
          const originalSceneCount = schedule.days.reduce((sum, d) => sum + d.scenes.length, 0);
          if (originalSceneCount > 0) {
            setAIProcessingStatus({
              status: 'complete',
              progress: 100,
              message: `Using initial parsing: ${originalSceneCount} scenes (AI enhancement unavailable)`,
            });
          } else {
            setAIProcessingStatus({
              status: 'error',
              progress: 0,
              message: 'Schedule parsing failed',
              error: errorMessage,
            });
          }
        } finally {
          set({ isAIProcessing: false });
        }
      },

      uploadSchedule: async (file: File) => {
        set({ isUploading: true, uploadError: null });

        try {
          const schedule = await parseSchedulePDF(file);

          set({
            schedule,
            isUploading: false,
            aiProcessingStatus: {
              status: 'idle',
              progress: 0,
              message: 'Initial parsing complete. Starting AI analysis...',
            },
          });

          // Start AI processing in the background
          // Use setTimeout to allow the UI to update first
          setTimeout(() => {
            get().startAIProcessing();
          }, 100);

          return schedule;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to parse schedule';
          set({ isUploading: false, uploadError: message });
          throw error;
        }
      },

      clearSchedule: () => {
        set({
          schedule: null,
          discrepancies: [],
          aiProcessingStatus: {
            status: 'idle',
            progress: 0,
            message: '',
          },
          isAIProcessing: false,
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

      setDiscrepancies: (discrepancies: SceneDiscrepancy[]) => {
        set({ discrepancies, showDiscrepancyModal: discrepancies.length > 0 });
      },

      clearDiscrepancies: () => {
        set({ discrepancies: [], showDiscrepancyModal: false });
      },

      getDiscrepancyForScene: (sceneNumber: string) => {
        return get().discrepancies.find(d => d.sceneNumber === sceneNumber) || null;
      },

      setShowDiscrepancyModal: (show: boolean) => {
        set({ showDiscrepancyModal: show });
      },

      crossReferenceWithBreakdown: (breakdownScenes: Scene[]) => {
        const schedule = get().schedule;
        if (!schedule) return [];

        const discrepancies: SceneDiscrepancy[] = [];
        const breakdownSceneNumbers = new Set(breakdownScenes.map(s => s.sceneNumber));

        // Collect all scene numbers from schedule
        const scheduleSceneNumbers = new Set<string>();
        const scheduleSceneMap = new Map<string, {
          intExt: 'INT' | 'EXT';
          castNumbers: number[];
          setLocation: string;
        }>();

        for (const day of schedule.days) {
          for (const scene of day.scenes) {
            scheduleSceneNumbers.add(scene.sceneNumber);
            scheduleSceneMap.set(scene.sceneNumber, {
              intExt: scene.intExt,
              castNumbers: scene.castNumbers,
              setLocation: scene.setLocation,
            });
          }
        }

        // Check for scenes in schedule but not in breakdown
        // Uses fuzzy matching: schedule scene "4A" matches breakdown scene "4"
        for (const sceneNum of scheduleSceneNumbers) {
          if (!sceneExistsInSet(breakdownSceneNumbers, sceneNum)) {
            discrepancies.push({
              sceneNumber: sceneNum,
              type: 'scene_not_in_breakdown',
              message: `Scene ${sceneNum} is in the schedule but not found in the breakdown`,
              scheduleValue: 'Present',
              breakdownValue: 'Missing',
            });
          }
        }

        // Check for scenes in breakdown but not in schedule
        // Uses fuzzy matching: breakdown scene "4" matches schedule scenes "4A", "4B"
        for (const sceneNum of breakdownSceneNumbers) {
          if (!sceneExistsInSet(scheduleSceneNumbers, sceneNum)) {
            discrepancies.push({
              sceneNumber: sceneNum,
              type: 'scene_not_in_schedule',
              message: `Scene ${sceneNum} is in the breakdown but not found in the schedule`,
              scheduleValue: 'Missing',
              breakdownValue: 'Present',
            });
          }
        }

        // Check for character and INT/EXT mismatches in common scenes
        // Uses fuzzy matching to find schedule data for breakdown scenes
        for (const breakdownScene of breakdownScenes) {
          const scheduleScene = findMatchingSceneData(scheduleSceneMap, breakdownScene.sceneNumber);
          if (!scheduleScene) continue;

          // Check INT/EXT mismatch
          if (scheduleScene.intExt !== breakdownScene.intExt) {
            discrepancies.push({
              sceneNumber: breakdownScene.sceneNumber,
              type: 'int_ext_mismatch',
              message: `Scene ${breakdownScene.sceneNumber} has different INT/EXT: Schedule says ${scheduleScene.intExt}, breakdown says ${breakdownScene.intExt}`,
              scheduleValue: scheduleScene.intExt,
              breakdownValue: breakdownScene.intExt,
            });
          }

          // Check character mismatch
          const scheduleCastNames = get().getCastNamesForNumbers(scheduleScene.castNumbers)
            .map(n => n.toUpperCase());
          const breakdownCastNames = breakdownScene.characters.map(c => c.toUpperCase());

          // Find characters in schedule not in breakdown
          const missingFromBreakdown = scheduleCastNames.filter(
            name => !breakdownCastNames.some(bName =>
              bName.includes(name) || name.includes(bName)
            )
          );

          // Find characters in breakdown not in schedule
          const missingFromSchedule = breakdownCastNames.filter(
            name => !scheduleCastNames.some(sName =>
              sName.includes(name) || name.includes(sName)
            )
          );

          if (missingFromBreakdown.length > 0 || missingFromSchedule.length > 0) {
            const details: string[] = [];
            if (missingFromBreakdown.length > 0) {
              details.push(`Schedule has: ${missingFromBreakdown.join(', ')}`);
            }
            if (missingFromSchedule.length > 0) {
              details.push(`Breakdown has: ${missingFromSchedule.join(', ')}`);
            }

            discrepancies.push({
              sceneNumber: breakdownScene.sceneNumber,
              type: 'character_mismatch',
              message: `Scene ${breakdownScene.sceneNumber} has character differences. ${details.join('. ')}`,
              scheduleCast: scheduleCastNames,
              breakdownCast: breakdownCastNames,
            });
          }
        }

        set({ discrepancies, showDiscrepancyModal: discrepancies.length > 0 });
        return discrepancies;
      },

      getShootingDayForScene: (sceneNumber: string) => {
        const schedule = get().schedule;
        if (!schedule) return null;

        const baseScene = getBaseSceneNumber(sceneNumber);

        for (const day of schedule.days) {
          // First try exact match
          const exactFound = day.scenes.find(s => s.sceneNumber === sceneNumber);
          if (exactFound) return day.dayNumber;

          // Then try matching by base scene number (handles all variants)
          const variantFound = day.scenes.find(s =>
            getBaseSceneNumber(s.sceneNumber) === baseScene
          );
          if (variantFound) return day.dayNumber;
        }
        return null;
      },

      getShootingInfoForScene: (sceneNumber: string) => {
        const schedule = get().schedule;
        if (!schedule) return null;

        const baseScene = getBaseSceneNumber(sceneNumber);

        for (const day of schedule.days) {
          // First try exact match
          const exactFound = day.scenes.find(s => s.sceneNumber === sceneNumber);
          if (exactFound) {
            return { dayNumber: day.dayNumber, shootOrder: exactFound.shootOrder };
          }

          // Then try matching by base scene number (handles all variants)
          const variantFound = day.scenes.find(s =>
            getBaseSceneNumber(s.sceneNumber) === baseScene
          );
          if (variantFound) {
            return { dayNumber: day.dayNumber, shootOrder: variantFound.shootOrder };
          }
        }
        return null;
      },
    }),
    {
      name: 'hair-makeup-schedule',
      storage: createHybridStorage('hair-makeup-schedule'),
      partialize: (state) => ({
        schedule: state.schedule,
        discrepancies: state.discrepancies,
      }),
    }
  )
);

// Helper to get character name from cast number (for call sheets)
export function getCastNameFromNumber(num: number): string {
  const member = useScheduleStore.getState().getCastMemberByNumber(num);
  return member ? (member.character || member.name) : `Cast #${num}`;
}
