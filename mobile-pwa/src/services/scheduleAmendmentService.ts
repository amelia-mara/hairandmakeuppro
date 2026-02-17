/**
 * Schedule Amendment Service
 *
 * Compares new schedule versions against existing schedule data to:
 * - Detect new scenes added to the schedule
 * - Detect scenes removed from the schedule
 * - Detect scenes moved to different shooting days
 * - Detect timing changes (estimated time, shoot order)
 * - Detect cast assignment changes
 * - Preserve existing breakdown data when applying changes
 */

import type {
  ProductionSchedule,
  ScheduleDay,
  ScheduleSceneEntry,
  ScheduleCastMember,
} from '@/types';

export type ScheduleChangeType =
  | 'scene_added'
  | 'scene_removed'
  | 'scene_moved'
  | 'cast_changed'
  | 'timing_changed'
  | 'day_added'
  | 'day_removed';

export interface ScheduleSceneChange {
  sceneNumber: string;
  changeType: ScheduleChangeType;
  description: string;
  oldDay?: number;
  newDay?: number;
  oldEntry?: ScheduleSceneEntry;
  newEntry?: ScheduleSceneEntry;
  castAdded?: number[];
  castRemoved?: number[];
}

export interface ScheduleDayChange {
  dayNumber: number;
  changeType: 'day_added' | 'day_removed' | 'day_modified';
  description: string;
  oldDay?: ScheduleDay;
  newDay?: ScheduleDay;
  sceneChanges: ScheduleSceneChange[];
}

export interface ScheduleAmendmentResult {
  dayChanges: ScheduleDayChange[];
  allSceneChanges: ScheduleSceneChange[];
  addedScenes: ScheduleSceneChange[];
  removedScenes: ScheduleSceneChange[];
  movedScenes: ScheduleSceneChange[];
  castChanges: ScheduleSceneChange[];
  timingChanges: ScheduleSceneChange[];
  addedDays: ScheduleDayChange[];
  removedDays: ScheduleDayChange[];
  summary: string;
  hasChanges: boolean;
}

/**
 * Build a map of scene number -> { day, entry } for quick lookup
 */
function buildSceneMap(schedule: ProductionSchedule): Map<string, { day: ScheduleDay; entry: ScheduleSceneEntry }> {
  const map = new Map<string, { day: ScheduleDay; entry: ScheduleSceneEntry }>();
  for (const day of schedule.days) {
    for (const entry of day.scenes) {
      const normalized = entry.sceneNumber.replace(/\s+/g, '').toUpperCase();
      map.set(normalized, { day, entry });
    }
  }
  return map;
}

/**
 * Normalize scene number for comparison
 */
function normalizeSceneNumber(sceneNumber: string): string {
  return sceneNumber.replace(/\s+/g, '').toUpperCase();
}

/**
 * Check if cast numbers have changed between old and new scene entries
 */
function detectCastChanges(
  oldEntry: ScheduleSceneEntry,
  newEntry: ScheduleSceneEntry
): { added: number[]; removed: number[] } | null {
  const oldSet = new Set(oldEntry.castNumbers);
  const newSet = new Set(newEntry.castNumbers);

  const added = [...newSet].filter(n => !oldSet.has(n));
  const removed = [...oldSet].filter(n => !newSet.has(n));

  if (added.length === 0 && removed.length === 0) return null;
  return { added, removed };
}

/**
 * Check if timing/order has changed between old and new scene entries
 */
function detectTimingChanges(
  oldEntry: ScheduleSceneEntry,
  newEntry: ScheduleSceneEntry,
  sameDay: boolean
): boolean {
  if (!sameDay) return false; // Moves are tracked separately

  // Check estimated time change
  if ((oldEntry.estimatedTime || '') !== (newEntry.estimatedTime || '')) return true;

  // Check shoot order change
  if (oldEntry.shootOrder !== newEntry.shootOrder) return true;

  // Check pages change
  if ((oldEntry.pages || '') !== (newEntry.pages || '')) return true;

  return false;
}

/**
 * Compare a new schedule against the existing schedule
 * Returns detailed information about what changed
 */
