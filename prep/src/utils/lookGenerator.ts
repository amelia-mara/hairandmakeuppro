/**
 * Look Generator
 *
 * Auto-generates looks per character from parsed script data by detecting
 * story day transitions using v2 detection (action lines, flashback tracking,
 * CONTINUOUS handling, calendar dates).
 *
 * 1. Convert scenes to ParsedScene format for the v2 detector
 * 2. Build a story day map with present/non-present timeline support
 * 3. For each character, group their scenes by story day
 * 4. Create one Look per story day ("Day 1", "Day 2", etc.)
 *
 * No schedule upload required — works purely from parsed script scenes.
 */

import type { Scene, Character, Look } from '@/stores/breakdownStore';
import {
  buildStoryDayMap,
  classifyTOD,
  extractTOD,
  isNonPresent,
  type ParsedScene,
  type StoryDayResult,
} from './storyDayDetection';

/* ━━━ Scene conversion ━━━ */

/**
 * Convert a prep Scene to a ParsedScene for the v2 story day detector.
 * Extracts action lines from scriptContent (first 3 non-empty lines after
 * stripping the slugline).
 */
function sceneToParsedScene(scene: Scene): ParsedScene {
  // Build a slugline-like string from scene fields for TOD extraction
  const sluglike = `${scene.intExt}. ${scene.location} - ${scene.dayNight}${scene.timeInfo ? ' ' + scene.timeInfo : ''}`;

  // Extract raw TOD — use timeInfo if available (may contain "NEXT MORNING" etc.)
  // otherwise fall back to the dayNight field
  const rawTOD = scene.timeInfo
    ? scene.timeInfo.trim()
    : extractTOD(sluglike) || scene.dayNight;

  const tod = classifyTOD(rawTOD);
  const nonPresent = isNonPresent(sluglike, rawTOD);

  // Extract first 3 action lines from scriptContent
  const actionLines: string[] = [];
  if (scene.scriptContent) {
    const lines = scene.scriptContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && actionLines.length < 3) {
        // Skip the scene heading line itself
        if (/^(\d+[A-Z]?\s+)?(INT\.|EXT\.|INT\/EXT)/i.test(trimmed)) continue;
        actionLines.push(trimmed);
      }
    }
  }

  return {
    sceneNumber: String(scene.number),
    slugline: sluglike,
    rawTOD,
    tod,
    isNonPresent: nonPresent,
    actionLines,
  };
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
  // Step 1: Convert scenes to ParsedScene format and run v2 detection
  const parsedScenes = scenes.map(sceneToParsedScene);
  const storyDayResults = buildStoryDayMap(parsedScenes);

  // Build lookup maps: scene number -> StoryDayResult
  const resultBySceneNum = new Map<string, StoryDayResult>();
  for (const r of storyDayResults) {
    resultBySceneNum.set(r.sceneNumber, r);
  }

  // Also build scene id -> StoryDayResult (using index correspondence)
  const resultBySceneId = new Map<string, StoryDayResult>();
  for (let i = 0; i < scenes.length; i++) {
    resultBySceneId.set(scenes[i].id, storyDayResults[i]);
  }

  // Step 2: Assign storyDay label to each scene.
  // Append " (?)" to the label when the day was inferred or inherited,
  // so the user can see at a glance which story days may need manual review.
  const updatedScenes = scenes.map((scene, i) => {
    const result = storyDayResults[i];
    const needsReview = result.confidence === 'inferred' || result.confidence === 'inherited';
    return {
      ...scene,
      storyDay: needsReview ? `${result.label} (?)` : result.label,
    };
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

    // Group scenes by story day label (preserves flashback separation)
    const dayGroups = new Map<string, Scene[]>();
    for (const scene of characterScenes) {
      const result = resultBySceneId.get(scene.id);
      const label = result?.label || 'Day 1';
      if (!dayGroups.has(label)) {
        dayGroups.set(label, []);
      }
      dayGroups.get(label)!.push(scene);
    }

    // Create one look per story day, sorted by day number
    const sortedLabels = Array.from(dayGroups.keys()).sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.match(/\d+/)?.[0] || '0');
      if (numA !== numB) return numA - numB;
      // Flashbacks sort after present
      return a.includes('Flashback') ? 1 : -1;
    });

    for (const label of sortedLabels) {
      const dayScenes = dayGroups.get(label)!;
      const sceneNumbers = dayScenes.map((s) => s.number).sort((a, b) => a - b);
      const sceneRangeStr = compressSceneRanges(sceneNumbers);

      looks.push({
        id: generateLookId(),
        characterId: character.id,
        name: label,
        description: `Scenes: ${sceneRangeStr}`,
        hair: '',
        makeup: '',
        wardrobe: '',
      });
    }
  }

  return { looks, scenes: updatedScenes };
}

/** Re-export buildStoryDayMap for direct use */
export { buildStoryDayMap } from './storyDayDetection';

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
