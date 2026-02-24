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
 * Get a time-of-day ordering for story day detection
 * MORNING=0, DAY=1, EVENING=2, NIGHT=3, unknown/CONTINUOUS=-1
 */
function getTimeOrder(timeOfDay: string): number {
  const t = timeOfDay.toUpperCase().trim();
  if (t.includes('MORN') || t === 'DAWN' || t === 'SUNRISE') return 0;
  if (t.includes('DAY') || t === 'D' || t.includes('AFTERNOON')) return 1;
  if (t.includes('EVEN') || t === 'DUSK' || t === 'SUNSET') return 2;
  if (t.includes('NIGHT') || t === 'N') return 3;
  return -1; // CONTINUOUS or unknown — inherits previous
}

/**
 * Check if a raw time-of-day string explicitly indicates a new day
 * Handles: "NEXT MORNING", "NEXT DAY", "THE NEXT DAY", "FOLLOWING DAY",
 * "FOLLOWING MORNING", "A NEW DAY", "LATER THAT NIGHT" (NOT a new day),
 * "THE FOLLOWING EVENING", etc.
 */
function isExplicitNewDay(rawTimeOfDay: string): boolean {
  const t = rawTimeOfDay.toUpperCase().trim();
  // "NEXT" followed by a time period = new day
  if (/\bNEXT\s+(DAY|MORNING|EVENING|NIGHT|AFTERNOON)\b/.test(t)) return true;
  // "FOLLOWING" followed by a time period = new day
  if (/\bFOLLOWING\s+(DAY|MORNING|EVENING|NIGHT|AFTERNOON)\b/.test(t)) return true;
  // "NEW DAY", "A NEW DAY"
  if (/\bNEW\s+DAY\b/.test(t)) return true;
  // "DAYS LATER", "HOURS LATER" (ambiguous but likely new day for looks)
  if (/\b\d+\s+(DAYS?|WEEKS?|MONTHS?|YEARS?)\s+LATER\b/.test(t)) return true;
  // "ONE WEEK LATER", "TWO DAYS LATER" etc.
  if (/\b(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|SEVERAL|FEW|SOME)\s+(DAYS?|WEEKS?|MONTHS?|YEARS?)\s+LATER\b/.test(t)) return true;
  return false;
}

/**
 * Detect if transitioning between two time-of-day values signals a new story day.
 *
 * New day triggers:
 *   NIGHT/EVENING → MORNING/DAY  (classic overnight transition)
 *   DAY → MORNING               (morning is earlier in the day, so this is next day)
 *   Any explicit "NEXT X" or "FOLLOWING X" in the raw string
 *
 * NOT a new day (same time repeating is just another scene at that time):
 *   MORNING → MORNING, DAY → DAY, NIGHT → NIGHT  (unless explicit "NEXT" keyword)
 */
function isNewStoryDay(
  prevTimeOrder: number,
  currentTimeOrder: number,
  rawTimeOfDay: string
): boolean {
  // Explicit markers always trigger a new day regardless of time order
  if (isExplicitNewDay(rawTimeOfDay)) return true;

  // Both must be known time values for transition detection
  if (prevTimeOrder < 0 || currentTimeOrder < 0) return false;

  // NIGHT or EVENING → MORNING or DAY (went through overnight)
  if (prevTimeOrder >= 2 && currentTimeOrder <= 1) return true;

  // DAY → MORNING (morning is earlier in the day, so this must be next day)
  if (prevTimeOrder === 1 && currentTimeOrder === 0) return true;

  return false;
}

/**
 * Build a map of scene number -> story day number
 * Uses schedule dayNight values (D1/D2/N1 notation) if available,
 * otherwise infers from time-of-day transitions in story order
 */
function buildStoryDayMap(
  schedule: ProductionSchedule,
  scenes: Scene[]
): Map<string, number> {
  const storyDayMap = new Map<string, number>();

  // Build sceneNumber -> raw time of day string from schedule entries and project scenes
  const sceneTimeMap = new Map<string, string>();

  // From schedule entries first (may have D1/D2 notation or "NEXT MORNING" etc.)
  for (const day of schedule.days) {
    for (const entry of day.scenes) {
      const normalized = entry.sceneNumber.replace(/\s+/g, '').toUpperCase();
      sceneTimeMap.set(normalized, entry.dayNight);
    }
  }

  // From project scenes as fallback
  for (const scene of scenes) {
    const normalized = scene.sceneNumber.replace(/\s+/g, '').toUpperCase();
    if (!sceneTimeMap.has(normalized)) {
      sceneTimeMap.set(normalized, scene.timeOfDay);
    }
  }

  // Also build a map from scene sluglines for richer time-of-day info
  // (sluglines may contain "NEXT MORNING" even when timeOfDay is normalized to "MORNING")
  const sceneSluglineTimeMap = new Map<string, string>();
  for (const scene of scenes) {
    const normalized = scene.sceneNumber.replace(/\s+/g, '').toUpperCase();
    if (scene.slugline) {
      // Extract time portion from slugline: "INT. HOUSE - NEXT MORNING" → "NEXT MORNING"
      const timeMatch = scene.slugline.match(/[-–—]\s*([^-–—]+)$/);
      if (timeMatch) {
        sceneSluglineTimeMap.set(normalized, timeMatch[1].trim());
      }
    }
  }

  // Strategy 1: Check for explicit story day markers (D1, D2, N1, N2)
  const dayNightPattern = /^[DN](\d+)/i;
  let hasExplicitDays = false;

  for (const [sceneNum, timeOfDay] of sceneTimeMap) {
    const match = timeOfDay.match(dayNightPattern);
    if (match) {
      hasExplicitDays = true;
      storyDayMap.set(sceneNum, parseInt(match[1], 10));
    }
  }

  if (hasExplicitDays && storyDayMap.size > 0) {
    console.log('[CastSync] Story days from explicit D1/D2/N1 markers:', storyDayMap.size, 'scenes mapped');
    return storyDayMap;
  }

  // Strategy 2: Infer story days from time-of-day transitions in scene order
  const allSceneNums = Array.from(sceneTimeMap.keys()).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  let currentDay = 1;
  let prevTimeOrder = -1;

  for (const sceneNum of allSceneNums) {
    const rawTimeOfDay = sceneTimeMap.get(sceneNum) || '';
    const sluglineTime = sceneSluglineTimeMap.get(sceneNum) || '';
    // Use slugline time if it's richer (contains "NEXT", "FOLLOWING", etc.)
    const bestRawTime = sluglineTime.length > rawTimeOfDay.length ? sluglineTime : rawTimeOfDay;
    const timeOrder = getTimeOrder(rawTimeOfDay);

    // Detect new story day using both transition logic and explicit markers
    if (isNewStoryDay(prevTimeOrder, timeOrder, bestRawTime)) {
      currentDay++;
    }

    storyDayMap.set(sceneNum, currentDay);

    if (timeOrder >= 0) {
      prevTimeOrder = timeOrder;
    }
  }

  console.log('[CastSync] Story days inferred from time-of-day transitions:', currentDay, 'days detected');
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
      id: `look-${character.id}-day${dayNum}`,
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
      id: `look-${character.id}`,
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