export function compareScheduleAmendment(
  existingSchedule: ProductionSchedule,
  newSchedule: ProductionSchedule
): ScheduleAmendmentResult {
  const existingMap = buildSceneMap(existingSchedule);
  const newMap = buildSceneMap(newSchedule);
  const allSceneChanges: ScheduleSceneChange[] = [];
  const dayChanges: ScheduleDayChange[] = [];

  const existingDayNumbers = new Set(existingSchedule.days.map(d => d.dayNumber));
  const newDayNumbers = new Set(newSchedule.days.map(d => d.dayNumber));

  // Track processed scenes
  const processedScenes = new Set<string>();

  // Check each scene in the new schedule against existing
  for (const [normalizedNum, { day: newDay, entry: newEntry }] of newMap) {
    processedScenes.add(normalizedNum);
    const existing = existingMap.get(normalizedNum);

    if (!existing) {
      // New scene added to schedule
      allSceneChanges.push({
        sceneNumber: newEntry.sceneNumber,
        changeType: 'scene_added',
        description: `Scene ${newEntry.sceneNumber} added to Day ${newDay.dayNumber}`,
        newDay: newDay.dayNumber,
        newEntry,
      });
    } else {
      const { day: oldDay, entry: oldEntry } = existing;
      const sameDay = oldDay.dayNumber === newDay.dayNumber;

      // Check if scene moved to a different day
      if (!sameDay) {
        allSceneChanges.push({
          sceneNumber: newEntry.sceneNumber,
          changeType: 'scene_moved',
          description: `Scene ${newEntry.sceneNumber} moved from Day ${oldDay.dayNumber} to Day ${newDay.dayNumber}`,
          oldDay: oldDay.dayNumber,
          newDay: newDay.dayNumber,
          oldEntry,
          newEntry,
        });
      }

      // Check cast changes
      const castDiff = detectCastChanges(oldEntry, newEntry);
      if (castDiff) {
        const parts: string[] = [];
        if (castDiff.added.length > 0) parts.push(`${castDiff.added.length} cast added`);
        if (castDiff.removed.length > 0) parts.push(`${castDiff.removed.length} cast removed`);

        allSceneChanges.push({
          sceneNumber: newEntry.sceneNumber,
          changeType: 'cast_changed',
          description: `Scene ${newEntry.sceneNumber}: ${parts.join(', ')}`,
          oldDay: oldDay.dayNumber,
          newDay: newDay.dayNumber,
          oldEntry,
          newEntry,
          castAdded: castDiff.added,
          castRemoved: castDiff.removed,
        });
      }

      // Check timing changes (only for scenes staying on same day)
      if (sameDay && detectTimingChanges(oldEntry, newEntry, sameDay)) {
        const details: string[] = [];
        if ((oldEntry.estimatedTime || '') !== (newEntry.estimatedTime || '')) {
          details.push(`time: ${oldEntry.estimatedTime || 'none'} → ${newEntry.estimatedTime || 'none'}`);
        }
        if (oldEntry.shootOrder !== newEntry.shootOrder) {
          details.push(`order: ${oldEntry.shootOrder} → ${newEntry.shootOrder}`);
        }
        if ((oldEntry.pages || '') !== (newEntry.pages || '')) {
          details.push(`pages: ${oldEntry.pages || 'none'} → ${newEntry.pages || 'none'}`);
        }

        allSceneChanges.push({
          sceneNumber: newEntry.sceneNumber,
          changeType: 'timing_changed',
          description: `Scene ${newEntry.sceneNumber}: ${details.join(', ')}`,
          oldDay: oldDay.dayNumber,
          newDay: newDay.dayNumber,
          oldEntry,
          newEntry,
        });
      }
    }
  }

  // Check for removed scenes (in existing but not in new)
  for (const [normalizedNum, { day: oldDay, entry: oldEntry }] of existingMap) {
    if (!processedScenes.has(normalizedNum)) {
      allSceneChanges.push({
        sceneNumber: oldEntry.sceneNumber,
        changeType: 'scene_removed',
        description: `Scene ${oldEntry.sceneNumber} removed from Day ${oldDay.dayNumber}`,
        oldDay: oldDay.dayNumber,
        oldEntry,
      });
    }
  }

  // Check for new and removed days
  for (const day of newSchedule.days) {
    if (!existingDayNumbers.has(day.dayNumber)) {
      const daySceneChanges = allSceneChanges.filter(c => c.newDay === day.dayNumber);
      dayChanges.push({
        dayNumber: day.dayNumber,
        changeType: 'day_added',
        description: `Day ${day.dayNumber} added (${day.scenes.length} scene${day.scenes.length !== 1 ? 's' : ''})`,
        newDay: day,
        sceneChanges: daySceneChanges,
      });
    }
  }

  for (const day of existingSchedule.days) {
    if (!newDayNumbers.has(day.dayNumber)) {
      const daySceneChanges = allSceneChanges.filter(c => c.oldDay === day.dayNumber);
      dayChanges.push({
        dayNumber: day.dayNumber,
        changeType: 'day_removed',
        description: `Day ${day.dayNumber} removed (${day.scenes.length} scene${day.scenes.length !== 1 ? 's' : ''})`,
        oldDay: day,
        sceneChanges: daySceneChanges,
      });
    }
  }

  // Modified days (exist in both but have changes)
  for (const newDay of newSchedule.days) {
    if (existingDayNumbers.has(newDay.dayNumber)) {
      const daySceneChanges = allSceneChanges.filter(
        c => c.newDay === newDay.dayNumber || c.oldDay === newDay.dayNumber
      );
      if (daySceneChanges.length > 0) {
        const existingDay = existingSchedule.days.find(d => d.dayNumber === newDay.dayNumber);
        dayChanges.push({
          dayNumber: newDay.dayNumber,
          changeType: 'day_modified',
          description: `Day ${newDay.dayNumber}: ${daySceneChanges.length} change${daySceneChanges.length !== 1 ? 's' : ''}`,
          oldDay: existingDay,
          newDay: newDay,
          sceneChanges: daySceneChanges,
        });
      }
    }
  }

  // Sort day changes by day number
  dayChanges.sort((a, b) => a.dayNumber - b.dayNumber);

  // Categorize scene changes
  const addedScenes = allSceneChanges.filter(c => c.changeType === 'scene_added');
  const removedScenes = allSceneChanges.filter(c => c.changeType === 'scene_removed');
  const movedScenes = allSceneChanges.filter(c => c.changeType === 'scene_moved');
  const castChanges = allSceneChanges.filter(c => c.changeType === 'cast_changed');
  const timingChanges = allSceneChanges.filter(c => c.changeType === 'timing_changed');
  const addedDays = dayChanges.filter(c => c.changeType === 'day_added');
  const removedDays = dayChanges.filter(c => c.changeType === 'day_removed');

  // Generate summary
  const summaryParts: string[] = [];
  if (addedScenes.length > 0) summaryParts.push(`${addedScenes.length} scene${addedScenes.length > 1 ? 's' : ''} added`);
  if (removedScenes.length > 0) summaryParts.push(`${removedScenes.length} scene${removedScenes.length > 1 ? 's' : ''} removed`);
  if (movedScenes.length > 0) summaryParts.push(`${movedScenes.length} scene${movedScenes.length > 1 ? 's' : ''} moved`);
  if (castChanges.length > 0) summaryParts.push(`${castChanges.length} cast change${castChanges.length > 1 ? 's' : ''}`);
  if (timingChanges.length > 0) summaryParts.push(`${timingChanges.length} timing change${timingChanges.length > 1 ? 's' : ''}`);
  if (addedDays.length > 0) summaryParts.push(`${addedDays.length} day${addedDays.length > 1 ? 's' : ''} added`);
  if (removedDays.length > 0) summaryParts.push(`${removedDays.length} day${removedDays.length > 1 ? 's' : ''} removed`);

  const summary = summaryParts.length > 0
    ? summaryParts.join(', ')
    : 'No changes detected';

  const hasChanges = allSceneChanges.length > 0 || dayChanges.length > 0;

  return {
    dayChanges,
    allSceneChanges,
    addedScenes,
    removedScenes,
    movedScenes,
    castChanges,
    timingChanges,
    addedDays,
    removedDays,
    summary,
    hasChanges,
  };
}

