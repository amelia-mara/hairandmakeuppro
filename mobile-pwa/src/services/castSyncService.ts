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
import {
  buildStoryDayMap as buildStoryDayMapV2,
  extractTOD,
  classifyTOD,
  isNonPresent,
  type ParsedScene,
  type StoryDayResult,
} from '@/utils/storyDayDetection';

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
  const id = uuidv4();

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
 * Build a map of scene number -> story day number using v2 detection.
 *
 * Strategy:
 *  1. Check for explicit D1/D2/N1 notation in schedule — use directly if found.
 *  2. Otherwise, convert scenes to ParsedScene format and run v2 detection
 *     which handles action lines, flashbacks, CONTINUOUS, calendar dates, etc.
 */
function buildStoryDayMap(
  schedule: ProductionSchedule,
  scenes: Scene[]
): Map<string, number> {
  const storyDayMap = new Map<string, number>();

  // Build sceneNumber -> raw time of day from schedule entries
  const scheduleTimeMap = new Map<string, string>();
  for (const day of schedule.days) {
    for (const entry of day.scenes) {
      const normalized = entry.sceneNumber.replace(/\s+/g, '').toUpperCase();
      scheduleTimeMap.set(normalized, entry.dayNight);
    }
  }

  // Strategy 1: Check for explicit story day markers (D1, D2, N1, N2)
  const dayNightPattern = /^[DN](\d+)/i;
  let hasExplicitDays = false;

  for (const [sceneNum, timeOfDay] of scheduleTimeMap) {
    const match = timeOfDay.match(dayNightPattern);
    if (match) {
      hasExplicitDays = true;
      storyDayMap.set(sceneNum, parseInt(match[1], 10));
    }
  }

  if (hasExplicitDays && storyDayMap.size > 0) {
    return storyDayMap;
  }

  // Strategy 2: Convert to ParsedScene format and use v2 detection
  // Build scene list in story order (by scene number)
  const scenesByNum = new Map<string, Scene>();
  for (const scene of scenes) {
    const normalized = scene.sceneNumber.replace(/\s+/g, '').toUpperCase();
    scenesByNum.set(normalized, scene);
  }

  // Merge schedule entries with project scenes, sorted by scene number
  const allSceneNums = new Set<string>();
  for (const key of scheduleTimeMap.keys()) allSceneNums.add(key);
  for (const scene of scenes) {
    allSceneNums.add(scene.sceneNumber.replace(/\s+/g, '').toUpperCase());
  }
  const sortedNums = Array.from(allSceneNums).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  // Convert to ParsedScene[]
  const parsedScenes: ParsedScene[] = sortedNums.map((sceneNum) => {
    const scene = scenesByNum.get(sceneNum);
    const scheduleTime = scheduleTimeMap.get(sceneNum) || '';
    const slugline = scene?.slugline || '';
    const rawTOD = slugline
      ? extractTOD(slugline) || scheduleTime || (scene?.timeOfDay ?? '')
      : scheduleTime || '';

    // Extract action lines from scriptContent
    const actionLines: string[] = [];
    if (scene?.scriptContent) {
      const lines = scene.scriptContent.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && actionLines.length < 3) {
          if (/^(\d+[A-Z]?\s+)?(INT\.|EXT\.|INT\/EXT)/i.test(trimmed)) continue;
          actionLines.push(trimmed);
        }
      }
    }

    return {
      sceneNumber: sceneNum,
      slugline,
      rawTOD,
      tod: classifyTOD(rawTOD),
      isNonPresent: isNonPresent(slugline, rawTOD),
      actionLines,
    };
  });

  // Run v2 detection
  const results: StoryDayResult[] = buildStoryDayMapV2(parsedScenes);

  for (const r of results) {
    storyDayMap.set(r.sceneNumber, r.storyDay);
  }

  return storyDayMap;
}

/**
 * Create looks for a new character, grouped by story day
 * Each story day gets its own look: "Day 1", "Day 2", etc.
 */
function createLooksForCharacter(
  character: Character,
  sceneNumbers: string[],
  storyDayMap: Map<string, number>
): Look[] {
  // Group scenes by story day
  const dayGroups = new Map<number, string[]>();

  for (const sceneNum of sceneNumbers) {
    const normalized = sceneNum.replace(/\s+/g, '').toUpperCase();
    const storyDay = storyDayMap.get(normalized) || 1;
    if (!dayGroups.has(storyDay)) {
      dayGroups.set(storyDay, []);
    }
    dayGroups.get(storyDay)!.push(sceneNum);
  }

  const sortedDays = Array.from(dayGroups.keys()).sort((a, b) => a - b);

  const looks: Look[] = [];
  for (const dayNum of sortedDays) {
    const scenes = dayGroups.get(dayNum)!.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );

    looks.push({
      id: uuidv4(),
      characterId: character.id,
      name: `Day ${dayNum}`,
      scenes,
      estimatedTime: 30,
      makeup: createEmptyMakeupDetails(),
      hair: createEmptyHairDetails(),
    });
  }

  // If no scenes at all, create a single empty look
  if (looks.length === 0) {
    looks.push({
      id: uuidv4(),
      characterId: character.id,
      name: 'Day 1',
      scenes: [],
      estimatedTime: 30,
      makeup: createEmptyMakeupDetails(),
      hair: createEmptyHairDetails(),
    });
  }

  return looks;
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

  // Build story day map for look grouping
  const storyDayMap = buildStoryDayMap(schedule, scenes);


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

  // Create looks for new characters, grouped by story day
  const newLooks: Look[] = [];
  for (const char of newCharacters) {
    const sceneNums = newCharacterScenes.get(char.id) || [];
    const charLooks = createLooksForCharacter(char, sceneNums, storyDayMap);
    newLooks.push(...charLooks);
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
      reason: 'Schedule processing not complete. Run schedule analysis first.',
    };
  }

  if (!schedule.days || schedule.days.length === 0) {
    return {
      canSync: false,
      reason: 'Schedule has no shooting days. Run schedule analysis first.',
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
