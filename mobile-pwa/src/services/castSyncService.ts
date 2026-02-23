/**
 * Cast Sync Service
 * Syncs cast data from schedule to script breakdown scenes
 * Maps cast ID numbers from schedule to characters in each scene
 */

import type {
  ProductionSchedule,
  Scene,
  Character,
  Look,
} from '@/types';
import { createEmptyMakeupDetails, createEmptyHairDetails } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Result of syncing cast data
export interface CastSyncResult {
  success: boolean;
  scenesUpdated: number;
  charactersCreated: number;
  errors: string[];
  // Detailed results per scene for review
  sceneResults: Array<{
    sceneNumber: string;
    castNumbers: number[];
    characterNames: string[];
    matchedCharacterIds: string[];
    newCharacterIds: string[];
  }>;
}

// Character colors for new characters
const CHARACTER_COLORS = [
  '#C9A961', // Gold
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#F97316', // Orange
];

/**
 * Normalize character/actor name for comparison
 * Handles variations like "MARGOT", "Margot Fontaine", "1. MARGOT FONTAINE"
 */
function normalizeNameForMatch(name: string): string {
  return name
    .toUpperCase()
    .replace(/^\d+\.\s*/, '') // Remove leading number prefix like "1. "
    .replace(/[^A-Z\s]/g, '') // Remove non-alpha except spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find best matching character in the project for a given name
 */
function findMatchingCharacter(
  name: string,
  characters: Character[]
): Character | null {
  const normalized = normalizeNameForMatch(name);
  if (!normalized) return null;

  // Try exact match first
  const exactMatch = characters.find(
    (c) => normalizeNameForMatch(c.name) === normalized
  );
  if (exactMatch) return exactMatch;

  // Try partial match (character name contained in the search name or vice versa)
  const partialMatch = characters.find((c) => {
    const charNormalized = normalizeNameForMatch(c.name);
    return (
      charNormalized.includes(normalized) ||
      normalized.includes(charNormalized) ||
      // Also check first name match
      charNormalized.split(' ')[0] === normalized.split(' ')[0]
    );
  });

  return partialMatch || null;
}

/**
 * Create a new character from a cast member name
 */
function createCharacterFromName(
  name: string,
  existingCount: number
): Character {
  const id = `char-${uuidv4().slice(0, 8)}`;

  // Clean up the name
  const cleanName = name
    .replace(/^\d+\.\s*/, '') // Remove leading number
    .trim();

  // Generate initials
  const initials = cleanName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Assign color based on count
  const avatarColour = CHARACTER_COLORS[existingCount % CHARACTER_COLORS.length];

  return {
    id,
    name: cleanName,
    initials: initials || '??',
    avatarColour,
  };
}

/**
 * Create a look for a new character
 */
function createLookForCharacter(
  character: Character,
  sceneNumbers: string[]
): Look {
  return {
    id: `look-${character.id}`,
    characterId: character.id,
    name: 'Look 1',
    scenes: sceneNumbers.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    ),
    estimatedTime: 30,
    makeup: createEmptyMakeupDetails(),
    hair: createEmptyHairDetails(),
  };
}

/**
 * Get character name from cast number using the schedule's cast list
 */
function getCharacterNameFromCastNumber(
  castNumber: number,
  schedule: ProductionSchedule
): string | null {
  const castMember = schedule.castList.find((c) => c.number === castNumber);
  if (!castMember) return null;

  // Prefer character name over actor name
  return castMember.character || castMember.name;
}

/**
 * Build a map of scene number to cast numbers from the schedule
 */
function buildSceneCastMap(
  schedule: ProductionSchedule
): Map<string, number[]> {
  const map = new Map<string, number[]>();

  for (const day of schedule.days) {
    for (const scene of day.scenes) {
      // Normalize scene number for matching
      const normalizedSceneNum = scene.sceneNumber
        .replace(/\s+/g, '')
        .toUpperCase();

      // Store with normalized key
      if (scene.castNumbers && scene.castNumbers.length > 0) {
        map.set(normalizedSceneNum, scene.castNumbers);
      }
    }
  }

  return map;
}

/**
 * Main sync function - syncs cast data from schedule to project scenes
 *
 * @param schedule - The processed production schedule with cast list and scene data
 * @param scenes - The project's scenes to update
 * @param characters - The project's existing characters
 * @param looks - The project's existing looks
 * @param options - Sync options
 * @returns Updated data and sync results
 */
