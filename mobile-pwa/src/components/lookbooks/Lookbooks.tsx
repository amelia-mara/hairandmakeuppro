import { useState, useCallback, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useCallSheetStore } from '@/stores/callSheetStore';
import type { Look, Character } from '@/types';
import { CharacterSection } from './CharacterSection';
import { AddLookModal } from './AddLookModal';

type SyncStatus = 'synced' | 'pending' | 'offline';

export function Lookbooks() {
  const { currentProject, sceneCaptures } = useProjectStore();
  const { schedule } = useScheduleStore();
  const { callSheets } = useCallSheetStore();
  const [addLookOpen, setAddLookOpen] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

  // Simulated sync status (would come from sync service in real app)
  const syncStatus: SyncStatus = 'offline';

  // Build a map of cast number -> scene numbers from all call sheets
  // This lets us count how many scenes each cast member appears in
  const castSceneMap = useMemo(() => {
    const map = new Map<number, Set<string>>();
    for (const callSheet of callSheets) {
      for (const scene of callSheet.scenes) {
        if (scene.cast) {
          for (const castId of scene.cast) {
            const castNum = parseInt(castId, 10);
            if (!isNaN(castNum)) {
              if (!map.has(castNum)) {
                map.set(castNum, new Set());
              }
              map.get(castNum)!.add(scene.sceneNumber);
            }
          }
        }
      }
    }
    return map;
  }, [callSheets]);

  // Merge characters from schedule cast list with confirmed project characters
  // This ensures cast appears immediately when schedule is uploaded
  const allCharacters = useMemo(() => {
    const charactersMap = new Map<string, Character>();

    // First, add all confirmed project characters (without cast numbers initially)
    if (currentProject?.characters) {
      currentProject.characters.forEach(char => {
        charactersMap.set(char.id, { ...char });
      });
    }

    // Then, process the schedule cast list
    if (schedule?.castList) {
      schedule.castList.forEach(castMember => {
        const castName = (castMember.character || castMember.name).toUpperCase();

        // Check if this cast member is already in the project (by matching name)
        const existingChar = currentProject?.characters.find(
          c => c.name.toUpperCase() === castName
        );

        if (existingChar) {
          // Update the existing character with the cast number from schedule
          const updated = charactersMap.get(existingChar.id);
          if (updated) {
            updated.actorNumber = castMember.number;
            charactersMap.set(existingChar.id, updated);
          }
        } else {
          // Create a placeholder character from the cast list
          // Use cast-${number} ID format to match call sheet character IDs
          const name = castMember.character || castMember.name;
          const placeholderId = `cast-${castMember.number}`;

          // Generate initials
          const words = name.split(/\s+/).filter(Boolean);
          const initials = words.length >= 2
            ? `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
            : name.substring(0, 2).toUpperCase();

          // Generate a color based on cast number
          const colors = ['#C9A962', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B', '#6366F1', '#22C55E', '#EF4444'];
          const avatarColour = colors[castMember.number % colors.length];

          charactersMap.set(placeholderId, {
            id: placeholderId,
            name,
            initials,
            avatarColour,
            actorNumber: castMember.number,
          });
        }
      });
    }

    // Convert to array and sort by cast number (1 = lead, etc.)
    return Array.from(charactersMap.values()).sort((a, b) => {
      // Characters with cast numbers come first, sorted by number
      const aNum = a.actorNumber ?? 999;
      const bNum = b.actorNumber ?? 999;
      if (aNum !== bNum) return aNum - bNum;
      // Fall back to alphabetical for characters without cast numbers
      return a.name.localeCompare(b.name);
    });
  }, [currentProject?.characters, schedule?.castList]);

  // Group looks by character (using all characters including schedule cast)
  const looksByCharacter = useCallback(() => {
    const grouped = new Map<string, Look[]>();

    // Initialize with all characters (including schedule-sourced ones)
    allCharacters.forEach(char => {
      grouped.set(char.id, []);
    });

    // Add looks to their respective characters
    if (currentProject?.looks) {
      currentProject.looks.forEach(look => {
        const existing = grouped.get(look.characterId) || [];
        grouped.set(look.characterId, [...existing, look]);
      });
    }

    return grouped;
  }, [currentProject?.looks, allCharacters]);

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

  // Get character by ID (checks both project characters and schedule-sourced)
  const getCharacter = (charId: string): Character | undefined => {
    return allCharacters.find(c => c.id === charId);
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
  const hasCharacters = allCharacters.length > 0;
  const characterCount = allCharacters.length;

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      <LookbooksHeader />

      <div className="mobile-container">
        <div className="px-4 pt-4 pb-24">
          {/* Sync Status Banner */}
          <SyncBanner status={syncStatus} />

          {hasCharacters ? (
            <>
              {/* Characters count header */}
              <div className="section-header mb-3">
                CAST & LOOKBOOKS ({characterCount})
              </div>

              {/* Unified Character view - cast profiles + lookbooks together */}
              <div className="space-y-5">
                {Array.from(grouped.entries()).map(([charId, looks]) => {
                  const character = getCharacter(charId);
                  if (!character) return null;

                  // Calculate total capture progress for character
                  let totalCaptured = 0;
                  let looksSceneCount = 0;
                  looks.forEach(look => {
                    const progress = getCaptureProgress(look);
                    totalCaptured += progress.captured;
                    looksSceneCount += progress.total;
                  });

                  // Get scenes from call sheet data using cast number
                  // This shows total scenes the cast member appears in across all call sheets
                  const callSheetScenes = character.actorNumber
                    ? castSceneMap.get(character.actorNumber)
                    : undefined;
                  const callSheetSceneCount = callSheetScenes?.size || 0;

                  // Use the larger of looks-based scene count or call sheet scene count
                  // This ensures we show accurate counts even if looks aren't fully set up
                  const totalScenes = Math.max(looksSceneCount, callSheetSceneCount);

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
        <div className="h-14 px-4 flex items-center justify-center">
          <h1 className="text-[17px] font-bold text-text-primary">Lookbook</h1>
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

