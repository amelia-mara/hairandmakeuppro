import { useEffect, useRef } from 'react';
import { useSyncStore } from '@/stores/syncStore';

/**
 * Sync icon for the project header.
 *
 * States:
 * - All synced: grey icon, small green dot
 * - Has uploads: grey icon, gold badge with count (pulses on increase)
 * - Syncing: icon spins
 * - Offline: grey icon, red dot
 */
export function SyncIcon({ onClick }: { onClick: () => void }) {
  const { status, pendingChanges, isOnline } = useSyncStore();
  const pendingCount = pendingChanges.size;
  const isBusy = status === 'uploading' || status === 'downloading';
  const isSynced = pendingCount === 0 && !isBusy && status === 'synced';

  // Pulse animation when badge count increases
  const prevCount = useRef(pendingCount);
  const badgeRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (pendingCount > prevCount.current && badgeRef.current) {
      badgeRef.current.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.3)' },
          { transform: 'scale(1)' },
        ],
        { duration: 300, easing: 'ease-out' }
      );
    }
    prevCount.current = pendingCount;
  }, [pendingCount]);

  return (
    <button
      onClick={onClick}
      className="relative w-8 h-8 flex items-center justify-center active:scale-90 transition-transform"
      aria-label="Sync"
    >
      {/* Sync arrows icon */}
      <svg
        className={`w-[18px] h-[18px] ${
          !isOnline ? 'text-gray-300' :
          isBusy ? 'text-text-muted animate-spin' :
          'text-text-muted'
        }`}
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

      {/* Gold badge with count — pending uploads */}
      {pendingCount > 0 && !isBusy && isOnline && (
        <span
          ref={badgeRef}
          className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-gold text-white text-[10px] font-bold leading-none"
        >
          {pendingCount}
        </span>
      )}

      {/* Green dot — all synced */}
      {isSynced && isOnline && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-card" />
      )}

      {/* Red dot — offline */}
      {!isOnline && (
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-destructive border-2 border-card" />
      )}
    </button>
  );
}
