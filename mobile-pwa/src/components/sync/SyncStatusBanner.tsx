import { useSyncStore, type SyncStatus } from '@/stores/syncStore';

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
