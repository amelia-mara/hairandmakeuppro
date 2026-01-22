import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ProductionSchedule,
  ScheduleCastMember,
  SceneDiscrepancy,
  Scene,
} from '@/types';
import { parseSchedulePDF } from '@/utils/scheduleParser';

// Helper to extract base scene number from any scene format
// Examples: "4" -> "4", "4A" -> "4", "4B" -> "4", "18B" -> "18",
// "4 PT1" -> "4", "4PT1" -> "4", "4-A" -> "4", "4.1" -> "4"
const getBaseSceneNumber = (sceneNumber: string): string => {
  // Trim and extract leading digits
  const trimmed = sceneNumber.trim();
  const match = trimmed.match(/^(\d+)/);
  return match ? match[1] : trimmed;
};

// Helper to check if a scene exists in a set, considering all variants
// Scenes with the same base number are considered matching
// E.g., "4" matches "4A", "4B"; "4A" matches "4", "4B"; "18B" matches "18"
const sceneExistsInSet = (sceneSet: Set<string>, sceneNumber: string): boolean => {
  // First check exact match
  if (sceneSet.has(sceneNumber)) return true;

  // Get base scene number for comparison
  const baseScene = getBaseSceneNumber(sceneNumber);

  // Check if any scene in the set has the same base number
  for (const s of sceneSet) {
    if (getBaseSceneNumber(s) === baseScene) {
      return true;
    }
  }

  return false;
};

// Helper to find matching scene data from a map, considering variants
// Prioritizes exact match, then any variant with same base number
const findMatchingSceneData = <T>(
  sceneMap: Map<string, T>,
  sceneNumber: string
): T | undefined => {
  // First check exact match
  if (sceneMap.has(sceneNumber)) {
    return sceneMap.get(sceneNumber);
  }

  // Get base scene number for comparison
  const baseScene = getBaseSceneNumber(sceneNumber);

  // Find any scene with the same base number
  for (const [key, value] of sceneMap) {
    if (getBaseSceneNumber(key) === baseScene) {
      return value;
    }
  }

  return undefined;
};

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
