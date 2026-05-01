import { useState, useEffect, useRef } from 'react';
import { useSyncStore } from '@/stores/syncStore';
import { useProjectStore } from '@/stores/projectStore';
import { flushAutoSave } from '@/services/autoSave';
import { resubscribeToProject } from '@/services/realtimeSync';
import { outboxService } from '@/services/outboxService';
import { OutboxDeadList } from '@/components/sync/OutboxDeadList';

/** Threshold below which transient network hiccups are ignored. */
const AUTO_SAVE_WARNING_THRESHOLD = 3;
/** Threshold at which the warning escalates from amber to terracotta. */
const AUTO_SAVE_SEVERE_THRESHOLD = 10;

/**
 * Sync bottom sheet.
 *
 * The Upload / Download buttons are gone — autoSave handles every
 * write in the background, the outbox handles failed writes, and
 * realtime keeps cross-client state in step. This sheet is now a
 * read-out of those background systems plus a single "Sync now"
 * action that flushes the autoSave debounce queue and the outbox.
 *
 * States surfaced (top to bottom, in priority order):
 *  - Realtime channel exhausted reconnect budget (terracotta)
 *  - Outbox dead entries (terracotta)
 *  - Outbox pending entries (amber)
 *  - 3+ consecutive autoSave failures (amber, escalates terracotta)
 *  - Offline notice
 *  - Last saved time / "Up to date"
 *  - "Sync now" button
 */
