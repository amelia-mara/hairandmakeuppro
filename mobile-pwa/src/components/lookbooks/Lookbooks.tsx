import { useState, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import type { Look, Character } from '@/types';
import { CharacterSection } from './CharacterSection';
import { AddLookModal } from './AddLookModal';
import { CastProfileCard } from './CastProfileCard';

type SyncStatus = 'synced' | 'pending' | 'offline';

export function Lookbooks() {
  const { currentProject, sceneCaptures } = useProjectStore();
  const [addLookOpen, setAddLookOpen] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [expandedCastProfileId, setExpandedCastProfileId] = useState<string | null>(null);
  const [showCastProfiles, setShowCastProfiles] = useState(true);

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
        <LookbooksHeader />
        <EmptyState onAddLook={() => handleAddLook()} />
      </div>
    );
  }

  const grouped = looksByCharacter();
  const hasLooks = currentProject.looks.length > 0;
  const characterCount = currentProject.characters.length;

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      <LookbooksHeader />

      <div className="mobile-container">
        <div className="px-4 pt-4 pb-24">
          {/* Sync Status Banner */}
          <SyncBanner status={syncStatus} />

          {/* Cast Profiles Section */}
          {characterCount > 0 && (
            <div className="mb-5">
              <button
                type="button"
                onClick={() => setShowCastProfiles(!showCastProfiles)}
                className="w-full flex items-center justify-between mb-3 touch-manipulation"
              >
                <span className="section-header">CAST PROFILES ({characterCount})</span>
                <svg
                  className={`w-5 h-5 text-text-muted transition-transform ${showCastProfiles ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showCastProfiles && (
                <div className="space-y-2.5">
                  {currentProject.characters.map((character) => (
                    <CastProfileCard
                      key={character.id}
                      character={character}
                      isExpanded={expandedCastProfileId === character.id}
                      onToggleExpand={() =>
                        setExpandedCastProfileId(
                          expandedCastProfileId === character.id ? null : character.id
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {hasLooks ? (
            <>
              {/* Characters count header */}
              <div className="section-header mb-3">
                LOOKBOOKS ({characterCount})
              </div>

              {/* By Character view */}
              <div className="space-y-5">
                {Array.from(grouped.entries()).map(([charId, looks]) => {
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
                })}
              </div>
            </>
          ) : (
            <EmptyState onAddLook={() => handleAddLook()} />
          )}
        </div>
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
function LookbooksHeader() {
  return (
    <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
      <div className="mobile-container">
        <div className="h-14 px-4 flex items-center justify-between">
          <button className="p-2 -ml-2 text-text-primary">
            <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-[17px] font-bold text-text-primary">Lookbook</h1>
          <button className="p-2 -mr-2 text-text-primary">
            <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Sync status banner
function SyncBanner({ status }: { status: SyncStatus }) {
  const colors = {
    synced: 'bg-success',
    pending: 'bg-warning',
    offline: 'bg-gray-400',
  };

  const labels = {
    synced: 'Synced with desktop',
    pending: 'Pending sync...',
    offline: 'Working offline',
  };

  return (
    <div className="bg-card rounded-[10px] px-4 py-3 mb-4 flex items-center justify-between shadow-card">
      <div className="flex items-center gap-2.5">
        <div className={`w-2 h-2 rounded-full ${colors[status]}`} />
        <span className="text-xs text-text-secondary">{labels[status]}</span>
      </div>
      <span className="text-[11px] text-text-light">2 min ago</span>
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

