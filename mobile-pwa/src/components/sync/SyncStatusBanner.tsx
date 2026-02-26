import { useState, useEffect } from 'react';
import { useSyncStore, type SyncStatus } from '@/stores/syncStore';
import { useProjectStore } from '@/stores/projectStore';
import { pullProjectData, getActiveProjectId } from '@/services/syncService';

/** Persistent sync bar shown at the top of every project page.
 *  Tap to trigger a manual sync. */
export function SyncStatusBar() {
  const { status, onlineMembers, lastSyncedAt, pendingChanges } = useSyncStore();
  const currentProject = useProjectStore((s) => s.currentProject);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  // Force re-render every 30s to update "X ago" text
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  if (!currentProject) return null;

  const handleManualSync = async () => {
    if (isManualSyncing || status === 'syncing') return;
    setIsManualSyncing(true);
    try {
      const projectId = getActiveProjectId() || currentProject.id;
      await pullProjectData(projectId);
    } catch (err) {
      console.error('[ManualSync] Failed:', err);
    } finally {
      setIsManualSyncing(false);
    }
  };

  const isSyncing = status === 'syncing' || isManualSyncing;

  const config: Record<SyncStatus, { color: string; label: string; icon: string }> = {
    idle: { color: 'text-gray-400', label: 'Not connected', icon: 'idle' },
    syncing: { color: 'text-warning', label: 'Syncing...', icon: 'syncing' },
    synced: { color: 'text-success', label: 'Synced', icon: 'synced' },
    error: { color: 'text-destructive', label: 'Sync error — tap to retry', icon: 'error' },
    offline: { color: 'text-gray-400', label: 'Offline', icon: 'offline' },
  };

  const { color, label } = config[isSyncing ? 'syncing' : status];
  const timeAgo = lastSyncedAt ? getTimeAgo(lastSyncedAt) : null;

  return (
    <button
      onClick={handleManualSync}
      disabled={isSyncing}
      className="w-full bg-card/80 backdrop-blur-sm border-b border-border/50 active:bg-gray-50 transition-colors"
    >
      <div className="mobile-container">
        <div className="h-8 px-4 flex items-center justify-between">
          {/* Left: status + last synced */}
          <div className="flex items-center gap-2">
            {/* Status dot */}
            <div className={`w-1.5 h-1.5 rounded-full ${
              isSyncing ? 'bg-warning animate-pulse' :
              status === 'synced' ? 'bg-success' :
              status === 'error' ? 'bg-destructive' :
              'bg-gray-400'
            }`} />
            <span className={`text-[11px] font-medium ${color}`}>
              {isSyncing ? 'Syncing...' : label}
            </span>
            {timeAgo && !isSyncing && status === 'synced' && (
              <span className="text-[11px] text-text-light">{timeAgo}</span>
            )}
            {pendingChanges > 0 && !isSyncing && (
              <span className="text-[11px] text-warning">{pendingChanges} pending</span>
            )}
          </div>

          {/* Right: online members + sync icon */}
          <div className="flex items-center gap-2">
            {onlineMembers > 1 && (
              <span className="text-[11px] text-text-muted">
                {onlineMembers} online
              </span>
            )}
            {/* Sync/refresh icon */}
            <svg
              className={`w-3.5 h-3.5 text-text-muted ${isSyncing ? 'animate-spin' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </div>
        </div>
      </div>
    </button>
  );
}

/** Original card-style banner (kept for backwards compatibility) */
export function SyncStatusBanner() {
  const { status, onlineMembers, lastSyncedAt } = useSyncStore();

  const config: Record<SyncStatus, { color: string; label: string }> = {
    idle: { color: 'bg-gray-400', label: 'Not connected' },
    syncing: { color: 'bg-warning animate-pulse', label: 'Syncing...' },
    synced: { color: 'bg-success', label: 'Synced' },
    error: { color: 'bg-destructive', label: 'Sync error' },
    offline: { color: 'bg-gray-400', label: 'Working offline' },
  };

  const { color, label } = config[status];

  const timeAgo = lastSyncedAt ? getTimeAgo(lastSyncedAt) : null;

  return (
    <div className="bg-card rounded-[10px] px-4 py-3 mb-4 flex items-center justify-between shadow-card">
      <div className="flex items-center gap-2.5">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs text-text-secondary">{label}</span>
        {timeAgo && status === 'synced' && (
          <span className="text-xs text-text-muted">{timeAgo}</span>
        )}
      </div>
      {onlineMembers > 1 && (
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1">
            {Array.from({ length: Math.min(onlineMembers, 3) }).map((_, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded-full bg-gold/20 border border-card flex items-center justify-center"
              >
                <span className="text-[8px] text-gold font-medium">{i + 1}</span>
              </div>
            ))}
          </div>
          <span className="text-xs text-text-muted">
            {onlineMembers} online
          </span>
        </div>
      )}
    </div>
  );
}

/** Compact sync dot for headers */
export function SyncDot() {
  const { status } = useSyncStore();

  const colors: Record<SyncStatus, string> = {
    idle: 'bg-gray-400',
    syncing: 'bg-warning animate-pulse',
    synced: 'bg-success',
    error: 'bg-destructive',
    offline: 'bg-gray-400',
  };

  return <div className={`w-2 h-2 rounded-full ${colors[status]}`} />;
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