export function SyncSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const {
    isOnline,
    error,
    hasPendingOutbox,
    deadOutboxCount,
    autoSaveFailureCount,
    autoSaveLastError,
    realtimeDisconnected,
    lastSuccessfulSave,
  } = useSyncStore();
  const currentProject = useProjectStore((s) => s.currentProject);
  const [showDeadList, setShowDeadList] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Force re-render every 30s so "Last saved X ago" stays current.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Animate sheet in
  useEffect(() => {
    if (isOpen && sheetRef.current) {
      sheetRef.current.animate(
        [
          { transform: 'translateY(100%)' },
          { transform: 'translateY(0)' },
        ],
        { duration: 300, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' },
      );
    }
  }, [isOpen]);

  if (!isOpen || !currentProject) return null;

  const showAutoSaveWarning = autoSaveFailureCount >= AUTO_SAVE_WARNING_THRESHOLD;
  const isAutoSaveSevere = autoSaveFailureCount >= AUTO_SAVE_SEVERE_THRESHOLD;

  const handleSyncNow = async () => {
    if (isSyncing || !isOnline) return;
    setIsSyncing(true);
    try {
      // Flush the autoSave debounce queue so any pending edits are
      // written immediately, then drain the outbox so failed-write
      // retries from earlier are attempted now.
      await flushAutoSave();
      await outboxService.flushOutbox();
    } finally {
      // Refresh the outbox counts so the indicators reflect reality
      // after the flush.
      const [pending, dead] = await Promise.all([
        outboxService.getTotalPendingCount(),
        outboxService.getDeadCount(),
      ]);
      useSyncStore.getState().setHasPendingOutbox(pending > 0);
      useSyncStore.getState().setDeadOutboxCount(dead);
      setIsSyncing(false);
    }
  };

  const handleRetryAutoSave = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      await flushAutoSave();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleReconnectRealtime = async () => {
    if (isReconnecting || !currentProject) return;
    setIsReconnecting(true);
    try {
      // Tear down the dead channel and start fresh — also pulls a
      // full project snapshot so any events missed during the dead
      // window are reflected locally.
      await resubscribeToProject(currentProject.id);
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleClose = () => {
    if (sheetRef.current) {
      const anim = sheetRef.current.animate(
        [
          { transform: 'translateY(0)' },
          { transform: 'translateY(100%)' },
        ],
        { duration: 200, easing: 'ease-in', fill: 'forwards' },
      );
      anim.onfinish = onClose;
    } else {
      onClose();
    }
  };

  const lastSavedLabel = lastSuccessfulSave
    ? `Last saved ${formatTimeAgo(lastSuccessfulSave)}`
    : 'No saves yet this session';

  return (
    <div className="fixed inset-0 z-50" onClick={handleClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 animate-in fade-in duration-200" />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 inset-x-0 bg-card rounded-t-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="px-6 pb-8 pt-2">
          <h2 className="text-lg font-bold text-text-primary text-center mb-6">Sync</h2>

          {/* Generic transient error from manualSync (kept for backwards
              compatibility with the syncStore.error field). */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3 mb-3 text-center">
              {error}
            </div>
          )}

          {/* Realtime channel exhausted its reconnect budget. */}
          {realtimeDisconnected && (
            <button
              onClick={handleReconnectRealtime}
              disabled={isReconnecting || !isOnline}
              className="w-full text-sm text-left rounded-xl px-4 py-3 mb-3 flex items-center gap-3 transition-colors active:opacity-80 disabled:opacity-60"
              style={{ backgroundColor: 'rgba(196, 82, 42, 0.1)', color: '#C4522A' }}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="font-medium">Live sync disconnected</div>
                <div className="text-xs opacity-80 mt-0.5">
                  {isReconnecting ? 'Reconnecting…' : 'Tap to reconnect and refresh your data'}
                </div>
              </div>
            </button>
          )}

          {/* Outbox: dead entries — needs user attention */}
          {deadOutboxCount > 0 && (
            <button
              onClick={() => setShowDeadList(true)}
              className="w-full text-sm text-left rounded-xl px-4 py-3 mb-3 flex items-center gap-3 transition-colors active:opacity-80"
              style={{ backgroundColor: 'rgba(196, 82, 42, 0.1)', color: '#C4522A' }}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span className="flex-1 font-medium">
                {deadOutboxCount} {deadOutboxCount === 1 ? 'capture' : 'captures'} could not be saved. Tap to review.
              </span>
            </button>
          )}

          {/* Outbox: pending entries — data safe locally, syncing in background */}
          {hasPendingOutbox && deadOutboxCount === 0 && (
            <div className="text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3 mb-3 flex items-center gap-3">
              <svg className="w-4 h-4 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.667 0l3.181-3.183m-4.991-2.696a8.25 8.25 0 00-11.667 0l-3.181 3.183" />
              </svg>
              <span className="flex-1">Some data is waiting to sync</span>
            </div>
          )}

          {/* AutoSave: 3+ consecutive failures across any category. */}
          {showAutoSaveWarning && (
            <div
              className="text-sm rounded-xl px-4 py-3 mb-3"
              style={
                isAutoSaveSevere
                  ? { backgroundColor: 'rgba(196, 82, 42, 0.1)', color: '#C4522A' }
                  : { backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#92400E' }
              }
            >
              <div className="flex items-start gap-3">
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">Having trouble saving changes</div>
                  <div className="text-xs opacity-80 mt-0.5">
                    Your edits are stored on your device.
                  </div>
                  {autoSaveLastError && (
                    <div className="text-[11px] opacity-70 mt-1 break-words">
                      {autoSaveLastError}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleRetryAutoSave}
                  disabled={isRetrying || !isOnline}
                  className="text-xs font-semibold underline disabled:opacity-50"
                >
                  {isRetrying ? 'Retrying...' : 'Retry now'}
                </button>
              </div>
            </div>
          )}

          {/* Last saved status — only shown when no warnings are active.
              Warnings already explain the sync state, so duplicating
              "Last saved" alongside them is noise. */}
          {!realtimeDisconnected && deadOutboxCount === 0 && !showAutoSaveWarning && (
            <div className="text-center py-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-success/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-text-primary">Up to date</p>
              <p className="text-xs text-text-muted mt-1">{lastSavedLabel}</p>
            </div>
          )}

          {/* Single action — flush the autoSave debounce + drain the
              outbox. No more delete-all upload or destructive download. */}
          <button
            onClick={handleSyncNow}
            disabled={isSyncing || !isOnline}
            className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
              isSyncing || !isOnline
                ? 'bg-gray-100 text-gray-400'
                : 'gold-gradient text-white shadow-sm active:scale-[0.98]'
            }`}
          >
            {isSyncing ? 'Syncing…' : 'Sync now'}
          </button>

          {/* Offline notice */}
          {!isOnline && (
            <p className="text-xs text-text-muted text-center mt-4">
              You're offline. Changes will be saved locally.
            </p>
          )}
        </div>
      </div>

      {/* Dead-outbox review modal */}
      {showDeadList && (
        <OutboxDeadList onClose={() => setShowDeadList(false)} />
      )}
    </div>
  );
}

function formatTimeAgo(epochMs: number): string {
  const seconds = Math.floor((Date.now() - epochMs) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
