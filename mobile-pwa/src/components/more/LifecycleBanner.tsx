import { useProjectStore } from '@/stores/projectStore';

interface LifecycleBannerProps {
  onExport: () => void;
}

export function LifecycleBanner({ onExport }: LifecycleBannerProps) {
  const { lifecycle, getLifecycleBanner, restoreProject } = useProjectStore();

  const bannerInfo = getLifecycleBanner();

  if (!bannerInfo?.show) return null;

  const isWrapped = lifecycle.state === 'wrapped';
  const isArchived = lifecycle.state === 'archived';

  return (
    <div className={`${
      isArchived
        ? 'bg-red-50 border-b border-red-200'
        : 'bg-amber-50 border-b border-amber-200'
    }`}>
      <div className="mobile-container px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isArchived ? (
              <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className={`text-xs font-medium truncate ${
              isArchived ? 'text-red-800' : 'text-amber-800'
            }`}>
              {bannerInfo.message}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isWrapped && (
              <button
                onClick={restoreProject}
                className="text-xs font-medium text-amber-700 hover:text-amber-900"
              >
                Restore
              </button>
            )}
            <button
              onClick={onExport}
              className={`px-2 py-1 text-[10px] font-semibold rounded ${
                isArchived
                  ? 'bg-red-600 text-white'
                  : 'bg-amber-600 text-white'
              }`}
            >
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
