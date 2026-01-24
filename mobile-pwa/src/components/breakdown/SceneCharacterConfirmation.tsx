import { useState, useMemo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';
import type { Scene, Character } from '@/types';
import { clsx } from 'clsx';

interface SceneCharacterConfirmationProps {
  scene: Scene;
  onClose: () => void;
  onConfirm: () => void;
}

export function SceneCharacterConfirmation({
  scene,
  onClose,
  onConfirm,
}: SceneCharacterConfirmationProps) {
  const {
    currentProject,
    confirmSceneCharacters,
    addCharacterFromScene,
  } = useProjectStore();

  // Track selected character IDs (start with already confirmed characters)
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<Set<string>>(() => {
    return new Set(scene.characters || []);
  });

  // Track which suggested names are selected (for suggested characters not yet in project)
  const [selectedSuggestedNames, setSelectedSuggestedNames] = useState<Set<string>>(() => {
    // If scene has existing characters, map them to names for initial selection
    const existingNames = new Set<string>();
    if (currentProject) {
      scene.characters?.forEach(charId => {
        const char = currentProject.characters.find(c => c.id === charId);
        if (char) existingNames.add(char.name);
      });
    }
    // Include suggested characters that aren't already in project
    const suggested = scene.suggestedCharacters || [];
    suggested.forEach(name => existingNames.add(name));
    return existingNames;
  });

  // New character name input
  const [newCharacterName, setNewCharacterName] = useState('');
  const [showAddCharacter, setShowAddCharacter] = useState(false);

  // Get all existing project characters
  const projectCharacters = currentProject?.characters || [];

  // Map suggested names to existing project characters
  const suggestedWithExisting = useMemo(() => {
    const suggested = scene.suggestedCharacters || [];
    return suggested.map(name => {
      // Check if this character name already exists in project
      const existing = projectCharacters.find(
        c => c.name.toUpperCase() === name.toUpperCase()
      );
      return {
        name,
        existingCharacter: existing || null,
        isInProject: !!existing,
      };
    });
  }, [scene.suggestedCharacters, projectCharacters]);

  // Handle toggling a suggested character
  const handleToggleSuggested = (name: string, existingChar: Character | null) => {
    setSelectedSuggestedNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
        // If character exists in project, also remove from selected IDs
        if (existingChar) {
          setSelectedCharacterIds(ids => {
            const newIds = new Set(ids);
            newIds.delete(existingChar.id);
            return newIds;
          });
        }
      } else {
        next.add(name);
        // If character exists in project, also add to selected IDs
        if (existingChar) {
          setSelectedCharacterIds(ids => new Set([...ids, existingChar.id]));
        }
      }
      return next;
    });
  };

  // Handle adding a new character
  const handleAddNewCharacter = () => {
    const trimmedName = newCharacterName.trim().toUpperCase();
    if (!trimmedName) return;

    // Check if already in suggested list
    if (selectedSuggestedNames.has(trimmedName)) {
      setNewCharacterName('');
      setShowAddCharacter(false);
      return;
    }

    // Check if character already exists in project
    const existing = projectCharacters.find(
      c => c.name.toUpperCase() === trimmedName
    );

    if (existing) {
      // Select the existing character
      setSelectedCharacterIds(ids => new Set([...ids, existing.id]));
    } else {
      // Add to suggested names (will create on confirm)
      setSelectedSuggestedNames(names => new Set([...names, trimmedName]));
    }

    setNewCharacterName('');
    setShowAddCharacter(false);
  };

  // Handle confirming the selection
  const handleConfirm = () => {
    // Start with existing selected character IDs
    const finalCharacterIds = new Set(selectedCharacterIds);

    // For each selected suggested name that's not in project, create the character
    selectedSuggestedNames.forEach(name => {
      const existing = projectCharacters.find(
        c => c.name.toUpperCase() === name.toUpperCase()
      );
      if (existing) {
        finalCharacterIds.add(existing.id);
      } else {
        // Create new character
        const newChar = addCharacterFromScene(scene.id, name);
        finalCharacterIds.add(newChar.id);
      }
    });

    // Confirm the scene with final character IDs
    confirmSceneCharacters(scene.id, Array.from(finalCharacterIds));
    onConfirm();
  };

  // Count of selected characters
  const selectedCount = selectedSuggestedNames.size;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
      <div className="bg-card w-full max-w-lg rounded-t-3xl max-h-[85vh] flex flex-col safe-bottom">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-text-primary truncate">
              Scene {scene.sceneNumber}
            </h3>
            <p className="text-xs text-text-muted truncate">{scene.slugline}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-text-muted active:text-gold"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Script content preview - scrollable to read full scene */}
        {scene.scriptContent && (
          <div className="px-4 py-3 bg-gray-50 border-b border-border max-h-48 overflow-y-auto shrink-0">
            <p className="text-xs text-text-secondary font-mono whitespace-pre-wrap">
              {scene.scriptContent}
            </p>
          </div>
        )}

        {/* Character selection */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Suggested characters section */}
          {suggestedWithExisting.length > 0 && (
            <div className="mb-4">
              <h4 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-2">
                SUGGESTED CHARACTERS
              </h4>
              <div className="space-y-2">
                {suggestedWithExisting.map(({ name, existingCharacter }) => {
                  const isSelected = selectedSuggestedNames.has(name);
                  return (
                    <button
                      key={name}
                      onClick={() => handleToggleSuggested(name, existingCharacter)}
                      className={clsx(
                        'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                        isSelected
                          ? 'border-gold bg-gold/5'
                          : 'border-border bg-card'
                      )}
                    >
                      {/* Checkbox */}
                      <div
                        className={clsx(
                          'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
                          isSelected ? 'border-gold bg-gold' : 'border-gray-300'
                        )}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>

                      {/* Character info */}
                      {existingCharacter ? (
                        <>
                          <CharacterAvatar character={existingCharacter} size="sm" />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-text-primary">{existingCharacter.name}</span>
                            <span className="text-xs text-green-600 ml-2">In project</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-text-primary">{name}</span>
                          <span className="text-xs text-text-muted ml-2">New character</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detection status message */}
          {scene.characterConfirmationStatus === 'detecting' && (
            <div className="flex items-center gap-2 text-text-muted text-sm mb-4 p-3 bg-gray-50 rounded-lg">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Detecting characters...
            </div>
          )}

          {scene.characterConfirmationStatus === 'pending' && !scene.suggestedCharacters?.length && (
            <div className="text-text-muted text-sm mb-4 p-3 bg-gray-50 rounded-lg">
              No characters detected yet. Add characters manually below.
            </div>
          )}

          {/* Add new character */}
          <div className="mt-4">
            {showAddCharacter ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCharacterName}
                  onChange={(e) => setNewCharacterName(e.target.value.toUpperCase())}
                  placeholder="CHARACTER NAME"
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-card text-text-primary uppercase"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddNewCharacter();
                    if (e.key === 'Escape') setShowAddCharacter(false);
                  }}
                />
                <button
                  onClick={handleAddNewCharacter}
                  disabled={!newCharacterName.trim()}
                  className="px-3 py-2 bg-gold text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddCharacter(false);
                    setNewCharacterName('');
                  }}
                  className="px-3 py-2 text-text-muted"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddCharacter(true)}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-border text-text-muted hover:border-gold hover:text-gold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add character not detected
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-border shrink-0">
          <button
            onClick={handleConfirm}
            className="w-full py-3 rounded-button gold-gradient text-white font-semibold text-base shadow-lg active:scale-[0.98] transition-transform"
          >
            Confirm {selectedCount} Character{selectedCount !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// Compact inline component for showing character confirmation status in scene cards
interface SceneCharacterStatusProps {
  scene: Scene;
  characters: Character[];
  onConfirmClick: () => void;
}

export function SceneCharacterStatus({
  scene,
  characters,
  onConfirmClick,
}: SceneCharacterStatusProps) {
  const status = scene.characterConfirmationStatus || 'pending';
  const suggestedNames = scene.suggestedCharacters || [];
  const confirmedCharacters = characters.filter(c => scene.characters?.includes(c.id));

  if (status === 'confirmed') {
    // Show confirmed characters
    return (
      <button
        onClick={onConfirmClick}
        className="w-full text-left group"
      >
        <div className="flex items-center gap-1.5 text-green-600 text-xs mb-1">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">Characters confirmed</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {confirmedCharacters.slice(0, 4).map(char => (
            <span key={char.id} className="text-[11px] text-text-secondary">
              {char.name}{confirmedCharacters.indexOf(char) < confirmedCharacters.length - 1 && confirmedCharacters.indexOf(char) < 3 ? ',' : ''}
            </span>
          ))}
          {confirmedCharacters.length > 4 && (
            <span className="text-[11px] text-text-muted">+{confirmedCharacters.length - 4} more</span>
          )}
        </div>
        <span className="text-[10px] text-gold opacity-0 group-hover:opacity-100 transition-opacity">
          Tap to edit
        </span>
      </button>
    );
  }

  if (status === 'detecting') {
    return (
      <div className="flex items-center gap-2 text-text-muted text-xs py-1">
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Detecting characters...
      </div>
    );
  }

  if (status === 'ready' && suggestedNames.length > 0) {
    return (
      <button
        onClick={onConfirmClick}
        className="w-full text-left"
      >
        <div className="flex items-center gap-1.5 text-amber-600 text-xs mb-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-medium">Characters not confirmed</span>
        </div>
        <p className="text-[11px] text-text-muted mb-1">
          Suggested: {suggestedNames.slice(0, 3).join(', ')}
          {suggestedNames.length > 3 && ` +${suggestedNames.length - 3} more`}
        </p>
        <span className="inline-flex items-center gap-1 text-[10px] text-gold font-medium">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Tap to confirm characters
        </span>
      </button>
    );
  }

  // Pending with no suggestions
  return (
    <button
      onClick={onConfirmClick}
      className="w-full text-left"
    >
      <div className="flex items-center gap-1.5 text-text-muted text-xs mb-1">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        <span>No characters assigned</span>
      </div>
      <span className="inline-flex items-center gap-1 text-[10px] text-gold font-medium">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Tap to add characters
      </span>
    </button>
  );
}

// Progress bar component for showing overall confirmation progress
interface CharacterConfirmationProgressProps {
  totalScenes: number;
  confirmedScenes: number;
}

export function CharacterConfirmationProgress({
  totalScenes,
  confirmedScenes,
}: CharacterConfirmationProgressProps) {
  const percentage = totalScenes > 0 ? Math.round((confirmedScenes / totalScenes) * 100) : 0;

  if (confirmedScenes >= totalScenes) {
    return null; // Don't show when all confirmed
  }

  return (
    <div className="mx-4 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-amber-700">
          Character Confirmation
        </span>
        <span className="text-xs text-amber-600">
          {confirmedScenes} / {totalScenes} scenes
        </span>
      </div>
      <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-[10px] text-amber-600 mt-1.5">
        Confirm characters in each scene to track continuity
      </p>
    </div>
  );
}
