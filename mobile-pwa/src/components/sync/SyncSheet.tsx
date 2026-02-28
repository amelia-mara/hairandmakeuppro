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
 * - Empty project: warning + Download button always visible
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
  const [downloadResult, setDownloadResult] = useState<'success' | 'empty' | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Force re-render every 30s for "X ago" text
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isOpen) return;
    setDownloadResult(null);
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

  // Detect if the project is essentially empty (no scenes loaded)
  const projectIsEmpty = currentProject.scenes.length === 0;

  const handleUpload = async () => {
    if (isBusy || !isOnline) return;
    setIsUploading(true);
    setDownloadResult(null);
    try {
      await uploadToServer();
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async () => {
    if (isBusy || !isOnline) return;
    setIsDownloading(true);
    setDownloadResult(null);
    try {
      const beforeScenes = useProjectStore.getState().currentProject?.scenes.length ?? 0;
      await downloadFromServer();
      const afterScenes = useProjectStore.getState().currentProject?.scenes.length ?? 0;
      // Let user know if download brought back data or not
      if (afterScenes > beforeScenes) {
        setDownloadResult('success');
      } else if (afterScenes === 0) {
        setDownloadResult('empty');
      }
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

          {/* Download result feedback */}
          {downloadResult === 'empty' && (
            <div className="text-sm text-text-muted bg-gray-50 rounded-xl px-4 py-3 mb-5 text-center">
              No data found on server for this project.
            </div>
          )}
          {downloadResult === 'success' && (
            <div className="text-sm text-success bg-success/10 rounded-xl px-4 py-3 mb-5 text-center">
              Data downloaded successfully.
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

          {/* Empty project warning */}
          {projectIsEmpty && isSynced && downloadResult !== 'success' && (
            <div className="text-center py-2 mb-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-warning/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-text-primary">Project is empty</p>
              <p className="text-xs text-text-muted mt-1">
                Try downloading from the server, or upload a script in the More tab.
              </p>
            </div>
          )}

          {/* Synced state (only when project has data) */}
          {isSynced && !projectIsEmpty && (
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
          )}

          {/* Upload section — when there are pending changes */}
          {pendingCount > 0 && (
            <div className="text-center mb-5">
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

          {/* Divider before download — only if upload section is shown */}
          {pendingCount > 0 && (
            <div className="border-t border-border mb-5" />
          )}

          {/* Download section — ALWAYS visible */}
          <div className="text-center">
            <button
              onClick={handleDownload}
              disabled={isBusy || !isOnline}
              className={`text-sm font-medium transition-colors ${
                isBusy || !isOnline
                  ? 'text-gray-400'
                  : projectIsEmpty
                    ? 'text-gold font-semibold active:text-gold/70'
                    : 'text-gold active:text-gold/70'
              }`}
            >
              {isDownloading
                ? `Downloading${progress > 0 ? ` ${progress}%` : '...'}`
                : 'Download from server'}
            </button>
          </div>

          {/* Last sync */}
          {lastSync && !projectIsEmpty && (
            <p className="text-xs text-text-muted text-center mt-4">
              Last sync: {getTimeAgo(lastSync)}
            </p>
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
