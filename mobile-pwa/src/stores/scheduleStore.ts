import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ProductionSchedule,
  ScheduleCastMember,
  SceneDiscrepancy,
  Scene,
} from '@/types';
import { parseSchedulePDF } from '@/utils/scheduleParser';

interface ScheduleState {
  // The uploaded production schedule
  schedule: ProductionSchedule | null;

  // Discrepancies found when cross-referencing with breakdown
  discrepancies: SceneDiscrepancy[];

  // Loading state
  isUploading: boolean;
  uploadError: string | null;

  // Show discrepancy modal
  showDiscrepancyModal: boolean;

  // Actions
  uploadSchedule: (file: File) => Promise<ProductionSchedule>;
  clearSchedule: () => void;

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
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      schedule: null,
      discrepancies: [],
      isUploading: false,
      uploadError: null,
      showDiscrepancyModal: false,

      uploadSchedule: async (file: File) => {
        set({ isUploading: true, uploadError: null });

        try {
          const schedule = await parseSchedulePDF(file);

          set({
            schedule,
            isUploading: false,
          });

          return schedule;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to parse schedule';
          set({ isUploading: false, uploadError: message });
          throw error;
        }
      },

      clearSchedule: () => {
        set({ schedule: null, discrepancies: [] });
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
        for (const sceneNum of scheduleSceneNumbers) {
          if (!breakdownSceneNumbers.has(sceneNum)) {
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
        for (const sceneNum of breakdownSceneNumbers) {
          if (!scheduleSceneNumbers.has(sceneNum)) {
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
        for (const breakdownScene of breakdownScenes) {
          const scheduleScene = scheduleSceneMap.get(breakdownScene.sceneNumber);
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

        for (const day of schedule.days) {
          const found = day.scenes.find(s => s.sceneNumber === sceneNumber);
          if (found) return day.dayNumber;
        }
        return null;
      },
    }),
    {
      name: 'hair-makeup-schedule',
      storage: createJSONStorage(() => localStorage),
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
