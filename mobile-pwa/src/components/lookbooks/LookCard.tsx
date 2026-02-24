import { useProjectStore } from '@/stores/projectStore';
import type { Look, Character } from '@/types';

interface LookCardProps {
  look: Look;
  character: Character;
  progress: { captured: number; total: number };
}

export function LookCard({ look, character: _character, progress }: LookCardProps) {
  const { currentProject, sceneCaptures, setCurrentLook } = useProjectStore();

  const progressPercent = progress.total > 0 ? (progress.captured / progress.total) * 100 : 0;
  const isComplete = progress.captured === progress.total && progress.total > 0;

  // Get recent capture info (last captured scene)
  const getRecentCapture = () => {
    if (!currentProject) return null;
    for (let i = look.scenes.length - 1; i >= 0; i--) {
      const sceneNum = look.scenes[i];
      const scene = currentProject.scenes.find(s => s.sceneNumber === sceneNum);
      if (scene) {
        const captureKey = `${scene.id}-${look.characterId}`;
        const capture = sceneCaptures[captureKey];
        if (capture && (capture.photos.front || capture.additionalPhotos.length > 0)) {
          return { sceneNum, capture };
        }
      }
    }
    return null;
  };

  const recentCapture = getRecentCapture();

  return (
    <div className="bg-card rounded-card overflow-hidden shadow-card">
      {/* Main card content - tap to open full look */}
      <button
        onClick={() => setCurrentLook(look.id)}
        className="w-full p-4 text-left"
      >
        {/* Look name and info row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="text-[15px] font-bold text-text-primary">{look.name}</h4>
            <p className="text-xs text-text-muted mt-1">
              Scenes {look.scenes.join(', ')} • ~{look.estimatedTime} min
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-semibold ${isComplete ? 'text-success' : 'text-gold'}`}>
              {progress.captured}/{progress.total}
            </span>
            <svg
              className="w-[18px] h-[18px] text-text-light"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="h-[3px] bg-gray-100 rounded-sm overflow-hidden">
            <div
              className={`h-full rounded-sm transition-all duration-300 ${isComplete ? 'bg-success' : 'gold-gradient'}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Preview row */}
        <div className="flex gap-3 items-center">
          {/* Master reference thumbnail */}
          <div className="w-[60px] h-[60px] rounded-lg bg-input-bg border border-border flex-shrink-0 overflow-hidden flex items-center justify-center">
            {look.masterReference ? (
              <img
                src={look.masterReference.thumbnail || look.masterReference.uri}
                alt="Master reference"
                className="w-full h-full object-cover"
              />
            ) : (
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            )}
          </div>

          {/* Recent capture mini grid or placeholder */}
          {recentCapture ? (
            <div className="flex-1">
              <span className="text-[9px] font-semibold tracking-wider uppercase text-text-light block mb-1.5">
                Scene {recentCapture.sceneNum}
              </span>
              <div className="grid grid-cols-4 gap-1">
                {(['front', 'left', 'right', 'back'] as const).map((angle) => {
                  const hasPhoto = recentCapture.capture.photos[angle];
                  return (
                    <div
                      key={angle}
                      className={`aspect-[3/4] rounded ${hasPhoto ? 'bg-gray-200 border border-gold' : 'bg-input-bg border border-border'} flex items-center justify-center`}
                    >
                      {hasPhoto ? (
                        <svg className="w-3 h-3 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg className="w-2.5 h-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-input-bg rounded-lg p-3 text-center">
              <span className="text-[11px] text-text-light">No captures yet</span>
            </div>
          )}
        </div>
      </button>
    </div>
  );
}
