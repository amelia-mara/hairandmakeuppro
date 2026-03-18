/**
 * Look Generator
 *
 * Auto-generates looks per character from parsed script data by detecting
 * story day transitions from scene time-of-day values.
 *
 * Mirrors the approach used in the mobile app's castSyncService:
 * 1. Build a story day map from time-of-day transitions between scenes
 * 2. For each character, group their scenes by story day
 * 3. Create one Look per story day ("Day 1", "Day 2", etc.)
 *
 * No schedule upload required — works purely from parsed script scenes.
 */

import type { Scene, Character, Look } from '@/stores/breakdownStore';

/* ━━━ Time-of-day ordering ━━━ */

/**
 * Map a time-of-day string to a numeric order for day progression detection.
 * MORNING/DAWN = 0, DAY = 1, EVENING/DUSK = 2, NIGHT = 3
 * Unknown/CONTINUOUS returns -1 (inherits previous).
 */
function getTimeOrder(dayNight: string): number {
  const t = dayNight.toUpperCase().trim();
  if (t === 'DAWN' || t === 'MORNING' || t.includes('MORN') || t === 'SUNRISE') return 0;
  if (t === 'DAY' || t === 'D' || t.includes('AFTERNOON')) return 1;
  if (t === 'DUSK' || t === 'EVENING' || t.includes('EVEN') || t === 'SUNSET') return 2;
  if (t === 'NIGHT' || t === 'N') return 3;
  return -1; // CONTINUOUS or unknown — inherits previous
}

/**
 * Check if a raw time-of-day or location string explicitly indicates a new day.
 * Handles: "NEXT MORNING", "NEXT DAY", "THE FOLLOWING DAY", etc.
 */
function isExplicitNewDay(rawText: string): boolean {
  const t = rawText.toUpperCase().trim();
  if (/\bNEXT\s+(DAY|MORNING|EVENING|NIGHT|AFTERNOON)\b/.test(t)) return true;
  if (/\bFOLLOWING\s+(DAY|MORNING|EVENING|NIGHT|AFTERNOON)\b/.test(t)) return true;
  if (/\bNEW\s+DAY\b/.test(t)) return true;
  if (/\b\d+\s+(DAYS?|WEEKS?|MONTHS?|YEARS?)\s+LATER\b/.test(t)) return true;
  if (/\b(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|SEVERAL|FEW|SOME)\s+(DAYS?|WEEKS?|MONTHS?|YEARS?)\s+LATER\b/.test(t)) return true;
  return false;
}

/**
 * Detect if transitioning between two time-of-day values signals a new story day.
 *
 * New day triggers:
 *   NIGHT/EVENING → MORNING/DAY  (classic overnight transition)
 *   DAY → MORNING               (morning is earlier, so this is next day)
 *   Any explicit "NEXT X" or "FOLLOWING X" in the raw string
 */
function isNewStoryDay(
  prevTimeOrder: number,
  currentTimeOrder: number,
  rawTimeInfo: string,
): boolean {
  // Explicit markers always trigger a new day
  if (isExplicitNewDay(rawTimeInfo)) return true;

  // Both must be known time values for transition detection
  if (prevTimeOrder < 0 || currentTimeOrder < 0) return false;

  // NIGHT or EVENING → MORNING or DAY (overnight)
  if (prevTimeOrder >= 2 && currentTimeOrder <= 1) return true;

  // DAY → MORNING (morning is earlier, so next day)
  if (prevTimeOrder === 1 && currentTimeOrder === 0) return true;

  return false;
}

/* ━━━ Story day detection ━━━ */

/**
 * Build a map of scene id → story day number by analyzing time-of-day
 * transitions in scene order. Also assigns storyDay labels to scenes.
 */
