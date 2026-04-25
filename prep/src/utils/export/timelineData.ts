/**
 * Pure data extractor for the Timeline (shooting schedule) export.
 *
 * Reads from the per-project schedule store via `getState()` so the
 * module can be called from a non-React context (the ToolsMenu
 * callback on the Script page).
 */

import {
  useScheduleStore,
  type ProductionSchedule,
  type ScheduleCastMember,
  type ScheduleDay,
} from '@/stores/scheduleStore';
import { useProjectStore } from '@/stores/projectStore';

export interface TimelineExportMeta {
  projectName: string;
  productionName?: string;
  scriptVersion?: string;
  scheduleVersion?: string;
  generatedAt: Date;
  totalDays: number;
  totalScenes: number;
  castCount: number;
  /** False when the project has no uploaded schedule yet. */
  hasSchedule: boolean;
}

export interface TimelineExportPayload {
  meta: TimelineExportMeta;
  castList: ScheduleCastMember[];
  days: ScheduleDay[];
  /** Flat row layout for the XLSX sheet — one row per scene-on-day. */
  flatHeaders: string[];
  flatRows: (string | number)[][];
}

const FLAT_HEADERS = [
  'Day',
  'Date',
  'Day of Week',
  'Day Location',
  'Scene',
  'INT/EXT',
  'Day/Night',
  'Set Location',
  'Pages',
  'Cast',
  'Description',
];

function buildFlatRows(schedule: ProductionSchedule): (string | number)[][] {
  const rows: (string | number)[][] = [];
  for (const day of schedule.days) {
    if (day.scenes.length === 0) {
      rows.push([
        day.dayNumber,
        day.date || '',
        day.dayOfWeek || '',
        day.location || '',
        '', '', '', '', '', '', '',
      ]);
      continue;
    }
    for (const scene of day.scenes) {
      rows.push([
        day.dayNumber,
        day.date || '',
        day.dayOfWeek || '',
        day.location || '',
        scene.sceneNumber,
        scene.intExt,
        scene.dayNight,
        scene.setLocation || '',
        scene.pages || '',
        scene.castNumbers.join(', '),
        scene.description || '',
      ]);
    }
  }
  return rows;
}

export function buildTimelineExport(projectId: string): TimelineExportPayload {
  const project = useProjectStore.getState().getProject(projectId);
  const schedule = useScheduleStore(projectId).getState().current;

  const projectName = project?.title || 'Untitled Project';

  if (!schedule) {
    return {
      meta: {
        projectName,
        generatedAt: new Date(),
        totalDays: 0,
        totalScenes: 0,
        castCount: 0,
        hasSchedule: false,
      },
      castList: [],
      days: [],
      flatHeaders: FLAT_HEADERS,
      flatRows: [],
    };
  }

  const totalScenes = schedule.days.reduce((sum, d) => sum + d.scenes.length, 0);

  return {
    meta: {
      projectName,
      productionName: schedule.productionName,
      scriptVersion: schedule.scriptVersion,
      scheduleVersion: schedule.scheduleVersion,
      generatedAt: new Date(),
      totalDays: schedule.totalDays || schedule.days.length,
      totalScenes,
      castCount: schedule.castList.length,
      hasSchedule: true,
    },
    castList: schedule.castList,
    days: schedule.days,
    flatHeaders: FLAT_HEADERS,
    flatRows: buildFlatRows(schedule),
  };
}
