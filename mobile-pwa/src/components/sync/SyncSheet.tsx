import { useState, useEffect, useRef } from 'react';
import { useSyncStore } from '@/stores/syncStore';
import { useProjectStore } from '@/stores/projectStore';
import { uploadToServer, downloadFromServer } from '@/services/manualSync';

/**
 * Sync bottom sheet — slides up from the bottom when opened.
 *
 * States:
 * - All synced: checkmark + "Everything synced" + last sync time
 * - Has uploads: "X changes to upload" + gold Upload button
 * - Syncing: button shows "Uploading..." / "Downloading..." with progress
 * - Offline: "You're offline" message
 */
export function SyncSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const {
    status,
    lastUploadedAt,
    lastDownloadedAt,
    pendingChanges,
    isOnline,
    error,
    progress,
  } = useSyncStore();
  const currentProject = useProjectStore((s) => s.currentProject);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Force re-render every 30s for "X ago" text
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setTick(t => t + 1), 30000);
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
        { duration: 300, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
      );
    }
  }, [isOpen]);

  if (!isOpen || !currentProject) return null;

  const pendingCount = pendingChanges.size;
  const isBusy = status === 'uploading' || status === 'downloading' || isUploading || isDownloading;
  const isSynced = pendingCount === 0 && !isBusy && !error;

  const handleUpload = async () => {
    if (isBusy || !isOnline) return;
    setIsUploading(true);
    try {
      await uploadToServer();
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async () => {
    if (isBusy || !isOnline) return;
    setIsDownloading(true);
    try {
      await downloadFromServer();
    } finally {
      setIsDownloading(false);
    }
  };

  const handleClose = () => {
    if (sheetRef.current) {
      const anim = sheetRef.current.animate(
        [
          { transform: 'translateY(0)' },
          { transform: 'translateY(100%)' },
        ],
        { duration: 200, easing: 'ease-in', fill: 'forwards' }
      );
      anim.onfinish = onClose;
    } else {
      onClose();
    }
  };

  const lastSync = lastUploadedAt && lastDownloadedAt
    ? (lastUploadedAt > lastDownloadedAt ? lastUploadedAt : lastDownloadedAt)
    : lastUploadedAt || lastDownloadedAt;

  return (
    <div className="fixed inset-0 z-50" onClick={handleClose}>
      {/* Backdrop — fades in */}
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
          {/* Title */}
          <h2 className="text-lg font-bold text-text-primary text-center mb-6">Sync</h2>

          {/* Error */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3 mb-5 text-center">
              {error}
            </div>
          )}

          {/* Progress bar */}
          {isBusy && progress > 0 && (
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-5">
              <div
                className="bg-gold h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {isSynced ? (
            /* ── All synced ─────────────────────────────── */
            <div className="text-center py-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-success/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-text-primary">Everything synced</p>
              {lastSync && (
                <p className="text-xs text-text-muted mt-1">Last sync: {getTimeAgo(lastSync)}</p>
              )}
            </div>
          ) : (
            /* ── Has changes / is busy ──────────────────── */
            <div className="space-y-5">
              {/* Upload section */}
              {pendingCount > 0 && (
                <div className="text-center">
                  <p className="text-sm text-text-secondary mb-3">
                    {pendingCount} {pendingCount === 1 ? 'change' : 'changes'} to upload
                  </p>
                  <button
                    onClick={handleUpload}
                    disabled={isBusy || !isOnline}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
                      isBusy || !isOnline
                        ? 'bg-gray-100 text-gray-400'
                        : 'gold-gradient text-white shadow-sm active:scale-[0.98]'
                    }`}
                  >
                    {isUploading
                      ? `Uploading${progress > 0 ? ` ${progress}%` : '...'}`
                      : 'Upload Changes'}
                  </button>
                </div>
              )}

              {/* Divider */}
              {pendingCount > 0 && (
                <div className="border-t border-border" />
              )}

              {/* Download section */}
              <div className="text-center">
                <button
                  onClick={handleDownload}
                  disabled={isBusy || !isOnline}
                  className={`text-sm font-medium transition-colors ${
                    isBusy || !isOnline
                      ? 'text-gray-400'
                      : 'text-gold active:text-gold/70'
                  }`}
                >
                  {isDownloading
                    ? `Downloading${progress > 0 ? ` ${progress}%` : '...'}`
                    : 'Download from server'}
                </button>
              </div>

              {/* Last sync */}
              {lastSync && (
                <p className="text-xs text-text-muted text-center">
                  Last sync: {getTimeAgo(lastSync)}
                </p>
              )}
            </div>
          )}

          {/* Offline notice */}
          {!isOnline && (
            <p className="text-xs text-text-muted text-center mt-4">
              You're offline. Changes will be saved locally.
            </p>
          )}
        </div>
      </div>
    </div>
  );
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