export function syncCastDataToScenes(
  schedule: ProductionSchedule,
  scenes: Scene[],
  characters: Character[],
  looks: Look[],
  options: {
    createMissingCharacters?: boolean; // Create characters not found in project
    overwriteExisting?: boolean; // Overwrite scenes that already have characters
    autoConfirm?: boolean; // Auto-confirm scene characters (vs just suggest)
  } = {}
): {
  result: CastSyncResult;
  updatedScenes: Scene[];
  updatedCharacters: Character[];
  updatedLooks: Look[];
} {
  const {
    createMissingCharacters = true,
    overwriteExisting = false,
    autoConfirm = true,
  } = options;

  const result: CastSyncResult = {
    success: true,
    scenesUpdated: 0,
    charactersCreated: 0,
    errors: [],
    sceneResults: [],
  };

  // Build map of scene number -> cast numbers from schedule
  const sceneCastMap = buildSceneCastMap(schedule);

  console.log(
    '[CastSync] Scene cast map built:',
    Object.fromEntries(sceneCastMap)
  );

  // Track new characters and their scenes
  const newCharacters: Character[] = [];
  const newCharacterScenes = new Map<string, string[]>(); // character ID -> scene numbers

  // Copy arrays for modification
  const updatedScenes = scenes.map((s) => ({ ...s }));
  const updatedCharacters = [...characters];

  // Process each scene
  for (const scene of updatedScenes) {
    // Normalize scene number for lookup
    const normalizedSceneNum = scene.sceneNumber
      .replace(/\s+/g, '')
      .toUpperCase();

    // Get cast numbers from schedule
    const castNumbers = sceneCastMap.get(normalizedSceneNum);

    if (!castNumbers || castNumbers.length === 0) {
      // No cast data for this scene in schedule
      continue;
    }

    // Skip if scene already has characters and we're not overwriting
    if (
      !overwriteExisting &&
      scene.characters.length > 0 &&
      scene.characterConfirmationStatus === 'confirmed'
    ) {
      continue;
    }

    // Map cast numbers to character names
    const characterNames: string[] = [];
    for (const num of castNumbers) {
      const name = getCharacterNameFromCastNumber(num, schedule);
      if (name) {
        characterNames.push(name);
      } else {
        result.errors.push(
          `Scene ${scene.sceneNumber}: Cast #${num} not found in cast list`
        );
      }
    }

    // Match names to existing characters or create new ones
    const matchedCharacterIds: string[] = [];
    const newCharacterIds: string[] = [];

    for (const name of characterNames) {
      // Try to find existing character
      let character = findMatchingCharacter(name, [
        ...updatedCharacters,
        ...newCharacters,
      ]);

      if (!character && createMissingCharacters) {
        // Create new character
        character = createCharacterFromName(
          name,
          updatedCharacters.length + newCharacters.length
        );
        newCharacters.push(character);
        newCharacterIds.push(character.id);
        newCharacterScenes.set(character.id, []);
        result.charactersCreated++;
      }

      if (character) {
        matchedCharacterIds.push(character.id);

        // Track scene for this character (for look creation)
        if (newCharacterScenes.has(character.id)) {
          newCharacterScenes.get(character.id)!.push(scene.sceneNumber);
        }
      }
    }

    // Update scene with matched characters
    if (matchedCharacterIds.length > 0) {
      if (autoConfirm) {
        scene.characters = matchedCharacterIds;
        scene.characterConfirmationStatus = 'confirmed';
        scene.suggestedCharacters = undefined;
      } else {
        // Just set as suggested for user review
        scene.suggestedCharacters = characterNames;
        scene.characterConfirmationStatus = 'ready';
      }
      result.scenesUpdated++;
    }

    // Record result for this scene
    result.sceneResults.push({
      sceneNumber: scene.sceneNumber,
      castNumbers,
      characterNames,
      matchedCharacterIds: matchedCharacterIds.filter(
        (id) => !newCharacterIds.includes(id)
      ),
      newCharacterIds,
    });
  }

  // Add new characters to the list
  updatedCharacters.push(...newCharacters);

  // Create looks for new characters
  const newLooks: Look[] = [];
  for (const char of newCharacters) {
    const sceneNums = newCharacterScenes.get(char.id) || [];
    newLooks.push(createLookForCharacter(char, sceneNums));
  }

  // Update existing looks to include new scenes for existing characters
  const updatedLooks = looks.map((look) => {
    // Find all scenes where this character was added
    const addedScenes: string[] = [];
    for (const scene of updatedScenes) {
      if (
        scene.characters.includes(look.characterId) &&
        !look.scenes.includes(scene.sceneNumber)
      ) {
        addedScenes.push(scene.sceneNumber);
      }
    }

    if (addedScenes.length > 0) {
      return {
        ...look,
        scenes: [...look.scenes, ...addedScenes].sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true })
        ),
      };
    }

    return look;
  });

  // Add new looks
  updatedLooks.push(...newLooks);

  console.log('[CastSync] Sync complete:', {
    scenesUpdated: result.scenesUpdated,
    charactersCreated: result.charactersCreated,
    errors: result.errors,
  });

  return {
    result,
    updatedScenes,
    updatedCharacters,
    updatedLooks,
  };
}

/**
 * Validate that the schedule has the necessary data for cast sync
 */
export function canSyncCastData(schedule: ProductionSchedule | null): {
  canSync: boolean;
  reason?: string;
} {
  if (!schedule) {
    return { canSync: false, reason: 'No schedule uploaded' };
  }

  if (schedule.castList.length === 0) {
    return { canSync: false, reason: 'Schedule has no cast list' };
  }

  if (schedule.status !== 'complete') {
    return {
      canSync: false,
      reason: 'Schedule processing not complete. Run AI analysis first.',
    };
  }

  if (!schedule.days || schedule.days.length === 0) {
    return {
      canSync: false,
      reason: 'Schedule has no shooting days. Run AI analysis first.',
    };
  }

  // Check if any scenes have cast numbers
  const hasAnyCastData = schedule.days.some((day) =>
    day.scenes.some((scene) => scene.castNumbers && scene.castNumbers.length > 0)
  );

  if (!hasAnyCastData) {
    return {
      canSync: false,
      reason: 'No cast data found in schedule scenes',
    };
  }

  return { canSync: true };
}
