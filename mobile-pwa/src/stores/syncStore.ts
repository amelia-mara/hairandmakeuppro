/**
 * Manual Sync Store
 *
 * Tracks pending local changes and sync status for the manual upload/download model.
 * Replaces the old auto-sync store with explicit user-triggered sync actions.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SyncStatus = 'idle' | 'uploading' | 'downloading' | 'synced' | 'error' | 'offline';

/** Categories of data that can have pending changes */
export type ChangeCategory =
  | 'scenes'
  | 'characters'
  | 'looks'
  | 'schedule'
  | 'callSheets'
  | 'script'
  | 'captures';

interface SyncState {
  status: SyncStatus;
  lastUploadedAt: Date | null;
  lastDownloadedAt: Date | null;
  error: string | null;
  /** Which categories have unsaved local changes */
  pendingChanges: Set<ChangeCategory>;
  /** Whether the device is online */
  isOnline: boolean;
  /** Progress during upload/download (0-100) */
  progress: number;
  /** Whether the sync panel is open */
  isPanelOpen: boolean;

  // Actions
  markChanged: (category: ChangeCategory) => void;
  markMultipleChanged: (categories: ChangeCategory[]) => void;
  clearChanges: () => void;
  clearCategory: (category: ChangeCategory) => void;
  setUploading: () => void;
  setDownloading: () => void;
  setUploaded: () => void;
  setDownloaded: () => void;
  setError: (error: string) => void;
  setOnline: (online: boolean) => void;
  setProgress: (progress: number) => void;
  setIdle: () => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  reset: () => void;
  hasPendingChanges: () => boolean;
  getPendingCount: () => number;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      lastUploadedAt: null,
      lastDownloadedAt: null,
      error: null,
      pendingChanges: new Set<ChangeCategory>(),
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      progress: 0,
      isPanelOpen: false,

      markChanged: (category) =>
        set((s) => {
          const next = new Set(s.pendingChanges);
          next.add(category);
          return { pendingChanges: next };
        }),

      markMultipleChanged: (categories) =>
        set((s) => {
          const next = new Set(s.pendingChanges);
          for (const c of categories) next.add(c);
          return { pendingChanges: next };
        }),

      clearChanges: () => set({ pendingChanges: new Set() }),

      clearCategory: (category) =>
        set((s) => {
          const next = new Set(s.pendingChanges);
          next.delete(category);
          return { pendingChanges: next };
        }),

      setUploading: () => set({ status: 'uploading', error: null, progress: 0 }),
      setDownloading: () => set({ status: 'downloading', error: null, progress: 0 }),
      setUploaded: () => set({ status: 'synced', lastUploadedAt: new Date(), error: null, progress: 100 }),
      setDownloaded: () => set({ status: 'synced', lastDownloadedAt: new Date(), error: null, progress: 100 }),
      setError: (error) => set({ status: 'error', error, progress: 0 }),
      setOnline: (online) => set({ isOnline: online }),
      setProgress: (progress) => set({ progress }),
      setIdle: () => set({ status: 'idle', error: null, progress: 0 }),
      togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),
      openPanel: () => set({ isPanelOpen: true }),
      closePanel: () => set({ isPanelOpen: false }),

      reset: () =>
        set({
          status: 'idle',
          lastUploadedAt: null,
          lastDownloadedAt: null,
          error: null,
          pendingChanges: new Set(),
          progress: 0,
          isPanelOpen: false,
        }),

      hasPendingChanges: () => get().pendingChanges.size > 0,
      getPendingCount: () => get().pendingChanges.size,
    }),
    {
      name: 'hair-makeup-sync',
      partialize: (state) => ({
        lastUploadedAt: state.lastUploadedAt,
        lastDownloadedAt: state.lastDownloadedAt,
        // Serialize Set as array for JSON storage
        pendingChanges: Array.from(state.pendingChanges),
      }),
      // Custom merge to rehydrate Set from persisted array
      merge: (persisted, current) => {
        const p = persisted as Record<string, unknown> | undefined;
        return {
          ...current,
          lastUploadedAt: p?.lastUploadedAt ? new Date(p.lastUploadedAt as string) : null,
          lastDownloadedAt: p?.lastDownloadedAt ? new Date(p.lastDownloadedAt as string) : null,
          pendingChanges: new Set(
            Array.isArray(p?.pendingChanges) ? (p.pendingChanges as ChangeCategory[]) : []
          ),
        };
      },
    }
  )
);