/**
 * Apply schedule amendment - merges new schedule data into existing
 * while preserving any manually added data
 */
export function applyScheduleAmendment(
  existingSchedule: ProductionSchedule,
  newSchedule: ProductionSchedule,
  amendmentResult: ScheduleAmendmentResult,
  options: {
    includeAddedScenes?: boolean;
    includeRemovedScenes?: boolean;
    includeMovedScenes?: boolean;
    includeCastChanges?: boolean;
    includeTimingChanges?: boolean;
  } = {
    includeAddedScenes: true,
    includeRemovedScenes: true,
    includeMovedScenes: true,
    includeCastChanges: true,
    includeTimingChanges: true,
  }
): ProductionSchedule {
  // Start with a deep copy of the new schedule's days structure
  // but we selectively apply changes based on options
  const dayMap = new Map<number, ScheduleDay>();

  // Start with existing days
  for (const day of existingSchedule.days) {
    dayMap.set(day.dayNumber, { ...day, scenes: [...day.scenes] });
  }

  // Determine which scene changes to skip based on options
  const skipScenes = new Set<string>();

  if (!options.includeAddedScenes) {
    for (const change of amendmentResult.addedScenes) {
      skipScenes.add(normalizeSceneNumber(change.sceneNumber));
    }
  }

  if (!options.includeRemovedScenes) {
    for (const change of amendmentResult.removedScenes) {
      skipScenes.add(normalizeSceneNumber(change.sceneNumber));
    }
  }

  if (!options.includeMovedScenes) {
    for (const change of amendmentResult.movedScenes) {
      skipScenes.add(normalizeSceneNumber(change.sceneNumber));
    }
  }

  // Build a set of scenes that should keep old cast data
  const keepOldCast = new Set<string>();
  if (!options.includeCastChanges) {
    for (const change of amendmentResult.castChanges) {
      keepOldCast.add(normalizeSceneNumber(change.sceneNumber));
    }
  }

  // Build a set of scenes that should keep old timing data
  const keepOldTiming = new Set<string>();
  if (!options.includeTimingChanges) {
    for (const change of amendmentResult.timingChanges) {
      keepOldTiming.add(normalizeSceneNumber(change.sceneNumber));
    }
  }

  // Apply the new schedule structure
  // For each day in the new schedule, use the new data but respect skip/keep settings
  const existingSceneMap = buildSceneMap(existingSchedule);
  const resultDays: ScheduleDay[] = [];

  for (const newDay of newSchedule.days) {
    const scenes: ScheduleSceneEntry[] = [];

    for (const newScene of newDay.scenes) {
      const normalized = normalizeSceneNumber(newScene.sceneNumber);

      if (skipScenes.has(normalized)) {
        // If this is an added scene we're skipping, don't include it
        if (amendmentResult.addedScenes.some(c => normalizeSceneNumber(c.sceneNumber) === normalized)) {
          continue;
        }
      }

      const existing = existingSceneMap.get(normalized);
      let finalScene = { ...newScene };

      // Preserve old cast if option disabled
      if (keepOldCast.has(normalized) && existing) {
        finalScene.castNumbers = [...existing.entry.castNumbers];
      }

      // Preserve old timing if option disabled
      if (keepOldTiming.has(normalized) && existing) {
        finalScene.estimatedTime = existing.entry.estimatedTime;
        finalScene.shootOrder = existing.entry.shootOrder;
        finalScene.pages = existing.entry.pages;
      }

      scenes.push(finalScene);
    }

    // If we're not removing scenes, add back any existing scenes from this day
    // that were removed in the new schedule
    if (!options.includeRemovedScenes) {
      const existingDay = existingSchedule.days.find(d => d.dayNumber === newDay.dayNumber);
      if (existingDay) {
        for (const existingScene of existingDay.scenes) {
          const normalized = normalizeSceneNumber(existingScene.sceneNumber);
          if (!newSchedule.days.some(d => d.scenes.some(s => normalizeSceneNumber(s.sceneNumber) === normalized))) {
            scenes.push({ ...existingScene });
          }
        }
      }
    }

    resultDays.push({
      ...newDay,
      scenes,
    });
  }

  // If not including removed scenes, keep old days that were removed
  if (!options.includeRemovedScenes) {
    for (const oldDay of existingSchedule.days) {
      if (!newSchedule.days.some(d => d.dayNumber === oldDay.dayNumber)) {
        resultDays.push({ ...oldDay, scenes: [...oldDay.scenes] });
      }
    }
  }

  // Sort days by number
  resultDays.sort((a, b) => a.dayNumber - b.dayNumber);

  return {
    ...newSchedule,
    days: resultDays,
    // Preserve processing status from new schedule
    status: newSchedule.status,
    // Merge cast lists (use new, but preserve any extras from old)
    castList: mergecastLists(existingSchedule.castList, newSchedule.castList),
  };
}

/**
 * Merge cast lists - use new list as base, preserve any extras from old
 */
function mergecastLists(
  oldList: ScheduleCastMember[],
  newList: ScheduleCastMember[]
): ScheduleCastMember[] {
  const merged = [...newList];
  const newNumbers = new Set(newList.map(c => c.number));

  // Add any cast members from old list that aren't in new
  for (const oldMember of oldList) {
    if (!newNumbers.has(oldMember.number)) {
      merged.push(oldMember);
    }
  }

  return merged.sort((a, b) => a.number - b.number);
}
