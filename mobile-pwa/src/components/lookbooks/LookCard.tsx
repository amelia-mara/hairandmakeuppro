import { useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type { Look, Character } from '@/types';

interface LookCardProps {
  look: Look;
  character: Character;
  progress: { captured: number; total: number };
}

export function LookCard({ look, character: _character, progress }: LookCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { currentProject, sceneCaptures, setActiveTab, setCurrentScene } = useProjectStore();

  const progressPercent = progress.total > 0 ? (progress.captured / progress.total) * 100 : 0;

  // Get capture status for each scene in this look
  const getSceneCaptureStatus = (sceneNum: string): 'captured' | 'not-captured' => {
    if (!currentProject) return 'not-captured';
    const scene = currentProject.scenes.find(s => s.sceneNumber === sceneNum);
    if (!scene) return 'not-captured';

    const captureKey = `${scene.id}-${look.characterId}`;
    const capture = sceneCaptures[captureKey];
    return capture && (capture.photos.front || capture.additionalPhotos.length > 0)
      ? 'captured'
      : 'not-captured';
  };

  // Navigate to scene for capturing
  const handleSceneClick = (sceneNum: string) => {
    if (!currentProject) return;
    const scene = currentProject.scenes.find(s => s.sceneNumber === sceneNum);
    if (scene) {
      setActiveTab('breakdown');
      setCurrentScene(scene.id);
    }
  };

  // Get makeup summary line
  const getMakeupSummary = (): string[] => {
    const lines: string[] = [];
    if (look.makeup.foundation) {
      lines.push(`Foundation: ${look.makeup.foundation}${look.makeup.coverage ? ` (${look.makeup.coverage})` : ''}`);
    }
    if (look.makeup.lipColour || look.makeup.lipLiner) {
      lines.push(`Lips: ${[look.makeup.lipLiner, look.makeup.lipColour].filter(Boolean).join(' + ')}`);
    }
    if (look.makeup.lidColour || look.makeup.liner || look.makeup.lashes) {
      const eyeParts = [look.makeup.lidColour, look.makeup.liner, look.makeup.lashes].filter(Boolean);
      if (eyeParts.length > 0) {
        lines.push(`Eyes: ${eyeParts.join(', ')}`);
      }
    }
    return lines;
  };

  // Get hair summary
  const getHairSummary = (): string[] => {
    const lines: string[] = [];
    if (look.hair.style) {
      lines.push(look.hair.style);
    }
    const details = [look.hair.parting, look.hair.piecesOut, look.hair.accessories].filter(Boolean);
    if (details.length > 0) {
      lines.push(details.join(' • '));
    }
    return lines;
  };

  const makeupSummary = getMakeupSummary();
  const hairSummary = getHairSummary();

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
      {/* Main card content - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
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
              className={`w-[18px] h-[18px] text-text-light transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <polyline points="6 9 12 15 18 9" />
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

      {/* Expandable details */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-3">
          {/* Makeup & Hair side-by-side grid */}
          {(makeupSummary.length > 0 || hairSummary.length > 0) && (
            <div className="grid grid-cols-2 gap-2">
              {/* Makeup */}
              <div className="bg-gray-50 rounded-lg p-2.5">
                <h5 className="text-[9px] font-bold tracking-wider uppercase text-text-light mb-1.5">MAKEUP</h5>
                {makeupSummary.length > 0 ? (
                  <div className="space-y-0.5">
                    {makeupSummary.map((line, i) => (
                      <p key={i} className="text-[11px] text-text-secondary">{line}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-text-placeholder">Not specified</p>
                )}
              </div>

              {/* Hair */}
              <div className="bg-gray-50 rounded-lg p-2.5">
                <h5 className="text-[9px] font-bold tracking-wider uppercase text-text-light mb-1.5">HAIR</h5>
                {hairSummary.length > 0 ? (
                  <div className="space-y-0.5">
                    {hairSummary.map((line, i) => (
                      <p key={i} className="text-[11px] text-text-secondary">{line}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-text-placeholder">Not specified</p>
                )}
              </div>
            </div>
          )}

          {/* Scene captures - horizontal scroll */}
          <div>
            <h5 className="text-[9px] font-bold tracking-wider uppercase text-text-light mb-2">SCENE CAPTURES</h5>
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
              {look.scenes.map(sceneNum => {
                const status = getSceneCaptureStatus(sceneNum);
                const isCaptured = status === 'captured';
                return (
                  <button
                    key={sceneNum}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSceneClick(sceneNum);
                    }}
                    className={`flex-shrink-0 w-16 rounded-lg border overflow-hidden transition-colors ${
                      isCaptured
                        ? 'border-gold bg-gold-100/30'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="aspect-[3/4] flex items-center justify-center">
                      {isCaptured ? (
                        <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      )}
                    </div>
                    <div className={`py-1.5 text-center text-[10px] font-semibold ${
                      isCaptured ? 'text-gold' : 'text-text-muted'
                    }`}>
                      Sc {sceneNum}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Navigate to first uncaptured scene or first scene
                const uncaptured = look.scenes.find(sn => getSceneCaptureStatus(sn) === 'not-captured');
                handleSceneClick(uncaptured || look.scenes[0]);
              }}
              className="flex-1 py-2.5 px-4 rounded-button gold-gradient text-white text-sm font-medium active:scale-95 transition-transform"
            >
              View Full Look
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSceneClick(look.scenes[0]);
              }}
              className="flex-1 py-2.5 px-4 rounded-button border border-gold text-gold text-sm font-medium active:scale-95 transition-transform"
            >
              Edit Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
