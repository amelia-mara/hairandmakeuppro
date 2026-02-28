import { useState } from 'react';
import { useSyncStore, type ChangeCategory } from '@/stores/syncStore';
import { useProjectStore } from '@/stores/projectStore';
import { uploadToServer, downloadFromServer } from '@/services/manualSync';

const CATEGORY_LABELS: Record<ChangeCategory, string> = {
  scenes: 'Scenes',
  characters: 'Characters',
  looks: 'Looks',
  schedule: 'Schedule',
  callSheets: 'Call Sheets',
  script: 'Script',
  captures: 'Continuity',
};

/** Persistent sync bar shown at the top of every project page.
 *  Shows pending changes and manual upload/download buttons. */
export function SyncStatusBar() {
  const {
    status,
    lastUploadedAt,
    lastDownloadedAt,
    pendingChanges,
    isOnline,
    error,
    progress,
    isPanelOpen,
    togglePanel,
    closePanel,
  } = useSyncStore();
  const currentProject = useProjectStore((s) => s.currentProject);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!currentProject) return null;

  const hasPending = pendingChanges.size > 0;
  const isBusy = status === 'uploading' || status === 'downloading' || isUploading || isDownloading;

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

  // Status display
  const getStatusInfo = (): { color: string; label: string } => {
    if (!isOnline) return { color: 'text-gray-400', label: 'Offline' };
    if (isBusy) {
      if (status === 'uploading' || isUploading) return { color: 'text-warning', label: `Uploading${progress > 0 ? ` ${progress}%` : '...'}` };
      return { color: 'text-warning', label: `Downloading${progress > 0 ? ` ${progress}%` : '...'}` };
    }
    if (error) return { color: 'text-destructive', label: 'Sync error' };
    if (hasPending) return { color: 'text-warning', label: `${pendingChanges.size} unsaved` };
    if (status === 'synced') return { color: 'text-success', label: 'Saved' };
    return { color: 'text-gray-400', label: 'Ready' };
  };

  const { color, label } = getStatusInfo();
  const lastSync = lastUploadedAt || lastDownloadedAt;
  const timeAgo = lastSync ? getTimeAgo(lastSync) : null;

  return (
    <>
      <button
        onClick={togglePanel}
        className="w-full bg-card/80 backdrop-blur-sm border-b border-border/50 active:bg-gray-50 transition-colors"
      >
        <div className="mobile-container">
          <div className="h-8 px-4 flex items-center justify-between">
            {/* Left: status */}
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${
                !isOnline ? 'bg-gray-400' :
                isBusy ? 'bg-warning animate-pulse' :
                error ? 'bg-destructive' :
                hasPending ? 'bg-warning' :
                status === 'synced' ? 'bg-success' :
                'bg-gray-400'
              }`} />
              <span className={`text-[11px] font-medium ${color}`}>{label}</span>
              {timeAgo && !isBusy && status === 'synced' && (
                <span className="text-[11px] text-text-light">{timeAgo}</span>
              )}
            </div>

            {/* Right: chevron */}
            <svg
              className={`w-3 h-3 text-text-muted transition-transform ${isPanelOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </button>

      {/* Expandable sync panel */}
      {isPanelOpen && (
        <div className="bg-card border-b border-border shadow-sm">
          <div className="mobile-container px-4 py-3 space-y-3">
            {/* Error message */}
            {error && (
              <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {/* Pending changes list */}
            {hasPending && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-text-muted uppercase tracking-wide">
                  Unsaved changes
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(pendingChanges).map((category) => (
                    <span
                      key={category}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium"
                    >
                      {CATEGORY_LABELS[category]}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Progress bar */}
            {isBusy && progress > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-1">
                <div
                  className="bg-gold h-1 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            {/* Upload/Download buttons */}
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUpload();
                }}
                disabled={isBusy || !isOnline}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isBusy || !isOnline
                    ? 'bg-gray-100 text-gray-400'
                    : hasPending
                      ? 'gold-gradient text-white shadow-sm active:scale-[0.98]'
                      : 'bg-gray-100 text-text-secondary active:bg-gray-200'
                }`}
              >
                <svg className={`w-3.5 h-3.5 ${isUploading ? 'animate-bounce' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 16 12 12 8 16" />
                  <line x1="12" y1="12" x2="12" y2="21" />
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                </svg>
                {isUploading ? 'Uploading...' : 'Upload'}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                disabled={isBusy || !isOnline}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isBusy || !isOnline
                    ? 'bg-gray-100 text-gray-400'
                    : 'bg-gray-100 text-text-secondary active:bg-gray-200'
                }`}
              >
                <svg className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="8 17 12 21 16 17" />
                  <line x1="12" y1="12" x2="12" y2="21" />
                  <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                </svg>
                {isDownloading ? 'Downloading...' : 'Download'}
              </button>
            </div>

            {/* Last sync info */}
            {(lastUploadedAt || lastDownloadedAt) && (
              <div className="flex justify-between text-[10px] text-text-light">
                {lastUploadedAt && (
                  <span>Last uploaded: {getTimeAgo(lastUploadedAt)}</span>
                )}
                {lastDownloadedAt && (
                  <span>Last downloaded: {getTimeAgo(lastDownloadedAt)}</span>
                )}
              </div>
            )}

            {/* Close panel button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closePanel();
              }}
              className="w-full text-center text-[11px] text-text-muted py-1"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Compact sync dot for headers */
export function SyncDot() {
  const { status, pendingChanges, isOnline } = useSyncStore();

  const getColor = () => {
    if (!isOnline) return 'bg-gray-400';
    if (status === 'uploading' || status === 'downloading') return 'bg-warning animate-pulse';
    if (status === 'error') return 'bg-destructive';
    if (pendingChanges.size > 0) return 'bg-warning';
    if (status === 'synced') return 'bg-success';
    return 'bg-gray-400';
  };

  return <div className={`w-2 h-2 rounded-full ${getColor()}`} />;
}

/** Original card-style banner (kept for backwards compatibility) */
export function SyncStatusBanner() {
  const { status, pendingChanges, isOnline } = useSyncStore();

  const getStatusInfo = () => {
    if (!isOnline) return { color: 'bg-gray-400', label: 'Offline' };
    if (status === 'uploading') return { color: 'bg-warning animate-pulse', label: 'Uploading...' };
    if (status === 'downloading') return { color: 'bg-warning animate-pulse', label: 'Downloading...' };
    if (status === 'error') return { color: 'bg-destructive', label: 'Sync error' };
    if (pendingChanges.size > 0) return { color: 'bg-warning', label: `${pendingChanges.size} unsaved` };
    if (status === 'synced') return { color: 'bg-success', label: 'Saved' };
    return { color: 'bg-gray-400', label: 'Ready' };
  };

  const { color, label } = getStatusInfo();

  return (
    <div className="bg-card rounded-[10px] px-4 py-3 mb-4 flex items-center justify-between shadow-card">
      <div className="flex items-center gap-2.5">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs text-text-secondary">{label}</span>
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
