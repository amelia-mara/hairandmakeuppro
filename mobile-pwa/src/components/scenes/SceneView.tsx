import { useState, useEffect } from 'react';
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
  } = useProjectStore();

  const scene = getScene(sceneId);
  const [showFullScript, setShowFullScript] = useState(false);

  // Auto-select first character when scene loads
  useEffect(() => {
    if (scene && scene.characters.length > 0 && !currentCharacterId) {
      setCurrentCharacter(scene.characters[0]);
    }
  }, [scene, currentCharacterId, setCurrentCharacter]);

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

  const sceneCharacters = scene.characters
    .map(id => getCharacter(id))
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      <Header
        title={`Scene ${scene.sceneNumber}`}
        showBack
        onBack={onBack}
      />

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
  sceneNumber: number;
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
