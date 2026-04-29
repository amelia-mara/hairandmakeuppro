/**
 * Schedule Stage 2 — REGEX-BASED scene extraction (no AI).
 *
 * Originally this file called Claude per-shoot-day to parse the
 * scene rows. We've replaced that with the regex/state-machine
 * walker the prep app uses (extractDays in scheduleParser.ts) so:
 *
 *   - No /api/ai roundtrip → instant Stage 2
 *   - No ANTHROPIC_API_KEY required to use the schedule feature
 *   - Mobile and prep interpret the same PDF identically, so a
 *     schedule uploaded on either side flows through cleanly
 *
 * The function signature is preserved (processScheduleStage2 still
 * takes a ProductionSchedule + onProgress and returns
 * { days: ScheduleDay[] }) so the existing scheduleStore wiring,
 * UI progress bar, and amendment flow all keep working unchanged.
 */

import type {
  ProductionSchedule,
  ScheduleDay,
} from '@/types';
import { extractDays } from '@/utils/scheduleParser';

interface Stage2Progress {
  current: number;
  total: number;
  message?: string;
}

interface Stage2Result {
  days: ScheduleDay[];
}

export async function processScheduleStage2(
  schedule: ProductionSchedule,
  onProgress?: (progress: Stage2Progress) => void,
): Promise<Stage2Result> {
  const rawText = schedule.rawText;
  if (!rawText) {
    throw new Error('No raw text available for processing. Please re-upload the schedule.');
  }

  const total = schedule.totalDays || 1;
  onProgress?.({ current: 0, total, message: 'Reading schedule…' });

  const days = extractDays(rawText);

  onProgress?.({ current: days.length, total: Math.max(total, days.length), message: 'Done' });
  return { days };
}
