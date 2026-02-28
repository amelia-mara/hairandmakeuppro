import { useState, useMemo, useRef, useEffect, memo } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useCallSheetStore } from '@/stores/callSheetStore';
import { useSyncStore } from '@/stores/syncStore';
import { SceneScriptModal } from '@/components/scenes/SceneScriptModal';
import { formatShortDate } from '@/utils/helpers';
import type { ShootingSceneStatus, SceneFilmingStatus, CallSheetScene, Scene, Character, Look, NavTab } from '@/types';
import { SCENE_FILMING_STATUS_CONFIG, parseDayTypeFromString } from '@/types';
import { clsx } from 'clsx';

// Format minutes into hours and minutes (e.g., 206 -> "3hr 26m")
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}hr`;
  }
  return `${hours}hr ${mins}m`;
}

/**
 * Split combined scene numbers and extract base scene numbers
 * Examples:
 *   "32/32B" -> ["32/32B", "32", "32B"]
 *   "15pt2" -> ["15pt2", "15"]
 *   "15pt 2" -> ["15pt 2", "15"]
 *   "15A" -> ["15A", "15"]
 *   "119" -> ["119"]
 *   "1A/1B/1C" -> ["1A/1B/1C", "1A", "1B", "1C", "1"]
 */
function splitCombinedSceneNumber(sceneNumber: string): string[] {
  const results = new Set<string>();
  results.add(sceneNumber); // Always include original

  // Split on /
  const slashParts = sceneNumber.split(/[\/]/).map(s => s.trim()).filter(Boolean);
  slashParts.forEach(p => results.add(p));

  // Split on comma
  const commaParts = sceneNumber.split(/[,]/).map(s => s.trim()).filter(Boolean);
  commaParts.forEach(p => results.add(p));

  // Extract base scene number from patterns like "15pt2", "15pt 2", "15A", "15-2"
  // Pattern: digits followed by optional letter, then "pt"/"part"/letter/dash + more
  const baseMatch = sceneNumber.match(/^(\d+[A-Za-z]?)(?:pt|part|PT|PART|-|\s)/i);
  if (baseMatch) {
    results.add(baseMatch[1]); // Add the base number (e.g., "15" from "15pt2")
  }

  // Also try extracting just the leading digits
  const digitsMatch = sceneNumber.match(/^(\d+)/);
  if (digitsMatch && digitsMatch[1] !== sceneNumber) {
    results.add(digitsMatch[1]);
  }

  // For each part found, also try to extract its base
  const allParts = [...results];
  for (const part of allParts) {
    const partBase = part.match(/^(\d+)[A-Za-z]$/);
    if (partBase) {
      results.add(partBase[1]); // "32B" -> "32"
    }
  }

  return [...results];
}


interface TodayProps {
  onSceneSelect: (sceneId: string) => void;
  onNavigateToTab?: (tab: NavTab) => void;
}

// Interface for unmatched scene modal
interface UnmatchedSceneInfo {
  sceneNumber: string;
  character: Character;
  callSheetScene: CallSheetScene;
  suggestedMergeScenes: Scene[]; // Scenes that might be related (e.g., "15" for "15pt2")
}

export function Today({ onSceneSelect, onNavigateToTab }: TodayProps) {
  const { currentProject, updateSceneFilmingStatus: syncFilmingStatus, addScene, addCharacterToScene, addCharacterFromScene, setCurrentCharacter } = useProjectStore();
  const syncStatus = useSyncStore(state => state.status);

  // Subscribe to actual state values from call sheet store for proper reactivity
  const callSheets = useCallSheetStore(state => state.callSheets);
  const activeCallSheetId = useCallSheetStore(state => state.activeCallSheetId);
  const getCallSheetByDate = useCallSheetStore(state => state.getCallSheetByDate);
  const uploadCallSheet = useCallSheetStore(state => state.uploadCallSheet);
  const isUploading = useCallSheetStore(state => state.isUploading);
  const uploadError = useCallSheetStore(state => state.uploadError);
  // Get persistent update methods from callSheetStore
  // Note: filmingStatus is stored in projectStore only (single source of truth)
  const persistSceneStatus = useCallSheetStore(state => state.updateSceneStatus);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [isHmuCallsExpanded, setIsHmuCallsExpanded] = useState(false);
  // Track local scene modifications (status, order) separately from the base call sheet
  const [localSceneOverrides, setLocalSceneOverrides] = useState<Map<string, Partial<CallSheetScene>>>(new Map());

  // Derive the call sheet for the current date from the store
  // This ensures we always show scenes from the correct day's call sheet
  const callSheetForDate = useMemo(() => {
    const dateStr = currentDate.toISOString().split('T')[0];
    return getCallSheetByDate(dateStr);
  }, [currentDate, getCallSheetByDate, callSheets]); // Include callSheets to react to uploads

  // Get the active call sheet (most recently uploaded/selected)
  const activeCallSheet = useMemo(() => {
    if (!activeCallSheetId) {
      // Default to most recent call sheet by date
      const sorted = [...callSheets].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      return sorted[0] || null;
    }
    return callSheets.find(cs => cs.id === activeCallSheetId) || null;
  }, [callSheets, activeCallSheetId]);

  // Only show a call sheet that matches the selected date.
  // If none exists for that date, show the empty/upload state.
  const baseCallSheet = callSheetForDate;

  // Apply local scene overrides to the base call sheet
  const callSheet = useMemo(() => {
    if (!baseCallSheet) return null;
    if (localSceneOverrides.size === 0) return baseCallSheet;

    return {
      ...baseCallSheet,
      scenes: baseCallSheet.scenes.map(scene => {
        const override = localSceneOverrides.get(scene.sceneNumber);
        return override ? { ...scene, ...override } : scene;
      }),
    };
  }, [baseCallSheet, localSceneOverrides]);

  // Clear local overrides when the base call sheet changes (new upload)
  useEffect(() => {
    setLocalSceneOverrides(new Map());
  }, [baseCallSheet?.id]);

  // Sync current date to match the active call sheet when it changes
  useEffect(() => {
    if (activeCallSheet?.date) {
      setCurrentDate(new Date(activeCallSheet.date));
    }
  }, [activeCallSheet?.id, activeCallSheet?.date]);

  // State for scene script modal
  const [scriptModalScene, setScriptModalScene] = useState<Scene | null>(null);

  // State for unmatched scene modal (when scene from call sheet doesn't exist in breakdown)
  const [unmatchedSceneInfo, setUnmatchedSceneInfo] = useState<UnmatchedSceneInfo | null>(null);

  // File upload ref and handler
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      try {
        await uploadCallSheet(file);
      } catch (err) {
        console.error('Failed to upload call sheet:', err);
      }
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Navigate days - now properly loads call sheet for that date
  // Get call sheet dates sorted chronologically for arrow navigation
  const sortedCallSheetDates = useMemo(() => {
    return [...callSheets]
      .map(cs => cs.date)
      .sort((a, b) => a.localeCompare(b));
  }, [callSheets]);

  const navigateDay = (direction: -1 | 1) => {
    const currentDateStr = currentDate.toISOString().split('T')[0];

    if (sortedCallSheetDates.length === 0) return;

    // Find the nearest call sheet date in the given direction
    if (direction === -1) {
      const prev = sortedCallSheetDates.filter(d => d < currentDateStr).pop();
      if (prev) setCurrentDate(new Date(prev + 'T00:00:00'));
    } else {
      const next = sortedCallSheetDates.find(d => d > currentDateStr);
      if (next) setCurrentDate(new Date(next + 'T00:00:00'));
    }

    // Clear local overrides when navigating to a different day
    setLocalSceneOverrides(new Map());
  };

  // Sort scenes: In reorder mode, just by shootOrder. Otherwise In Progress → Upcoming → Wrapped
  const sortedScenes = useMemo(() => {
    if (!callSheet) return [];

    // In reorder mode, just sort by shoot order
    if (isReorderMode) {
      return [...callSheet.scenes].sort((a, b) => a.shootOrder - b.shootOrder);
    }

    // Normal mode: group by status, then by shoot order
    const statusOrder: Record<ShootingSceneStatus, number> = {
      'in-progress': 0,
      'upcoming': 1,
      'wrapped': 2,
    };
    return [...callSheet.scenes].sort((a, b) => {
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return a.shootOrder - b.shootOrder;
    });
  }, [callSheet, isReorderMode]);

  // Move scene up or down in the order
  const moveScene = (sceneNumber: string, direction: 'up' | 'down') => {
    if (!callSheet) return;

    const scenes = [...callSheet.scenes].sort((a, b) => a.shootOrder - b.shootOrder);
    const currentIndex = scenes.findIndex(s => s.sceneNumber === sceneNumber);

    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === scenes.length - 1) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    // Swap shoot orders using local overrides
    const currentOrder = scenes[currentIndex].shootOrder;
    const swapOrder = scenes[swapIndex].shootOrder;
    const swapSceneNumber = scenes[swapIndex].sceneNumber;

    setLocalSceneOverrides(prev => {
      const next = new Map(prev);
      const currentOverride = next.get(sceneNumber) || {};
      const swapOverride = next.get(swapSceneNumber) || {};
      next.set(sceneNumber, { ...currentOverride, shootOrder: swapOrder });
      next.set(swapSceneNumber, { ...swapOverride, shootOrder: currentOrder });
      return next;
    });
  };

  // Pre-compute scene data maps for efficient lookups
  // This avoids repeated .find() calls during render loops

  // Map: sceneNumber -> Scene
  const sceneDataMap = useMemo(() => {
    if (!currentProject) return new Map<string, Scene>();
    return new Map(currentProject.scenes.map(s => [s.sceneNumber, s]));
  }, [currentProject?.scenes]);

  // Map: characterId -> Character (for quick lookups)
  const characterMap = useMemo(() => {
    if (!currentProject) return new Map<string, Character>();
    return new Map(currentProject.characters.map(c => [c.id, c]));
  }, [currentProject?.characters]);

  // Map: sceneNumber -> Character[] (pre-computed character assignments)
  const sceneCharactersMap = useMemo(() => {
    if (!currentProject) return new Map<string, Character[]>();
    const map = new Map<string, Character[]>();
    for (const scene of currentProject.scenes) {
      const characters = scene.characters
        .map(charId => characterMap.get(charId))
        .filter((c): c is Character => c !== undefined);
      map.set(scene.sceneNumber, characters);
    }
    return map;
  }, [currentProject?.scenes, characterMap]);

  // Map: "characterId-sceneNumber" -> Look (pre-computed look assignments)
  const characterLookMap = useMemo(() => {
    if (!currentProject) return new Map<string, Look>();
    const map = new Map<string, Look>();
    for (const look of currentProject.looks) {
      for (const sceneNum of look.scenes) {
        map.set(`${look.characterId}-${sceneNum}`, look);
      }
    }
    return map;
  }, [currentProject?.looks]);

  // Map: "actorNumber-sceneNumber" -> Look (lookup by cast number as fallback)
  // This enables linking looks to characters from call sheet cast data
  const actorNumberLookMap = useMemo(() => {
    if (!currentProject) return new Map<string, Look>();
    const map = new Map<string, Look>();
    for (const look of currentProject.looks) {
      // Find the character to get their actorNumber
      const char = characterMap.get(look.characterId);
      if (char?.actorNumber) {
        for (const sceneNum of look.scenes) {
          map.set(`${char.actorNumber}-${sceneNum}`, look);
        }
      }
    }
    return map;
  }, [currentProject?.looks, characterMap]);

  // Map: cast ID (from call sheet) -> CastCall info
  // This allows us to look up character names from cast numbers in scenes
  const castCallMap = useMemo(() => {
    if (!callSheet?.castCalls) return new Map<string, { id: string; name: string; character?: string }>();
    return new Map(callSheet.castCalls.map(cast => [cast.id, cast]));
  }, [callSheet?.castCalls]);

  // Map: sceneNumber -> Character[] from call sheet cast (for scenes without confirmed characters)
  // Creates temporary Character objects from call sheet cast data
  const sceneCastFromCallSheet = useMemo(() => {
    if (!callSheet) return new Map<string, Character[]>();
    const map = new Map<string, Character[]>();

    for (const scene of callSheet.scenes) {
      if (!scene.cast || scene.cast.length === 0) continue;

      const characters: Character[] = [];
      for (const castId of scene.cast) {
        const castCall = castCallMap.get(castId);
        if (castCall) {
          // Create a Character object from the call sheet cast data
          // Use character name if available, otherwise actor name
          const name = castCall.character || castCall.name || `Cast #${castId}`;
          const initials = name
            .split(' ')
            .map(word => word.charAt(0).toUpperCase())
            .join('')
            .slice(0, 2);

          characters.push({
            id: `cast-${castId}`,
            name,
            initials,
            actorNumber: parseInt(castId, 10) || undefined,
          });
        } else {
          // No cast call info, just use the ID
          characters.push({
            id: `cast-${castId}`,
            name: `Cast #${castId}`,
            initials: castId.slice(0, 2),
            actorNumber: parseInt(castId, 10) || undefined,
          });
        }
      }
      map.set(scene.sceneNumber, characters);
    }
    return map;
  }, [callSheet?.scenes, castCallMap]);

  // Fast lookup functions using pre-computed maps
  // Improved scene lookup that handles combined scene numbers like "32/32B"
  const getSceneData = (sceneNumber: string): Scene | undefined => {
    // First try exact match
    const exact = sceneDataMap.get(sceneNumber);
    if (exact) return exact;

    // Try matching any component of a combined scene number
    const parts = splitCombinedSceneNumber(sceneNumber);
    for (const part of parts) {
      const match = sceneDataMap.get(part);
      if (match) return match;
    }

    return undefined;
  };

  // Find a project character by name (flexible matching)
  // Tries: exact match, first name match, contains match
  const findProjectCharacterByName = (name: string): Character | undefined => {
    if (!currentProject || !name) return undefined;
    const normalizedName = name.toUpperCase().trim();

    // First try exact match
    const exact = currentProject.characters.find(c =>
      c.name.toUpperCase().trim() === normalizedName
    );
    if (exact) return exact;

    // Try first name match (call sheet might have just "CARA", project has "CARA SMITH")
    const firstNameMatch = currentProject.characters.find(c => {
      const charFirstName = c.name.toUpperCase().trim().split(' ')[0];
      return charFirstName === normalizedName;
    });
    if (firstNameMatch) return firstNameMatch;

    // Try if project character name starts with the search name
    const startsWithMatch = currentProject.characters.find(c =>
      c.name.toUpperCase().trim().startsWith(normalizedName + ' ')
    );
    if (startsWithMatch) return startsWithMatch;

    // Try if search name contains the project character's first name
    const containsMatch = currentProject.characters.find(c => {
      const charFirstName = c.name.toUpperCase().trim().split(' ')[0];
      return normalizedName.includes(charFirstName) && charFirstName.length > 2;
    });
    if (containsMatch) return containsMatch;

    return undefined;
  };

  // Get characters for a scene - prefers confirmed project characters, falls back to call sheet cast
  // Also tries to link call sheet cast to existing project characters by name
  const getCharactersInScene = (sceneNumber: string): Character[] => {
    // First try exact scene match
    const confirmedChars = sceneCharactersMap.get(sceneNumber) || [];
    if (confirmedChars.length > 0) return confirmedChars;

    // Try matching via combined scene components (e.g., "32/32B" -> check "32" and "32B")
    const parts = splitCombinedSceneNumber(sceneNumber);
    for (const part of parts) {
      const partChars = sceneCharactersMap.get(part) || [];
      if (partChars.length > 0) return partChars;
    }

    // Fall back to call sheet cast data, but try to link to project characters by name
    const callSheetChars = sceneCastFromCallSheet.get(sceneNumber) || [];
    if (callSheetChars.length > 0) {
      return callSheetChars.map(char => {
        // Try to find matching project character by name
        const projectChar = findProjectCharacterByName(char.name);
        if (projectChar) {
          // Return project character with actorNumber from call sheet for look matching
          return { ...projectChar, actorNumber: char.actorNumber };
        }
        return char;
      });
    }

    return [];
  };
  // Get look for a character in a scene - tries multiple matching strategies
  // Handles combined scenes and part scenes by also checking base scene numbers
  const getLookForCharacter = (characterId: string, sceneNumber: string, actorNumber?: number) => {
    // Get all possible scene numbers to check (includes base scenes like "15" from "15pt2")
    const scenesToCheck = splitCombinedSceneNumber(sceneNumber);

    // Try characterId lookup for each possible scene
    for (const scene of scenesToCheck) {
      const lookById = characterLookMap.get(`${characterId}-${scene}`);
      if (lookById) return lookById;
    }

    // Fall back to actorNumber lookup for each possible scene
    if (actorNumber) {
      for (const scene of scenesToCheck) {
        const lookByActor = actorNumberLookMap.get(`${actorNumber}-${scene}`);
        if (lookByActor) return lookByActor;
      }
    }

    // Final fallback: find any look for this character (for unmatched scenes)
    if (currentProject && !characterId.startsWith('cast-')) {
      return currentProject.looks.find(l => l.characterId === characterId);
    }

    return undefined;
  };

  // Pre-compute filtered and sorted HMU calls to avoid recalculating on each render
  const sortedHmuCalls = useMemo(() => {
    if (!callSheet?.castCalls) return [];
    return callSheet.castCalls
      .filter(cast => cast.hmuCall || cast.makeupCall)
      .sort((a, b) => {
        const timeA = a.hmuCall || a.makeupCall || '';
        const timeB = b.hmuCall || b.makeupCall || '';
        return timeA.localeCompare(timeB);
      });
  }, [callSheet?.castCalls]);

  // Calculate schedule status - compares predicted vs actual completion times
  const scheduleStatus = useMemo(() => {
    if (!callSheet?.scenes || !callSheet.firstShotTime) {
      return null;
    }

    // Parse time string (HH:MM or H:MM) to minutes since midnight
    const parseTimeToMinutes = (timeStr: string): number | null => {
      const match = timeStr.match(/(\d{1,2}):(\d{2})/);
      if (!match) return null;
      return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    };

    // Get scenes sorted by shoot order
    const sortedScenes = [...callSheet.scenes].sort((a, b) => a.shootOrder - b.shootOrder);
    const completedScenes = sortedScenes.filter(s => s.status === 'wrapped' && s.completedAt);

    if (completedScenes.length === 0) {
      return { status: 'not-started' as const, completedCount: 0, totalCount: callSheet.scenes.length };
    }

    // Get the last completed scene
    const lastCompleted = completedScenes[completedScenes.length - 1];

    // Check if we finished ahead: compare last completed scene's actual time vs expected END time
    let expectedEndMinutes: number | null = null;
    if (lastCompleted.estimatedTime) {
      const endTimeMatch = lastCompleted.estimatedTime.match(/-\s*(\d{1,2}:\d{2})/);
      if (endTimeMatch) {
        expectedEndMinutes = parseTimeToMinutes(endTimeMatch[1]);
      }
    }

    // Get actual completion time from the completedAt timestamp
    const completedAt = new Date(lastCompleted.completedAt!);
    const completionMinutes = completedAt.getHours() * 60 + completedAt.getMinutes();

    // If we finished before expected end time, we're ahead
    if (expectedEndMinutes !== null && completionMinutes < expectedEndMinutes - 2) {
      const aheadMinutes = expectedEndMinutes - completionMinutes;
      return {
        status: 'ahead' as const,
        diffMinutes: aheadMinutes,
        completedCount: completedScenes.length,
        totalCount: callSheet.scenes.length,
      };
    }

    // Find the next upcoming scene (first scene not wrapped)
    const nextScene = sortedScenes.find(s => s.status !== 'wrapped');

    if (!nextScene) {
      // All scenes completed
      return { status: 'completed' as const, completedCount: completedScenes.length, totalCount: callSheet.scenes.length };
    }

    // Get next scene's expected START time
    let nextStartMinutes: number | null = null;
    if (nextScene.estimatedTime) {
      const startTimeMatch = nextScene.estimatedTime.match(/^(\d{1,2}:\d{2})/);
      if (startTimeMatch) {
        nextStartMinutes = parseTimeToMinutes(startTimeMatch[1]);
      }
    }

    // If no expected time for next scene, we can't calculate behind status
    if (nextStartMinutes === null) {
      return { status: 'unknown' as const, completedCount: completedScenes.length, totalCount: callSheet.scenes.length };
    }

    // Get current time
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // Only show "behind" if the next scene's start time has passed
    if (nowMinutes > nextStartMinutes + 2) {
      const behindMinutes = nowMinutes - nextStartMinutes;
      return {
        status: 'behind' as const,
        diffMinutes: behindMinutes,
        completedCount: completedScenes.length,
        totalCount: callSheet.scenes.length,
      };
    }

    // We're not ahead and not behind - just show scene count
    return { status: 'on-track' as const, completedCount: completedScenes.length, totalCount: callSheet.scenes.length };
  }, [callSheet?.scenes, callSheet?.firstShotTime]);

  // Update scene status - persists to store and updates local state for immediate UI feedback
  const updateSceneStatus = (sceneNumber: string, status: ShootingSceneStatus) => {
    if (!baseCallSheet) return;
    // Update local overrides for immediate UI feedback
    setLocalSceneOverrides(prev => {
      const next = new Map(prev);
      const existing = next.get(sceneNumber) || {};
      next.set(sceneNumber, { ...existing, status });
      return next;
    });
    // Persist to callSheetStore so changes survive navigation
    persistSceneStatus(baseCallSheet.id, sceneNumber, status);
  };

  // Update scene filming status - stored in projectStore as single source of truth
  // Also marks scene as 'wrapped' in the call sheet (day-specific shooting status)
  const updateSceneFilmingStatus = (
    sceneNumber: string,
    filmingStatus: SceneFilmingStatus,
    filmingNotes?: string
  ) => {
    if (!baseCallSheet) return;
    // Update local overrides for immediate UI feedback - only shooting status (day-specific)
    // filmingStatus is read from projectStore, not stored in local overrides
    setLocalSceneOverrides(prev => {
      const next = new Map(prev);
      const existing = next.get(sceneNumber) || {};
      next.set(sceneNumber, { ...existing, status: 'wrapped' as ShootingSceneStatus });
      return next;
    });
    // Persist shooting status to callSheetStore (wrapped status is day-specific)
    persistSceneStatus(baseCallSheet.id, sceneNumber, 'wrapped');
    // Update filming status in project store (single source of truth)
    syncFilmingStatus(sceneNumber, filmingStatus, filmingNotes);
  };

  // Handle scene tap - improved to handle combined scenes
  const handleSceneTap = (sceneNumber: string) => {
    const scene = getSceneData(sceneNumber);
    if (scene) {
      onSceneSelect(scene.id);
    }
  };

  // Handle character tap - navigate to continuity tracking for this character
  // Works even when scene doesn't match by finding a valid scene for the character
  // For unmatched scenes, shows modal to add scene or merge with existing
  // For call-sheet-only characters (cast- prefix), creates them in the project first
  const handleCharacterTap = (character: Character, callSheetSceneNumber: string, callSheetScene: CallSheetScene) => {
    const isCastOnlyCharacter = character.id.startsWith('cast-');

    // First try to find a matching scene from the call sheet
    const matchedScene = getSceneData(callSheetSceneNumber);
    if (matchedScene) {
      if (isCastOnlyCharacter) {
        // Character is from call sheet only - create them in the project and add to the scene
        const newChar = addCharacterFromScene(matchedScene.id, character.name);
        // Also copy actorNumber from call sheet data
        if (character.actorNumber) {
          // Update the character with actor number via store
          const store = useProjectStore.getState();
          if (store.currentProject) {
            const updatedChars = store.currentProject.characters.map(c =>
              c.id === newChar.id ? { ...c, actorNumber: character.actorNumber } : c
            );
            useProjectStore.setState({
              currentProject: { ...store.currentProject, characters: updatedChars }
            });
          }
        }
        addCharacterToScene(matchedScene.id, newChar.id);
        setCurrentCharacter(newChar.id);
      } else {
        // Ensure character is set as current before navigating
        setCurrentCharacter(character.id);
      }
      // Navigate to the matched scene
      onSceneSelect(matchedScene.id);
      return;
    }

    // Scene doesn't exist in breakdown - find suggested scenes to merge with
    // Look for scenes with similar numbers (e.g., "15" for "15pt2")
    const suggestedMergeScenes: Scene[] = [];
    if (currentProject) {
      const possibleNumbers = splitCombinedSceneNumber(callSheetSceneNumber);
      // Find scenes that might be related (same base number)
      for (const scene of currentProject.scenes) {
        const sceneNumbers = splitCombinedSceneNumber(scene.sceneNumber);
        // Check if any of the possible numbers match
        const hasMatch = possibleNumbers.some(pn =>
          sceneNumbers.some(sn => sn === pn || sn.startsWith(pn) || pn.startsWith(sn))
        );
        if (hasMatch && !suggestedMergeScenes.includes(scene)) {
          suggestedMergeScenes.push(scene);
        }
      }
    }

    // For cast-only characters with no matching scene, we need to handle creating both
    // the character and the scene via the unmatched scene modal
    if (isCastOnlyCharacter) {
      // Create the character first so the modal can reference a real character
      let resolvedCharacter = character;
      if (currentProject) {
        // Check if there's already a project character with this name
        const existing = findProjectCharacterByName(character.name);
        if (existing) {
          resolvedCharacter = existing;
        }
      }
      setUnmatchedSceneInfo({
        sceneNumber: callSheetSceneNumber,
        character: resolvedCharacter,
        callSheetScene,
        suggestedMergeScenes,
      });
      return;
    }

    // Show the unmatched scene modal
    setUnmatchedSceneInfo({
      sceneNumber: callSheetSceneNumber,
      character,
      callSheetScene,
      suggestedMergeScenes,
    });
  };

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      {/* Hidden file input for call sheet upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center justify-between">
            {/* Date navigation - steps through uploaded call sheet dates */}
            <div className="flex items-center gap-3">
              {(() => {
                const dateStr = currentDate.toISOString().split('T')[0];
                const hasPrev = sortedCallSheetDates.some(d => d < dateStr);
                const hasNext = sortedCallSheetDates.some(d => d > dateStr);
                return (
                  <>
                    <button
                      onClick={() => navigateDay(-1)}
                      disabled={!hasPrev}
                      className="p-2 -ml-2 text-text-muted active:text-gold transition-colors touch-manipulation disabled:opacity-25 disabled:active:text-text-muted"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <h1 className="text-lg font-semibold text-text-primary">{formatShortDate(currentDate)}</h1>
                    <button
                      onClick={() => navigateDay(1)}
                      disabled={!hasNext}
                      className="p-2 text-text-muted active:text-gold transition-colors touch-manipulation disabled:opacity-25 disabled:active:text-text-muted"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </>
                );
              })()}
            </div>

            {/* Upload button, Reorder button, and Production day badge */}
            <div className="flex items-center gap-2">
              {/* Upload call sheet button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gold active:opacity-70 transition-opacity touch-manipulation"
                disabled={isUploading}
                title="Upload call sheet"
              >
                {isUploading ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                )}
              </button>
              {callSheet && (
                <>
                  <button
                    onClick={() => setIsReorderMode(!isReorderMode)}
                    className={clsx(
                      'p-2 rounded-lg transition-colors touch-manipulation',
                      isReorderMode
                        ? 'bg-gold text-white'
                        : 'text-text-muted hover:text-gold'
                    )}
                    title={isReorderMode ? 'Done reordering' : 'Reorder scenes'}
                  >
                    {isReorderMode ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => onNavigateToTab?.('callsheets')}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-gold-100 text-gold active:bg-gold-200 transition-colors"
                    title="View call sheet PDF"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Day {callSheet.productionDay}
                  </button>
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      <div className="mobile-container px-4 py-4 space-y-4">
        {/* Upload error message */}
        {uploadError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{uploadError}</p>
          </div>
        )}

        {callSheet ? (
          <>
            {/* Call Sheet Summary Card */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light">
                  CALL TIMES
                </h2>
              </div>

              {/* Working Day Type Badge + Schedule Status */}
              {(() => {
                const dayTypeAbbrev = parseDayTypeFromString(callSheet.dayType);
                return (
                  <div className="mb-3 pb-3 border-b border-border/50 flex items-center justify-between">
                    <span className={clsx(
                      'px-2 py-0.5 text-xs font-bold rounded',
                      dayTypeAbbrev === 'CWD' && 'bg-amber-100 text-amber-700',
                      dayTypeAbbrev === 'SCWD' && 'bg-orange-100 text-orange-700',
                      dayTypeAbbrev === 'SWD' && 'bg-blue-100 text-blue-700'
                    )}>
                      {dayTypeAbbrev}
                    </span>
                    {/* Schedule Status Indicator - only show ahead or behind */}
                    {scheduleStatus && (scheduleStatus.status === 'ahead' || scheduleStatus.status === 'behind') && (
                      <div className={clsx(
                        'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
                        scheduleStatus.status === 'ahead' && 'bg-blue-50 text-blue-600',
                        scheduleStatus.status === 'behind' && 'bg-red-50 text-red-600'
                      )}>
                        {scheduleStatus.status === 'ahead' && (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                            <span>{formatDuration(scheduleStatus.diffMinutes)} ahead</span>
                          </>
                        )}
                        {scheduleStatus.status === 'behind' && (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                            <span>{formatDuration(scheduleStatus.diffMinutes)} behind</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">Unit Call</span>
                  <span className="text-sm font-semibold text-text-primary">{callSheet.unitCallTime}</span>
                </div>
                {callSheet.preCalls?.hmu && (
                  <div className="flex justify-between">
                    <span className="text-sm text-text-muted">HMU Pre-call</span>
                    <span className="text-sm font-semibold text-gold">{callSheet.preCalls.hmu}</span>
                  </div>
                )}
                {callSheet.firstShotTime && (
                  <div className="flex justify-between">
                    <span className="text-sm text-text-muted">First Shot</span>
                    <span className="text-sm font-semibold text-text-primary">{callSheet.firstShotTime}</span>
                  </div>
                )}
                {callSheet.lunchTime && (
                  <div className="flex justify-between">
                    <span className="text-sm text-text-muted">Lunch</span>
                    <span className="text-sm font-semibold text-text-primary">{callSheet.lunchTime}</span>
                  </div>
                )}
                {callSheet.cameraWrapEstimate && (
                  <div className="flex justify-between">
                    <span className="text-sm text-text-muted">Camera Wrap</span>
                    <span className="text-sm font-semibold text-text-primary">{callSheet.cameraWrapEstimate}</span>
                  </div>
                )}
                {callSheet.wrapEstimate && (
                  <div className="flex justify-between">
                    <span className="text-sm text-text-muted">Est. Wrap</span>
                    <span className="text-sm font-semibold text-text-primary">{callSheet.wrapEstimate}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Cast HMU Calls - collapsible to save space for continuity tracking */}
            {sortedHmuCalls.length > 0 && (
              <div className="card">
                <button
                  onClick={() => setIsHmuCallsExpanded(!isHmuCallsExpanded)}
                  className="w-full flex items-center justify-between touch-manipulation"
                >
                  <div className="flex items-center gap-2">
                    <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light">
                      HMU CALLS
                    </h2>
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-gold-100 text-gold">
                      {sortedHmuCalls.length}
                    </span>
                  </div>
                  <svg
                    className={clsx(
                      'w-4 h-4 text-text-muted transition-transform',
                      isHmuCallsExpanded && 'rotate-180'
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isHmuCallsExpanded && (
                  <div className="space-y-2 mt-3 pt-3 border-t border-border/30">
                    {sortedHmuCalls.map(cast => (
                      <div key={cast.id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-text-primary truncate block">
                            {cast.character}
                          </span>
                          <span className="text-xs text-text-muted truncate block">
                            {cast.name}
                          </span>
                        </div>
                        <div className="text-right ml-3">
                          <span className="text-sm font-semibold text-gold">
                            {cast.hmuCall || cast.makeupCall}
                          </span>
                          {cast.onSetTime && (
                            <span className="text-xs text-text-muted block">
                              On set: {cast.onSetTime}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Scenes Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold tracking-wider uppercase text-text-light">
                TODAY'S SCENES ({sortedScenes.length})
              </h2>
            </div>

            {/* Reorder mode header */}
            {isReorderMode && (
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-text-muted">Drag to reorder shooting schedule</p>
                <button
                  onClick={() => setIsReorderMode(false)}
                  className="text-sm font-medium text-gold"
                >
                  Done
                </button>
              </div>
            )}

            {/* Scenes List */}
            <div className="space-y-2.5">
              {sortedScenes.map((shootingScene, index) => {
                const scene = getSceneData(shootingScene.sceneNumber);
                const characters = getCharactersInScene(shootingScene.sceneNumber);

                return (
                  <TodaySceneCard
                    key={shootingScene.sceneNumber}
                    shootingScene={shootingScene}
                    scene={scene}
                    characters={characters}
                    getLookForCharacter={getLookForCharacter}
                    onTap={() => handleSceneTap(shootingScene.sceneNumber)}
                    onCharacterTap={(char) => handleCharacterTap(char, shootingScene.sceneNumber, shootingScene)}
                    onSynopsisClick={(scene) => setScriptModalScene(scene)}
                    onStatusChange={(status) => updateSceneStatus(shootingScene.sceneNumber, status)}
                    onFilmingStatusChange={(filmingStatus, notes) =>
                      updateSceneFilmingStatus(shootingScene.sceneNumber, filmingStatus, notes)
                    }
                    isReorderMode={isReorderMode}
                    isFirst={index === 0}
                    isLast={index === sortedScenes.length - 1}
                    onMoveUp={() => moveScene(shootingScene.sceneNumber, 'up')}
                    onMoveDown={() => moveScene(shootingScene.sceneNumber, 'down')}
                  />
                );
              })}
            </div>
          </>
        ) : (
          /* Empty State - shown when no call sheet is uploaded */
          <EmptyState
            hasAnyCallSheets={callSheets.length > 0}
            onUploadClick={() => fileInputRef.current?.click()}
            isUploading={isUploading}
            isSyncing={syncStatus === 'uploading' || syncStatus === 'downloading'}
            hasProjectData={!!currentProject && currentProject.scenes.length > 0}
          />
        )}
      </div>

      {/* Scene Script Modal */}
      {scriptModalScene && (
        <SceneScriptModal
          scene={scriptModalScene}
          onClose={() => setScriptModalScene(null)}
        />
      )}

      {/* Unmatched Scene Modal - shown when tapping character in scene that doesn't exist in breakdown */}
      {unmatchedSceneInfo && (
        <UnmatchedSceneModal
          info={unmatchedSceneInfo}
          onClose={() => setUnmatchedSceneInfo(null)}
          onAddScene={(sceneData) => {
            // Create new scene in breakdown
            const newScene = addScene(sceneData);
            // Add the character to this scene
            addCharacterToScene(newScene.id, unmatchedSceneInfo.character.id);
            // Close modal and navigate to the new scene
            setUnmatchedSceneInfo(null);
            onSceneSelect(newScene.id);
          }}
          onMergeWithScene={(targetScene) => {
            // Add character to existing scene if not already there
            if (!targetScene.characters.includes(unmatchedSceneInfo.character.id)) {
              addCharacterToScene(targetScene.id, unmatchedSceneInfo.character.id);
            }
            // Close modal and navigate to that scene
            setUnmatchedSceneInfo(null);
            onSceneSelect(targetScene.id);
          }}
        />
      )}
    </div>
  );
}

// Scene Card Component - memoized to prevent unnecessary re-renders in list
interface TodaySceneCardProps {
  shootingScene: CallSheetScene;
  scene?: Scene;
  characters: Character[];
  getLookForCharacter: (characterId: string, sceneNumber: string, actorNumber?: number) => Look | null | undefined;
  onTap: () => void;
  onCharacterTap: (character: Character) => void;
  onSynopsisClick: (scene: Scene) => void;
  onStatusChange: (status: ShootingSceneStatus) => void;
  onFilmingStatusChange: (status: SceneFilmingStatus, notes?: string) => void;
  // Reorder mode props
  isReorderMode?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

const TodaySceneCard = memo(function TodaySceneCard({
  shootingScene,
  scene,
  characters,
  getLookForCharacter,
  onTap,
  onCharacterTap,
  onSynopsisClick,
  onStatusChange,
  onFilmingStatusChange,
  isReorderMode = false,
  isFirst = false,
  isLast = false,
  onMoveUp,
  onMoveDown,
}: TodaySceneCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [showFilmingStatusModal, setShowFilmingStatusModal] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [notesInput, setNotesInput] = useState(scene?.filmingNotes || '');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Parse INT/EXT and time of day from setDescription when no scene data
  const parsedSceneInfo = useMemo(() => {
    if (scene) return null; // Use actual scene data if available
    const desc = shootingScene.setDescription || '';
    // Parse patterns like "INT. COFFEE SHOP - DAY" or "EXT. PARK - NIGHT"
    const intExtMatch = desc.match(/^(INT|EXT)\./i);
    const timeMatch = desc.match(/- (DAY|NIGHT|MORNING|EVENING|DUSK|DAWN|CONTINUOUS)$/i);
    const locationMatch = desc.match(/^(?:INT|EXT)\.\s*(.+?)(?:\s*-\s*(?:DAY|NIGHT|MORNING|EVENING|DUSK|DAWN|CONTINUOUS))?$/i);
    return {
      intExt: intExtMatch ? intExtMatch[1].toUpperCase() : null,
      timeOfDay: timeMatch ? timeMatch[1].toUpperCase() : null,
      location: locationMatch ? locationMatch[1].trim() : desc,
    };
  }, [scene, shootingScene.setDescription]);

  // Get the glass overlay class based on filming status (from project scene - single source of truth)
  const filmingStatus = scene?.filmingStatus;
  const filmingNotes = scene?.filmingNotes;

  const getGlassOverlayClass = () => {
    if (!filmingStatus) return null;
    switch (filmingStatus) {
      case 'complete':
        return 'scene-glass-complete';
      case 'partial':
        return 'scene-glass-partial';
      case 'not-filmed':
        return 'scene-glass-incomplete';
      default:
        return null;
    }
  };

  const glassOverlayClass = getGlassOverlayClass();

  const statusLabels: Record<ShootingSceneStatus, string> = {
    'upcoming': 'Upcoming',
    'in-progress': 'In Progress',
    'wrapped': 'Wrapped',
  };

  // Get status badge styling - uses filming status from project scene (single source of truth)
  const getStatusBadge = () => {
    if (filmingStatus) {
      const config = SCENE_FILMING_STATUS_CONFIG[filmingStatus];
      return {
        bg: config.bgClass,
        text: config.textClass,
        label: config.shortLabel,
        color: config.color,
      };
    }
    const statusColors: Record<ShootingSceneStatus, { bg: string; text: string; color: string }> = {
      'upcoming': { bg: 'bg-gray-100', text: 'text-text-muted', color: '#6b7280' },
      'in-progress': { bg: 'bg-gold-100/50', text: 'text-gold', color: '#C9A962' },
      'wrapped': { bg: 'bg-green-50', text: 'text-green-600', color: '#22c55e' },
    };
    return { ...statusColors[shootingScene.status], label: statusLabels[shootingScene.status] };
  };

  const statusBadge = getStatusBadge();

  // Long press handler
  const handleLongPress = () => {
    setShowActions(true);
  };

  // Handle filming status selection from dropdown
  const handleStatusSelect = (status: SceneFilmingStatus) => {
    if (status === 'not-filmed' || status === 'partial') {
      // Show notes modal for partial/incomplete
      setShowFilmingStatusModal(true);
      setShowStatusDropdown(false);
    } else {
      onFilmingStatusChange(status);
      setShowStatusDropdown(false);
    }
  };

  // Handle filming status selection with notes
  const handleFilmingStatusSelect = (status: SceneFilmingStatus) => {
    onFilmingStatusChange(status, notesInput);
    setShowFilmingStatusModal(false);
    setShowActions(false);
  };

  return (
    <>
      {/* Container needs z-index when dropdown is open to ensure dropdown appears above other cards */}
      <div className={clsx('relative', showStatusDropdown && 'z-40')}>
        {/* Reorder mode controls */}
        {isReorderMode && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp?.();
              }}
              disabled={isFirst}
              className={clsx(
                'p-2 rounded-lg transition-all touch-manipulation',
                isFirst
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-text-muted hover:text-gold hover:bg-gold/10 active:scale-95'
              )}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown?.();
              }}
              disabled={isLast}
              className={clsx(
                'p-2 rounded-lg transition-all touch-manipulation',
                isLast
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-text-muted hover:text-gold hover:bg-gold/10 active:scale-95'
              )}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}

        <div
          onClick={isReorderMode ? undefined : onTap}
          onContextMenu={(e) => {
            if (isReorderMode) return;
            e.preventDefault();
            handleLongPress();
          }}
          className={clsx(
            'w-full text-left card transition-all relative',
            // Only apply overflow-hidden when dropdown is closed to prevent clipping
            !showStatusDropdown && 'overflow-hidden',
            isReorderMode ? 'pr-16' : 'active:scale-[0.98] cursor-pointer'
          )}
        >
          {/* Glass overlay - positioned inside card to cover entire pill */}
          {glassOverlayClass && (
            <div className={clsx('scene-glass-overlay', glassOverlayClass)} />
          )}

          {/* Status accent bar on left edge - sophisticated gradient */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-card"
            style={{
              background: shootingScene.status === 'in-progress'
                ? 'linear-gradient(180deg, #d4a853 0%, #c9a962 100%)' // Gold gradient
                : shootingScene.status === 'wrapped'
                  ? filmingStatus === 'complete'
                    ? 'linear-gradient(180deg, #10b981 0%, #059669 100%)' // Emerald gradient
                    : filmingStatus === 'partial'
                      ? 'linear-gradient(180deg, #d4a853 0%, #c9a962 100%)' // Warm gold gradient
                      : filmingStatus === 'not-filmed'
                        ? 'linear-gradient(180deg, #f87171 0%, #ef4444 100%)' // Soft red gradient
                        : 'linear-gradient(180deg, #d1d5db 0%, #9ca3af 100%)' // Gray gradient
                  : 'transparent' // No bar for upcoming
            }}
          />

          {/* Card content - positioned above glass overlay */}
          <div className="relative z-10 pl-2">
            {/* Top row: Scene number + Status dropdown only */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xl font-bold text-text-primary">
                {shootingScene.sceneNumber}
              </span>

              {/* Status Dropdown */}
              <div ref={dropdownRef} className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowStatusDropdown(!showStatusDropdown);
                  }}
                  className="status-dropdown-btn touch-manipulation"
                  style={{ borderColor: filmingStatus ? statusBadge.color : undefined }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: statusBadge.color }}
                  />
                  <span className={statusBadge.text}>{statusBadge.label}</span>
                  <svg className={clsx('w-3 h-3 text-text-muted transition-transform', showStatusDropdown && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {/* Dropdown menu */}
                {showStatusDropdown && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden animate-fadeIn">
                    {(['complete', 'partial', 'not-filmed'] as SceneFilmingStatus[]).map((status) => {
                      const config = SCENE_FILMING_STATUS_CONFIG[status];
                      const isSelected = filmingStatus === status;
                      return (
                        <button
                          key={status}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusSelect(status);
                          }}
                          className={clsx(
                            'w-full px-3 py-2.5 text-left text-sm flex items-center gap-2.5 transition-colors',
                            isSelected ? config.bgClass : 'hover:bg-gray-50'
                          )}
                        >
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: config.color }}
                          />
                          <span className={clsx('font-medium', isSelected && config.textClass)}>
                            {config.label}
                          </span>
                          {isSelected && (
                            <svg className={clsx('w-4 h-4 ml-auto', config.textClass)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Scene metadata row - smaller badges with proper spacing */}
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              {/* INT/EXT badge */}
              {(scene?.intExt || parsedSceneInfo?.intExt) && (
                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                  (scene?.intExt || parsedSceneInfo?.intExt) === 'INT'
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-stone-100 text-stone-600'
                }`}>
                  {scene?.intExt || parsedSceneInfo?.intExt}
                </span>
              )}
              {/* Day/Night indicator */}
              {shootingScene.dayNight && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-700">
                  {shootingScene.dayNight}
                </span>
              )}
              {/* Pages badge */}
              {shootingScene.pages && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-text-muted">
                  {shootingScene.pages} pgs
                </span>
              )}
              {/* Estimated timing */}
              {shootingScene.estimatedTime && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-600">
                  {shootingScene.estimatedTime}
                </span>
              )}
            </div>

            {/* Set description / Location */}
            {shootingScene.setDescription && (
              <p className="text-sm font-medium text-text-primary mb-1">
                {shootingScene.setDescription}
              </p>
            )}

            {/* Action/Log line - what happens in the scene */}
            {(shootingScene.action || scene?.synopsis) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (scene) onSynopsisClick(scene);
                }}
                className="w-full text-left group"
                disabled={!scene?.scriptContent}
              >
                <p className={clsx(
                  'text-xs text-text-muted italic line-clamp-2',
                  scene?.scriptContent && 'group-hover:text-gold transition-colors'
                )}>
                  {shootingScene.action || scene?.synopsis}
                </p>
                {scene?.scriptContent && (
                  <span className="text-[10px] text-gold flex items-center gap-1 mt-0.5">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Tap to view full scene
                  </span>
                )}
              </button>
            )}

            {/* Notes (HMU, VFX, SFX, etc.) - highlighted */}
            {shootingScene.notes && (
              <div className="mt-2 px-2.5 py-2 rounded-lg bg-gold-50 border border-gold-100">
                <div className="text-xs text-gold-700 font-medium leading-relaxed">
                  {shootingScene.notes}
                </div>
              </div>
            )}

            {/* Filming notes if partial or incomplete */}
            {filmingStatus && filmingStatus !== 'complete' && filmingNotes && (
              <div className={clsx(
                'mt-2 px-2.5 py-2 rounded-lg text-xs',
                filmingStatus === 'partial' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-red-50 text-red-700 border border-red-100'
              )}>
                <span className="font-medium">Note:</span> {filmingNotes}
              </div>
            )}

            {/* Characters with looks */}
            {characters.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-border/50">
                {characters.map((char) => {
                  const look = getLookForCharacter(char.id, shootingScene.sceneNumber, char.actorNumber);
                  const bgColor = char.avatarColour ?? '#C9A962';
                  return (
                    <button
                      key={char.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCharacterTap(char);
                      }}
                      className="flex items-center gap-1 rounded-full pl-0.5 pr-2 py-0.5 transition-colors bg-gray-50 hover:bg-gold/10 active:bg-gold/20 cursor-pointer"
                    >
                      {/* Cast number in colored circle */}
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: bgColor }}
                      >
                        {char.actorNumber || char.initials}
                      </div>
                      <span className="text-[11px] font-medium text-text-primary">{char.name.split(' ')[0]}</span>
                      {look && (
                        <span className="text-[10px] text-gold">• {look.name}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions Modal */}
      {showActions && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4"
          onClick={() => setShowActions(false)}
        >
          <div
            className="w-full max-w-md bg-card rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border">
              <h3 className="text-base font-semibold text-text-primary">Scene {shootingScene.sceneNumber}</h3>
            </div>
            <div className="py-2">
              {shootingScene.status !== 'in-progress' && (
                <button
                  onClick={() => {
                    onStatusChange('in-progress');
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-gray-50 flex items-center gap-3"
                >
                  <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                  </svg>
                  Mark In Progress
                </button>
              )}

              {/* Filming Status Options */}
              <div className="border-t border-border mt-2 pt-2">
                <div className="px-4 py-2">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-text-light">
                    FILMING STATUS
                  </span>
                </div>
                <button
                  onClick={() => handleFilmingStatusSelect('complete')}
                  className="w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-gray-50 flex items-center gap-3"
                >
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-medium">Complete</span>
                    <p className="text-xs text-text-muted">Scene fully filmed</p>
                  </div>
                </button>
                <button
                  onClick={() => setShowFilmingStatusModal(true)}
                  className="w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-gray-50 flex items-center gap-3"
                >
                  <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-medium">Part Complete</span>
                    <p className="text-xs text-text-muted">Some shots still needed</p>
                  </div>
                </button>
                <button
                  onClick={() => setShowFilmingStatusModal(true)}
                  className="w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-gray-50 flex items-center gap-3"
                >
                  <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-medium">Incomplete</span>
                    <p className="text-xs text-text-muted">Scene not filmed</p>
                  </div>
                </button>
              </div>

              {shootingScene.status !== 'upcoming' && (
                <button
                  onClick={() => {
                    onStatusChange('upcoming');
                    setShowActions(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-text-muted hover:bg-gray-50 flex items-center gap-3 border-t border-border mt-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                  </svg>
                  Revert to Upcoming
                </button>
              )}
            </div>
            <button
              onClick={() => setShowActions(false)}
              className="w-full p-4 text-center text-sm font-medium text-gold border-t border-border"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filming Status Modal with Notes */}
      {showFilmingStatusModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowFilmingStatusModal(false)}
        >
          <div
            className="w-full max-w-md bg-card rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border">
              <h3 className="text-base font-semibold text-text-primary">Scene {shootingScene.sceneNumber} - Add Notes</h3>
              <p className="text-xs text-text-muted mt-1">Why wasn't this scene fully filmed?</p>
            </div>
            <div className="p-4">
              <textarea
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="e.g., Ran out of time, weather issues, actor unavailable..."
                rows={3}
                className="w-full p-3 border border-border rounded-lg text-sm bg-input-bg text-text-primary resize-none"
              />
            </div>
            <div className="p-4 border-t border-border flex gap-3">
              <button
                onClick={() => handleFilmingStatusSelect('partial')}
                className="flex-1 py-2.5 rounded-button bg-amber-500 text-white text-sm font-medium"
              >
                Part Complete
              </button>
              <button
                onClick={() => handleFilmingStatusSelect('not-filmed')}
                className="flex-1 py-2.5 rounded-button bg-red-500 text-white text-sm font-medium"
              >
                Incomplete
              </button>
            </div>
            <button
              onClick={() => setShowFilmingStatusModal(false)}
              className="w-full p-3 text-center text-sm text-text-muted border-t border-border"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
});

// Empty State Component - memoized to prevent unnecessary re-renders
interface EmptyStateProps {
  hasAnyCallSheets: boolean;
  onUploadClick: () => void;
  isUploading: boolean;
  isSyncing?: boolean;
  hasProjectData?: boolean;
}

const EmptyState = memo(function EmptyState({ onUploadClick, isUploading, isSyncing, hasProjectData }: EmptyStateProps) {
  // Show "waiting for sync" state when project has no local data and sync is in progress
  const isWaitingForSync = isSyncing && !hasProjectData;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          {isWaitingForSync ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          )}
        </svg>
      </div>
      {isWaitingForSync ? (
        // Message when syncing data from team
        <>
          <h3 className="text-lg font-semibold text-text-primary mb-1">Syncing Project Data</h3>
          <p className="text-sm text-text-muted text-center mb-6">
            Waiting for project data from your team. This should only take a moment.
          </p>
          <div className="flex items-center gap-2 text-sm text-gold">
            <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
            <span>Syncing...</span>
          </div>
        </>
      ) : (
        <>
          <h3 className="text-lg font-semibold text-text-primary mb-1">No Call Sheet for Today</h3>
          <p className="text-sm text-text-muted text-center mb-6">
            Upload a call sheet to see today's schedule
          </p>
          <button
            onClick={onUploadClick}
            disabled={isUploading}
            className="px-6 py-2.5 rounded-button gold-gradient text-white text-sm font-medium active:scale-95 transition-transform disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : 'Upload Call Sheet'}
          </button>
        </>
      )}
    </div>
  );
});

// Unmatched Scene Modal - shown when scene from call sheet doesn't exist in breakdown
interface UnmatchedSceneModalProps {
  info: UnmatchedSceneInfo;
  onClose: () => void;
  onAddScene: (sceneData: Partial<Scene> & { sceneNumber: string }) => void;
  onMergeWithScene: (targetScene: Scene) => void;
}

const UnmatchedSceneModal = memo(function UnmatchedSceneModal({
  info,
  onClose,
  onAddScene,
  onMergeWithScene,
}: UnmatchedSceneModalProps) {
  const { sceneNumber, character, callSheetScene, suggestedMergeScenes } = info;

  // Build scene data from call sheet info
  const handleAddScene = () => {
    // Parse INT/EXT and location from setDescription
    let intExt: 'INT' | 'EXT' = 'INT';
    let slugline = callSheetScene.setDescription || `Scene ${sceneNumber}`;

    const intExtMatch = callSheetScene.setDescription?.match(/^(INT|EXT)\./i);
    if (intExtMatch) {
      intExt = intExtMatch[1].toUpperCase() as 'INT' | 'EXT';
    }

    onAddScene({
      sceneNumber,
      slugline,
      intExt,
      timeOfDay: callSheetScene.dayNight?.toUpperCase() as 'DAY' | 'NIGHT' | undefined || 'DAY',
      synopsis: callSheetScene.action,
      characters: [character.id],
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card rounded-2xl overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <h3 className="text-base font-semibold text-text-primary">
            Scene {sceneNumber} Not in Breakdown
          </h3>
          <p className="text-xs text-text-muted mt-1">
            This scene from the call sheet doesn't exist in your script breakdown.
            Choose how to handle continuity for <span className="font-medium text-gold">{character.name}</span>.
          </p>
        </div>

        {/* Options */}
        <div className="py-2">
          {/* Add as new scene */}
          <button
            onClick={handleAddScene}
            className="w-full px-4 py-3.5 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-gold-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium text-text-primary block">
                Add Scene {sceneNumber} to Breakdown
              </span>
              <span className="text-xs text-text-muted">
                Create a new scene and track continuity there
              </span>
            </div>
            <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Merge options */}
          {suggestedMergeScenes.length > 0 && (
            <>
              <div className="px-4 py-2 border-t border-border/50 mt-1">
                <span className="text-[10px] font-bold tracking-wider uppercase text-text-light">
                  OR MERGE WITH EXISTING SCENE
                </span>
              </div>
              {suggestedMergeScenes.map((scene) => (
                <button
                  key={scene.id}
                  onClick={() => onMergeWithScene(scene)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-blue-600">{scene.sceneNumber}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-text-primary block truncate">
                      Merge with Scene {scene.sceneNumber}
                    </span>
                    <span className="text-xs text-text-muted truncate block">
                      {scene.slugline}
                    </span>
                  </div>
                  <svg className="w-5 h-5 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Cancel */}
        <button
          onClick={onClose}
          className="w-full p-4 text-center text-sm font-medium text-text-muted border-t border-border hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
});
