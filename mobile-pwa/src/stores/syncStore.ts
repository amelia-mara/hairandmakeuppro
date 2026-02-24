import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: Date | null;
  pendingChanges: number;
  error: string | null;
  /** ID of the project currently being synced */
  activeProjectId: string | null;
  /** Track whether realtime subscriptions are active */
  realtimeConnected: boolean;
  /** Number of team members currently online (from presence) */
  onlineMembers: number;

  // Actions
  setStatus: (status: SyncStatus) => void;
  setSynced: () => void;
  setSyncing: () => void;
  setError: (error: string) => void;
  setOffline: () => void;
  setActiveProject: (projectId: string | null) => void;
  setRealtimeConnected: (connected: boolean) => void;
  setOnlineMembers: (count: number) => void;
  incrementPending: () => void;
  decrementPending: () => void;
  clearPending: () => void;
  reset: () => void;
}

export const useSyncStore = create<SyncState>()((set) => ({
  status: 'idle',
  lastSyncedAt: null,
  pendingChanges: 0,
  error: null,
  activeProjectId: null,
  realtimeConnected: false,
  onlineMembers: 0,

  setStatus: (status) => set({ status, error: status === 'error' ? undefined : null }),
  setSynced: () => set({ status: 'synced', lastSyncedAt: new Date(), error: null }),
  setSyncing: () => set({ status: 'syncing', error: null }),
  setError: (error) => set({ status: 'error', error }),
  setOffline: () => set({ status: 'offline' }),
  setActiveProject: (projectId) => set({ activeProjectId: projectId }),
  setRealtimeConnected: (connected) => set({ realtimeConnected: connected }),
  setOnlineMembers: (count) => set({ onlineMembers: count }),
  incrementPending: () => set((s) => ({ pendingChanges: s.pendingChanges + 1 })),
  decrementPending: () => set((s) => ({ pendingChanges: Math.max(0, s.pendingChanges - 1) })),
  clearPending: () => set({ pendingChanges: 0 }),
  reset: () => set({
    status: 'idle',
    lastSyncedAt: null,
    pendingChanges: 0,
    error: null,
    activeProjectId: null,
    realtimeConnected: false,
    onlineMembers: 0,
  }),
}));
