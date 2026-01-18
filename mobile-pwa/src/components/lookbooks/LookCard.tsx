import { useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type { Look, Character } from '@/types';
import { formatSceneRange } from '@/utils/helpers';

interface LookCardProps {
  look: Look;
  character: Character;
  progress: { captured: number; total: number };
}

export function LookCard({ look, character: _character, progress }: LookCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { currentProject, sceneCaptures, setActiveTab, setCurrentScene } = useProjectStore();

  const progressPercent = progress.total > 0 ? (progress.captured / progress.total) * 100 : 0;
  const sceneRange = formatSceneRange(look.scenes);

  // Get capture status for each scene in this look
  const getSceneCaptureStatus = (sceneNum: number): 'captured' | 'not-captured' => {
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
  const handleSceneClick = (sceneNum: number) => {
    if (!currentProject) return;
    const scene = currentProject.scenes.find(s => s.sceneNumber === sceneNum);
    if (scene) {
      setActiveTab('scenes');
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

  return (
    <div className="bg-input-bg rounded-lg overflow-hidden">
      {/* Main card content - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 text-left active:bg-gray-100 transition-colors"
      >
        {/* Look name and info row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-text-primary truncate">{look.name}</h4>
            <div className="text-xs text-text-muted mt-0.5">
              Sc {sceneRange} • ~{look.estimatedTime} min
            </div>
          </div>
          <svg
            className={`w-4 h-4 text-text-muted transition-transform duration-200 flex-shrink-0 mt-1 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-text-muted mb-1">
            <span>{progress.captured}/{progress.total} scenes captured</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full gold-gradient rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Thumbnail row */}
        <div className="flex gap-2">
          {/* Master reference - larger */}
          <div className="w-16 h-16 rounded-lg bg-gray-200 flex-shrink-0 overflow-hidden">
            {look.masterReference ? (
              <img
                src={look.masterReference.thumbnail || look.masterReference.uri}
                alt="Master reference"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>

          {/* 4-angle mini grid */}
          <div className="grid grid-cols-2 gap-1 flex-shrink-0">
            {(['front', 'left', 'right', 'back'] as const).map((angle) => (
              <div
                key={angle}
                className="w-7 h-7 rounded bg-gray-200 flex items-center justify-center"
              >
                <span className="text-[8px] text-gray-400 uppercase">{angle[0]}</span>
              </div>
            ))}
          </div>
        </div>
      </button>

      {/* Expandable details */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-3 pb-3 space-y-4 border-t border-border/50 pt-3">
          {/* Makeup summary */}
          {makeupSummary.length > 0 && (
            <div>
              <h5 className="field-label mb-1.5">MAKEUP</h5>
              <div className="space-y-0.5">
                {makeupSummary.map((line, i) => (
                  <p key={i} className="text-xs text-text-secondary">{line}</p>
                ))}
              </div>
            </div>
          )}

          {/* Hair summary */}
          {hairSummary.length > 0 && (
            <div>
              <h5 className="field-label mb-1.5">HAIR</h5>
              <div className="space-y-0.5">
                {hairSummary.map((line, i) => (
                  <p key={i} className="text-xs text-text-secondary">{line}</p>
                ))}
              </div>
            </div>
          )}

          {/* Scene status pills */}
          <div>
            <h5 className="field-label mb-2">SCENE STATUS</h5>
            <div className="flex flex-wrap gap-1.5">
              {look.scenes.map(sceneNum => {
                const status = getSceneCaptureStatus(sceneNum);
                return (
                  <button
                    key={sceneNum}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSceneClick(sceneNum);
                    }}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      status === 'captured'
                        ? 'bg-gold-100 text-gold border border-gold'
                        : 'bg-gray-100 text-text-muted border border-gray-200'
                    }`}
                  >
                    {status === 'captured' && (
                      <svg className="w-3 h-3 inline mr-1 -mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    {sceneNum}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
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
                // Would open edit modal
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
