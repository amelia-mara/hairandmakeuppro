import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* ── Types (ported from mobile-pwa) ── */

export type ScheduleStatus = 'pending' | 'processing' | 'complete' | 'partial';

export interface ScheduleCastMember {
  number: number;
  name: string;
  character?: string;
}

export interface ScheduleSceneEntry {
  sceneNumber: string;
  pages?: string;
  intExt: 'INT' | 'EXT';
  dayNight: string;
  setLocation: string;
  description?: string;
  castNumbers: number[];
  estimatedTime?: string;
  shootOrder: number;
}

export interface ScheduleDay {
  dayNumber: number;
  date?: string;
  dayOfWeek?: string;
  location: string;
  hours?: string;
  dayType?: string;
  sunrise?: string;
  sunset?: string;
  notes?: string[];
  scenes: ScheduleSceneEntry[];
  totalPages?: string;
}

export interface ProductionSchedule {
  id: string;
  productionName?: string;
  scriptVersion?: string;
  scheduleVersion?: string;
  status: ScheduleStatus;
  castList: ScheduleCastMember[];
  days: ScheduleDay[];
  totalDays: number;
  uploadedAt: string;
  pdfUri?: string;
  rawText?: string;
}

export interface ScheduleVersion {
  id: string;
  schedule: ProductionSchedule;
  uploadedAt: string;
  label: string;
}

interface ScheduleState {
  /** Current active schedule */
  current: ProductionSchedule | null;
  /** Previous versions (newest first) */
  versions: ScheduleVersion[];
  /** Loading flag */
  isUploading: boolean;
  uploadError: string | null;

  upload: (schedule: ProductionSchedule) => void;
  clear: () => void;
}

const storeCache = new Map<string, ReturnType<typeof createStore>>();

function createStore(projectId: string) {
  return create<ScheduleState>()(
    persist(
      (set, get) => ({
        current: null,
        versions: [],
        isUploading: false,
        uploadError: null,

        upload: (schedule) => {
          const state = get();
          const versions = [...state.versions];

          // Archive the current schedule as a previous version
          if (state.current) {
            versions.unshift({
              id: state.current.id,
              schedule: state.current,
              uploadedAt: state.current.uploadedAt,
              label: `v${versions.length + 1} — ${formatShort(state.current.uploadedAt)}`,
            });
          }

          set({ current: schedule, versions, isUploading: false, uploadError: null });
        },

        clear: () =>
          set({ current: null, isUploading: false, uploadError: null }),
      }),
      { name: `prep-schedule-${projectId}` },
    ),
  );
}

function formatShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function useScheduleStore(projectId: string) {
  if (!storeCache.has(projectId)) {
    storeCache.set(projectId, createStore(projectId));
  }
  return storeCache.get(projectId)!;
}
