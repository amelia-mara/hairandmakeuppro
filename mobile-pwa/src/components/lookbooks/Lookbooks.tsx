import { useState, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type { Look, Character } from '@/types';
import { CharacterSection } from './CharacterSection';
import { AddLookModal } from './AddLookModal';

type ViewMode = 'character' | 'timeline';
type SyncStatus = 'synced' | 'pending' | 'offline';

export function Lookbooks() {
  const { currentProject, sceneCaptures } = useProjectStore();
  const [viewMode, setViewMode] = useState<ViewMode>('character');
  const [addLookOpen, setAddLookOpen] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

  // Simulated sync status (would come from sync service in real app)
  const syncStatus: SyncStatus = 'offline';

  // Group looks by character
  const looksByCharacter = useCallback(() => {
    if (!currentProject) return new Map<string, Look[]>();

    const grouped = new Map<string, Look[]>();
    currentProject.characters.forEach(char => {
      grouped.set(char.id, []);
    });

    currentProject.looks.forEach(look => {
      const existing = grouped.get(look.characterId) || [];
      grouped.set(look.characterId, [...existing, look]);
    });

    return grouped;
  }, [currentProject]);

  // Get capture progress for a look
  const getCaptureProgress = useCallback((look: Look): { captured: number; total: number } => {
    if (!currentProject) return { captured: 0, total: 0 };

    const total = look.scenes.length;
    let captured = 0;

    look.scenes.forEach(sceneNum => {
      const scene = currentProject.scenes.find(s => s.sceneNumber === sceneNum);
      if (scene) {
        const captureKey = `${scene.id}-${look.characterId}`;
        const capture = sceneCaptures[captureKey];
        if (capture && (capture.photos.front || capture.additionalPhotos.length > 0)) {
          captured++;
        }
      }
    });

    return { captured, total };
  }, [currentProject, sceneCaptures]);

  // Get character by ID
  const getCharacter = (charId: string): Character | undefined => {
    return currentProject?.characters.find(c => c.id === charId);
  };

  // Handle add look for character
  const handleAddLook = (characterId?: string) => {
    setSelectedCharacterId(characterId || null);
    setAddLookOpen(true);
  };

  // No project loaded
  if (!currentProject) {
    return (
      <div className="min-h-screen bg-background pb-safe-bottom">
        <LookbooksHeader
          syncStatus={syncStatus}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
        <EmptyState onAddLook={() => handleAddLook()} />
      </div>
    );
  }

  const grouped = looksByCharacter();
  const hasLooks = currentProject.looks.length > 0;

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      <LookbooksHeader
        syncStatus={syncStatus}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <div className="mobile-container">
        {hasLooks ? (
          <div className="px-4 py-4 space-y-4 pb-24">
            {viewMode === 'character' ? (
              // By Character view
              Array.from(grouped.entries()).map(([charId, looks]) => {
                const character = getCharacter(charId);
                if (!character) return null;

                // Calculate total capture progress for character
                let totalCaptured = 0;
                let totalScenes = 0;
                looks.forEach(look => {
                  const progress = getCaptureProgress(look);
                  totalCaptured += progress.captured;
                  totalScenes += progress.total;
                });

                return (
                  <CharacterSection
                    key={charId}
                    character={character}
                    looks={looks}
                    capturedScenes={totalCaptured}
                    totalScenes={totalScenes}
                    getCaptureProgress={getCaptureProgress}
                    onAddLook={() => handleAddLook(charId)}
                  />
                );
              })
            ) : (
              // Timeline view - looks sorted by first scene number
              <div className="space-y-3">
                {[...currentProject.looks]
                  .sort((a, b) => (a.scenes[0] || 0) - (b.scenes[0] || 0))
                  .map(look => {
                    const character = getCharacter(look.characterId);
                    if (!character) return null;

                    return (
                      <TimelineLookCard
                        key={look.id}
                        look={look}
                        character={character}
                        progress={getCaptureProgress(look)}
                      />
                    );
                  })}
              </div>
            )}
          </div>
        ) : (
          <EmptyState onAddLook={() => handleAddLook()} />
        )}
      </div>

      {/* Floating Add Button */}
      <button
        onClick={() => handleAddLook()}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full gold-gradient shadow-lg flex items-center justify-center text-white z-40 active:scale-95 transition-transform"
        aria-label="Add Look"
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Add Look Modal */}
      <AddLookModal
        isOpen={addLookOpen}
        onClose={() => setAddLookOpen(false)}
        preselectedCharacterId={selectedCharacterId}
      />
    </div>
  );
}

