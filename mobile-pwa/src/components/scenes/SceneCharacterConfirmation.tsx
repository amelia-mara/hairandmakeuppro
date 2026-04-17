import { useState, useMemo, useCallback, useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';
import { detectCharactersForScene } from '@/utils/scriptParser';
import type { Scene, Character, CharacterRole } from '@/types';
import { clsx } from 'clsx';

const ROLE_OPTIONS: { value: CharacterRole; label: string; shortLabel: string; colour: string }[] = [
  { value: 'lead', label: 'Lead', shortLabel: 'L', colour: 'bg-teal text-white' },
  { value: 'supporting', label: 'Supporting', shortLabel: 'SA', colour: 'bg-teal text-white' },
  { value: 'background', label: 'Background', shortLabel: 'BG', colour: 'bg-teal text-white' },
];

/** Compact role selector pill strip */
function RoleSelector({
  value,
  onChange,
}: {
  value: CharacterRole | undefined;
  onChange: (role: CharacterRole | undefined) => void;
}) {
  return (
    <div className="flex gap-1 mt-1.5">
      {ROLE_OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(isActive ? undefined : opt.value);
            }}
            className={clsx(
              'px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all leading-tight',
              isActive
                ? opt.colour
                : 'bg-gray-100 text-text-muted hover:bg-gray-200'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

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
    updateCharacter,
    updateSceneSuggestedCharacters,
  } = useProjectStore();

  // On-demand character detection: if detection never ran for this scene
  // (status is 'pending') and script content is available, detect now.
  // This handles cases where background detection was skipped (e.g. revised
  // script upload) or failed silently.
  const [isDetecting, setIsDetecting] = useState(false);
  useEffect(() => {
    const status = scene.characterConfirmationStatus;
    const hasScript = !!scene.scriptContent;
    const alreadyDetected = !!scene.suggestedCharacters;

    if ((status === 'pending' || !status) && hasScript && !alreadyDetected) {
      setIsDetecting(true);
      detectCharactersForScene(scene.scriptContent!, '', { useAI: false })
        .then((characters) => {
          if (characters.length > 0) {
            updateSceneSuggestedCharacters(scene.id, characters);
          }
        })
        .catch(() => {
          // Detection is optional — user can still add characters manually
        })
        .finally(() => setIsDetecting(false));
    }
  }, [scene.id, scene.characterConfirmationStatus, scene.scriptContent, scene.suggestedCharacters, updateSceneSuggestedCharacters]);

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

  // When on-demand detection populates suggestedCharacters after mount,
  // auto-select the newly detected names so they're pre-checked.
  useEffect(() => {
    const suggested = scene.suggestedCharacters || [];
    if (suggested.length > 0) {
      setSelectedSuggestedNames(prev => {
        const next = new Set(prev);
        let changed = false;
        for (const name of suggested) {
          if (!next.has(name)) {
            next.add(name);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
  }, [scene.suggestedCharacters]);

  // Track edited names — keyed by original suggested name (or existing char id)
  const [editedNames, setEditedNames] = useState<Record<string, string>>({});
  // Track which row is in edit mode (key = original name or char id)
  const [editingKey, setEditingKey] = useState<string | null>(null);

  // Track roles — keyed by original suggested name or existing char id
  const [roles, setRoles] = useState<Record<string, CharacterRole | undefined>>(() => {
    const initial: Record<string, CharacterRole | undefined> = {};
    if (currentProject) {
      scene.characters?.forEach(charId => {
        const char = currentProject.characters.find(c => c.id === charId);
        if (char?.role) initial[charId] = char.role;
      });
    }
    return initial;
  });

  // New character name input
  const [newCharacterName, setNewCharacterName] = useState('');
  const [showAddCharacter, setShowAddCharacter] = useState(false);

  // Get all existing project characters
  const projectCharacters = currentProject?.characters || [];

  // Map suggested names to existing project characters.
  // Includes both auto-detected names AND manually added names from the input.
  const suggestedWithExisting = useMemo(() => {
    const detected = scene.suggestedCharacters || [];
    // Include manually added names not already in the detected or confirmed set
    const detectedUpper = new Set(detected.map(n => n.toUpperCase()));
    const confirmedUpper = new Set(
      (scene.characters || []).map(id => {
        const c = projectCharacters.find(ch => ch.id === id);
        return c ? c.name.toUpperCase() : '';
      })
    );
    const manuallyAdded = Array.from(selectedSuggestedNames).filter(
      name => !detectedUpper.has(name.toUpperCase()) && !confirmedUpper.has(name.toUpperCase())
    );
    const allNames = [...detected, ...manuallyAdded];
    return allNames.map(name => {
      const existing = projectCharacters.find(
        c => c.name.toUpperCase() === name.toUpperCase()
      );
      return {
        name,
        existingCharacter: existing || null,
        isInProject: !!existing,
      };
    });
  }, [scene.suggestedCharacters, projectCharacters, selectedSuggestedNames, scene.characters]);

  const setRole = useCallback((key: string, role: CharacterRole | undefined) => {
    setRoles(prev => ({ ...prev, [key]: role }));
  }, []);

  const startEditing = useCallback((key: string, currentName: string) => {
    setEditingKey(key);
    if (!editedNames[key]) {
      setEditedNames(prev => ({ ...prev, [key]: currentName }));
    }
  }, [editedNames]);

  const commitEdit = useCallback((key: string) => {
    setEditingKey(null);
    // Clean up if name wasn't actually changed
    const edited = editedNames[key]?.trim().toUpperCase();
    if (!edited) {
      setEditedNames(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, [editedNames]);

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

    // Apply role/name edits to existing characters
    selectedCharacterIds.forEach(charId => {
      const role = roles[charId];
      const editedName = editedNames[charId]?.trim().toUpperCase();
      const char = projectCharacters.find(c => c.id === charId);
      if (!char) return;
      const nameChanged = editedName && editedName !== char.name;
      const roleChanged = role !== char.role;
      if (nameChanged || roleChanged) {
        updateCharacter(charId, {
          ...(nameChanged ? { name: editedName } : {}),
          ...(roleChanged ? { role } : {}),
        });
      }
    });

    // For each selected suggested name that's not in project, create the character
    selectedSuggestedNames.forEach(name => {
      const existing = projectCharacters.find(
        c => c.name.toUpperCase() === name.toUpperCase()
      );
      if (existing) {
        finalCharacterIds.add(existing.id);
        // Apply role if set
        const role = roles[name];
        const editedName = editedNames[name]?.trim().toUpperCase();
        const nameChanged = editedName && editedName !== existing.name;
        if (role !== existing.role || nameChanged) {
          updateCharacter(existing.id, {
            ...(nameChanged ? { name: editedName } : {}),
            ...(role !== existing.role ? { role } : {}),
          });
        }
      } else {
        // Use edited name if available, otherwise original suggested name
        const finalName = editedNames[name]?.trim().toUpperCase() || name;
        const role = roles[name];
        const newChar = addCharacterFromScene(scene.id, finalName, role);
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
            className="p-2 -mr-2 text-text-muted active:text-amber"
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
          {/* Current characters section - show existing confirmed characters with remove option */}
          {scene.characters && scene.characters.length > 0 && (
            <div className="mb-4">
              <h4 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-2">
                CURRENT CHARACTERS
              </h4>
              <div className="space-y-1.5">
                {scene.characters.map(charId => {
                  const char = projectCharacters.find(c => c.id === charId);
                  if (!char) return null;
                  const isSelected = selectedCharacterIds.has(charId);
                  const isEditing = editingKey === charId;
                  const displayName = editedNames[charId] || char.name;
                  return (
                    <div
                      key={charId}
                      className={clsx(
                        'p-2.5 rounded-xl border transition-all',
                        isSelected
                          ? 'border-amber bg-amber/5'
                          : 'border-red-200 bg-red-50'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <CharacterAvatar character={char} size="xs" />
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedNames[charId] ?? char.name}
                              onChange={(e) => setEditedNames(prev => ({ ...prev, [charId]: e.target.value.toUpperCase() }))}
                              onBlur={() => commitEdit(charId)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit(charId);
                                if (e.key === 'Escape') {
                                  setEditedNames(prev => { const n = { ...prev }; delete n[charId]; return n; });
                                  setEditingKey(null);
                                }
                              }}
                              className="w-full px-2 py-1 text-sm font-medium border border-amber rounded bg-white text-text-primary uppercase"
                              autoFocus
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEditing(charId, char.name)}
                              className="flex items-center gap-1.5 group"
                            >
                              <span className={clsx(
                                'text-sm font-medium',
                                isSelected ? 'text-text-primary' : 'text-red-400 line-through'
                              )}>{displayName}</span>
                              <svg className="w-3 h-3 text-text-light opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          )}
                          {isSelected && (
                            <RoleSelector
                              value={roles[charId]}
                              onChange={(r) => setRole(charId, r)}
                            />
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setSelectedCharacterIds(ids => {
                              const newIds = new Set(ids);
                              if (newIds.has(charId)) {
                                newIds.delete(charId);
                              } else {
                                newIds.add(charId);
                              }
                              return newIds;
                            });
                            // Also update suggested names if this character was from suggestions
                            const charNameUpper = char.name.toUpperCase();
                            setSelectedSuggestedNames(names => {
                              const newNames = new Set(names);
                              if (isSelected) {
                                newNames.delete(charNameUpper);
                              } else {
                                newNames.add(charNameUpper);
                              }
                              return newNames;
                            });
                          }}
                          className={clsx(
                            'p-1.5 rounded-lg transition-colors flex-shrink-0',
                            isSelected
                              ? 'text-red-500 hover:bg-red-50 active:bg-red-100'
                              : 'text-green-600 hover:bg-green-50 active:bg-green-100'
                          )}
                          title={isSelected ? 'Remove from scene' : 'Add back to scene'}
                        >
                          {isSelected ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Suggested characters section */}
          {suggestedWithExisting.length > 0 && (
            <div className="mb-4">
              <h4 className="text-[10px] font-bold tracking-wider uppercase text-text-light mb-2">
                SUGGESTED CHARACTERS
              </h4>
              <div className="space-y-1.5">
                {suggestedWithExisting.map(({ name, existingCharacter }) => {
                  const isSelected = selectedSuggestedNames.has(name);
                  const isEditing = editingKey === name;
                  const displayName = editedNames[name] || (existingCharacter ? existingCharacter.name : name);
                  return (
                    <div
                      key={name}
                      className={clsx(
                        'w-full p-2.5 rounded-xl border transition-all text-left',
                        isSelected
                          ? 'border-amber bg-amber/5'
                          : 'border-border bg-card'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => handleToggleSuggested(name, existingCharacter)}
                          className={clsx(
                            'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
                            isSelected ? 'border-teal bg-teal' : 'border-gray-300'
                          )}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>

                        {/* Character info */}
                        {existingCharacter && (
                          <CharacterAvatar character={existingCharacter} size="xs" />
                        )}
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedNames[name] ?? (existingCharacter ? existingCharacter.name : name)}
                              onChange={(e) => setEditedNames(prev => ({ ...prev, [name]: e.target.value.toUpperCase() }))}
                              onBlur={() => commitEdit(name)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit(name);
                                if (e.key === 'Escape') {
                                  setEditedNames(prev => { const n = { ...prev }; delete n[name]; return n; });
                                  setEditingKey(null);
                                }
                              }}
                              className="w-full px-2 py-1 text-sm font-medium border border-amber rounded bg-white text-text-primary uppercase"
                              autoFocus
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEditing(name, existingCharacter ? existingCharacter.name : name)}
                              className="flex items-center gap-1.5 group"
                            >
                              <span className="text-sm font-medium text-text-primary">{displayName}</span>
                              {existingCharacter ? (
                                <span className="text-xs text-green-600">In project</span>
                              ) : (
                                <span className="text-xs text-text-muted">New character</span>
                              )}
                              <svg className="w-3 h-3 text-text-light opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detection status message */}
          {(scene.characterConfirmationStatus === 'detecting' || isDetecting) && (
            <div className="flex items-center gap-2 text-text-muted text-sm mb-4 p-3 bg-gray-50 rounded-lg">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Detecting characters...
            </div>
          )}

          {!isDetecting && scene.characterConfirmationStatus === 'pending' && !scene.suggestedCharacters?.length && (
            <div className="text-text-muted text-sm mb-4 p-3 bg-gray-50 rounded-lg">
              No characters detected. Add characters manually below.
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
                  className="px-3 py-2 bg-amber text-white rounded-lg text-sm font-medium disabled:opacity-50"
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
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-border text-text-muted hover:border-amber hover:text-amber transition-colors"
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
            className="w-full py-3 rounded-button bg-amber text-white font-semibold text-base shadow-lg active:scale-[0.98] transition-transform"
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
    // Group confirmed characters by role
    const leads = confirmedCharacters.filter(c => c.role === 'lead');
    const supportingChars = confirmedCharacters.filter(c => c.role === 'supporting');
    const backgroundChars = confirmedCharacters.filter(c => c.role === 'background');
    const unassigned = confirmedCharacters.filter(c => !c.role);

    const roleGroups = [
      { key: 'lead', label: 'L', colour: 'bg-amber-100 text-amber', chars: leads },
      { key: 'supporting', label: 'SA', colour: 'bg-blue-100 text-blue-700', chars: supportingChars },
      { key: 'background', label: 'BG', colour: 'bg-gray-100 text-gray-500', chars: backgroundChars },
      { key: 'unassigned', label: '', colour: '', chars: unassigned },
    ].filter(g => g.chars.length > 0);

    // Show confirmed characters grouped by role
    return (
      <div className="w-full">
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
          <div className="space-y-0.5">
            {roleGroups.map(group => (
              <div key={group.key} className="flex flex-wrap items-center gap-1">
                {group.label && (
                  <span className={clsx('text-[9px] font-bold px-1 rounded', group.colour)}>
                    {group.label}
                  </span>
                )}
                {group.chars.map((char, i) => (
                  <span key={char.id} className="text-[11px] text-text-secondary">
                    {char.name}{i < group.chars.length - 1 ? ',' : ''}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </button>
        {/* Add character button - always visible */}
        <button
          onClick={onConfirmClick}
          className="inline-flex items-center gap-1 text-[10px] text-amber font-medium mt-1.5 hover:text-amber-dark transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add character
        </button>
      </div>
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
        <span className="inline-flex items-center gap-1 text-[10px] text-amber font-medium">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Tap to confirm characters
        </span>
      </button>
    );
  }

  // Pending with no suggestions - just show add button
  return (
    <button
      onClick={onConfirmClick}
      className="inline-flex items-center gap-1 text-xs text-amber font-medium"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      Tap to add characters
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
    <div className="mx-4 mb-3 p-3 bg-amber/5 border border-amber-200 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-amber">
          Character Confirmation
        </span>
        <span className="text-xs text-amber-600">
          {confirmedScenes} / {totalScenes} scenes
        </span>
      </div>
      <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber/50 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-[10px] text-amber-600 mt-1.5">
        Confirm characters in each scene to track continuity
      </p>
    </div>
  );
}