export function buildStoryDayMap(scenes: Scene[]): Map<string, number> {
  const storyDayMap = new Map<string, number>();

  let currentDay = 1;
  let prevTimeOrder = -1;

  for (const scene of scenes) {
    const timeOrder = getTimeOrder(scene.dayNight);
    // Also check timeInfo and location for explicit new day markers
    const rawInfo = `${scene.dayNight} ${scene.timeInfo} ${scene.location}`;

    if (isNewStoryDay(prevTimeOrder, timeOrder, rawInfo)) {
      currentDay++;
    }

    storyDayMap.set(scene.id, currentDay);

    if (timeOrder >= 0) {
      prevTimeOrder = timeOrder;
    }
  }

  return storyDayMap;
}

/* ━━━ Look generation ━━━ */

let lookIdCounter = 0;
function generateLookId(): string {
  lookIdCounter++;
  return `look-${Date.now()}-${lookIdCounter}`;
}

/**
 * Generate looks for all characters from parsed script scenes.
 *
 * For each character:
 * - Find all scenes they appear in
 * - Group those scenes by story day
 * - Create one Look per story day ("Day 1", "Day 2", etc.)
 *
 * Also assigns storyDay labels to scenes as a side effect.
 *
 * @returns Object with generated looks and updated scenes (with storyDay populated)
 */
export function generateLooksFromScript(
  scenes: Scene[],
  characters: Character[],
): { looks: Look[]; scenes: Scene[] } {
  // Step 1: Detect story days from time-of-day transitions
  const storyDayMap = buildStoryDayMap(scenes);

  // Step 2: Assign storyDay to each scene
  const updatedScenes = scenes.map((scene) => {
    const dayNum = storyDayMap.get(scene.id) || 1;
    return { ...scene, storyDay: `Day ${dayNum}` };
  });

  // Step 3: For each character, group scenes by story day and create looks
  const looks: Look[] = [];

  for (const character of characters) {
    // Find all scenes where this character appears
    const characterScenes = updatedScenes.filter((s) =>
      s.characterIds.includes(character.id),
    );

    if (characterScenes.length === 0) {
      // Create a single empty "Day 1" look even if no scenes
      looks.push({
        id: generateLookId(),
        characterId: character.id,
        name: 'Day 1',
        description: '',
        hair: '',
        makeup: '',
        wardrobe: '',
      });
      continue;
    }

    // Group scenes by story day
    const dayGroups = new Map<number, Scene[]>();
    for (const scene of characterScenes) {
      const dayNum = storyDayMap.get(scene.id) || 1;
      if (!dayGroups.has(dayNum)) {
        dayGroups.set(dayNum, []);
      }
      dayGroups.get(dayNum)!.push(scene);
    }

    // Create one look per story day, sorted
    const sortedDays = Array.from(dayGroups.keys()).sort((a, b) => a - b);

    for (const dayNum of sortedDays) {
      const dayScenes = dayGroups.get(dayNum)!;
      const sceneNumbers = dayScenes.map((s) => s.number).sort((a, b) => a - b);
      const sceneRangeStr = compressSceneRanges(sceneNumbers);

      looks.push({
        id: generateLookId(),
        characterId: character.id,
        name: `Day ${dayNum}`,
        description: `Scenes: ${sceneRangeStr}`,
        hair: '',
        makeup: '',
        wardrobe: '',
      });
    }
  }

  return { looks, scenes: updatedScenes };
}

/**
 * Compress an array of scene numbers into ranges.
 * e.g., [1, 2, 3, 5, 7, 8] → "1-3, 5, 7-8"
 */
function compressSceneRanges(sceneNumbers: number[]): string {
  if (sceneNumbers.length === 0) return '';

  const sorted = [...sceneNumbers].sort((a, b) => a - b);
  const ranges: string[] = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === rangeEnd + 1) {
      rangeEnd = sorted[i];
    } else {
      ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
      rangeStart = sorted[i];
      rangeEnd = sorted[i];
    }
  }

  ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
  return ranges.join(', ');
}