// Header component
interface LookbooksHeaderProps {
  syncStatus: SyncStatus;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

function LookbooksHeader({ syncStatus, viewMode, onViewModeChange }: LookbooksHeaderProps) {
  return (
    <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
      <div className="mobile-container">
        <div className="h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-text-primary">Lookbooks</h1>
            <SyncIndicator status={syncStatus} />
          </div>

          {/* Pull-to-refresh hint would go here */}
        </div>

        {/* View toggle */}
        <div className="px-4 pb-3">
          <div className="flex bg-input-bg rounded-pill p-1">
            <button
              onClick={() => onViewModeChange('character')}
              className={`flex-1 py-2 px-4 rounded-pill text-sm font-medium transition-all ${
                viewMode === 'character'
                  ? 'bg-card shadow text-text-primary'
                  : 'text-text-muted'
              }`}
            >
              By Character
            </button>
            <button
              onClick={() => onViewModeChange('timeline')}
              className={`flex-1 py-2 px-4 rounded-pill text-sm font-medium transition-all ${
                viewMode === 'timeline'
                  ? 'bg-card shadow text-text-primary'
                  : 'text-text-muted'
              }`}
            >
              Timeline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sync status indicator
function SyncIndicator({ status }: { status: SyncStatus }) {
  const colors = {
    synced: 'bg-success',
    pending: 'bg-warning',
    offline: 'bg-gray-400',
  };

  const labels = {
    synced: 'Synced',
    pending: 'Pending sync',
    offline: 'Offline',
  };

  return (
    <div className="flex items-center gap-1.5" title={labels[status]}>
      <div className={`w-2 h-2 rounded-full ${colors[status]} ${status === 'synced' ? 'animate-pulse' : ''}`} />
      <span className="text-xs text-text-muted hidden sm:inline">{labels[status]}</span>
    </div>
  );
}

// Empty state
function EmptyState({ onAddLook }: { onAddLook: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-8">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-gold-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">No looks defined</h2>
        <p className="text-sm text-text-muted mb-6">
          Sync from desktop or create looks manually
        </p>
        <button
          onClick={onAddLook}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-button gold-gradient text-white font-medium shadow-sm active:scale-95 transition-transform"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Look
        </button>
      </div>
    </div>
  );
}

// Timeline view look card (simplified)
interface TimelineLookCardProps {
  look: Look;
  character: Character;
  progress: { captured: number; total: number };
}

function TimelineLookCard({ look, character, progress }: TimelineLookCardProps) {
  const progressPercent = progress.total > 0 ? (progress.captured / progress.total) * 100 : 0;

  return (
    <div className="card">
      <div className="flex items-start gap-3">
        {/* Character avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${character.avatarColour || '#C9A962'} 0%, ${character.avatarColour || '#B8962E'} 100%)`,
          }}
        >
          {character.initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs text-text-muted">{character.name}</div>
              <div className="font-semibold text-text-primary">{look.name}</div>
            </div>
            <div className="text-xs text-text-muted whitespace-nowrap">
              Sc {look.scenes[0]}-{look.scenes[look.scenes.length - 1]}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-2">
            <div className="flex justify-between text-xs text-text-muted mb-1">
              <span>{progress.captured}/{progress.total} scenes</span>
              <span>~{look.estimatedTime} min</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full gold-gradient rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
