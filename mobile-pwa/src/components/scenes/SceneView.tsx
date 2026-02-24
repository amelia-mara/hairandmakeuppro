import { useState, useEffect, useMemo, useCallback } from 'react';
import { clsx } from 'clsx';
import { useProjectStore } from '@/stores/projectStore';
import { Header } from '../navigation';
import { CharacterProfile } from '../characters/CharacterProfile';
import { Button } from '../ui';

interface SceneViewProps {
  sceneId: string;
  onBack: () => void;
}

export function SceneView({ sceneId, onBack }: SceneViewProps) {
  const {
    currentProject,
    currentCharacterId,
    setCurrentCharacter,
    getScene,
    getCharacter,
    addCharacterToScene,
  } = useProjectStore();

  const scene = getScene(sceneId);
  const [showFullScript, setShowFullScript] = useState(false);
  const [showBackPrompt, setShowBackPrompt] = useState(false);

  // Auto-select first character when scene loads
  useEffect(() => {
    if (scene && scene.characters.length > 0 && !currentCharacterId) {
      setCurrentCharacter(scene.characters[0]);
    }
  }, [scene, currentCharacterId, setCurrentCharacter]);

  // Check if the current character is in the scene's confirmed characters list
  const isCharacterInBreakdown = useMemo(() => {
    if (!scene || !currentCharacterId) return true;
    return scene.characters.includes(currentCharacterId);
  }, [scene, currentCharacterId]);

  const currentCharacter = currentCharacterId ? getCharacter(currentCharacterId) : null;

  // Add character to the scene breakdown
  const handleAddToBreakdown = useCallback(() => {
    if (scene && currentCharacterId) {
      addCharacterToScene(scene.id, currentCharacterId);
    }
  }, [scene, currentCharacterId, addCharacterToScene]);

  // Handle back navigation - prompt if character not added to breakdown
  const handleBack = useCallback(() => {
    if (!isCharacterInBreakdown && currentCharacterId) {
      setShowBackPrompt(true);
    } else {
      onBack();
    }
  }, [isCharacterInBreakdown, currentCharacterId, onBack]);

  if (!scene || !currentProject) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-muted">Scene not found</p>
          <Button variant="ghost" onClick={onBack} className="mt-2">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Memoize character lookups to avoid recalculating on every render
  const sceneCharacters = useMemo(() => {
    return scene.characters
      .map(id => getCharacter(id))
      .filter(Boolean);
  }, [scene.characters, getCharacter]);

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      <Header
        title={`Scene ${scene.sceneNumber}`}
        showBack
        onBack={handleBack}
      />

      {/* Add Character to Breakdown banner - shown when character isn't confirmed in scene */}
      {!isCharacterInBreakdown && currentCharacter && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="mobile-container">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800">
                  {currentCharacter.name} is not in the breakdown
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Add them to track continuity for this scene
                </p>
              </div>
              <button
                onClick={handleAddToBreakdown}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold active:scale-95 transition-transform"
              >
                Add to Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scene header info */}
      <div className="bg-card border-b border-border px-4 py-3">
        <div className="mobile-container">
          {/* Slugline */}
          <h2 className="text-base font-semibold text-text-primary mb-2">
            {scene.slugline}
          </h2>

          {/* Synopsis */}
          {scene.synopsis ? (
            <p className="text-sm text-text-secondary mb-3">{scene.synopsis}</p>
          ) : (
            <p className="text-sm text-text-muted italic mb-3">
              No synopsis available. Sync from desktop or tap to add.
            </p>
          )}

          {/* View Full Scene button */}
          {scene.scriptContent && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFullScript(true)}
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View Full Scene
            </Button>
          )}
        </div>
      </div>

      {/* Character tabs */}
      {sceneCharacters.length > 0 && (
        <div className="bg-card border-b border-border overflow-x-auto hide-scrollbar">
          <div className="mobile-container">
            <div className="flex gap-2 px-4 py-3">
              {sceneCharacters.map((character) => (
                <button
                  key={character!.id}
                  onClick={() => setCurrentCharacter(character!.id)}
                  className={clsx(
                    'flex-shrink-0 px-4 py-2 rounded-pill text-sm font-medium transition-colors touch-manipulation',
                    {
                      'gold-gradient text-white': currentCharacterId === character!.id,
                      'bg-gray-100 text-text-secondary hover:bg-gray-200': currentCharacterId !== character!.id,
                    }
                  )}
                >
                  {character!.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Character profile content */}
      {currentCharacterId && (
        <CharacterProfile
          sceneId={sceneId}
          characterId={currentCharacterId}
        />
      )}

      {/* Back prompt modal - shown when trying to leave without adding character to breakdown */}
      {showBackPrompt && currentCharacter && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setShowBackPrompt(false)}
        >
          <div
            className="w-full max-w-md bg-card rounded-t-2xl overflow-hidden animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-text-primary">
                    Add {currentCharacter.name} to Breakdown?
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    This character hasn't been added to the scene breakdown yet
                  </p>
                </div>
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => {
                  setShowBackPrompt(false);
                  onBack();
                }}
                className="flex-1 py-2.5 rounded-button border border-border text-text-muted text-sm font-medium"
              >
                Leave Without Adding
              </button>
              <button
                onClick={() => {
                  handleAddToBreakdown();
                  setShowBackPrompt(false);
                  onBack();
                }}
                className="flex-1 py-2.5 rounded-button gold-gradient text-white text-sm font-medium"
              >
                Add to Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full script modal */}
      {showFullScript && scene.scriptContent && (
        <FullScriptModal
          content={scene.scriptContent}
          sceneNumber={scene.sceneNumber}
          onClose={() => setShowFullScript(false)}
        />
      )}
    </div>
  );
}

interface FullScriptModalProps {
  content: string;
  sceneNumber: string;
  onClose: () => void;
}

function FullScriptModal({ content, sceneNumber, onClose }: FullScriptModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="h-full flex flex-col bg-card animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-text-primary">Scene {sceneNumber}</h2>
          <button
            onClick={onClose}
            className="p-2 -m-2 text-text-muted hover:text-text-primary tap-target touch-manipulation"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Script content */}
        <div className="flex-1 overflow-y-auto p-4">
          <pre className="whitespace-pre-wrap font-mono text-sm text-text-primary leading-relaxed">
            {content}
          </pre>
        </div>
      </div>
    </div>
  );
}
