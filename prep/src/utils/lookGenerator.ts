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
  type ParsedScene,
  type StoryDayResult,
} from './storyDayDetection';

/* ━━━ Scene conversion ━━━ */

function sceneToParsedScene(scene: Scene, _index: number): ParsedScene {
  // Reconstruct slugline from existing fields
  const slugline = `${scene.intExt}. ${scene.location} - ${scene.dayNight}`;

  // Extract action lines and title card from scriptContent
  const { actionLines, titleCard } = extractActionLines(scene.scriptContent ?? '');

  return {
    sceneNumber: String(scene.number),
    slugline,
    rawTOD: scene.dayNight,
    tod: classifyTOD(scene.dayNight),
    intExt: scene.intExt as 'INT' | 'EXT' | 'INT/EXT' | 'UNKNOWN',
    location: scene.location,
    actionLines,
    titleCardBefore: scene.titleCardBefore ?? titleCard,
    isEpisodeMarker: false,
  };
}

/**
 * Extract the first 1-3 action lines from raw scene body text,
 * stripping dialogue and detecting title cards.
 */
function extractActionLines(content: string): {
  actionLines: string[];
  titleCard: string | null;
} {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const actionLines: string[] = [];
  let titleCard: string | null = null;
  let skipNext = false;

  for (const line of lines) {
    if (actionLines.length >= 3) break;

    // Title card: ALL-CAPS line that appears before any action text,
    // is not a character cue (character cues are followed by dialogue),
    // and contains known title-card patterns.
    // Skip structural headings (EPISODE, ACT, PART, CHAPTER, SCENE).
    if (
      !titleCard &&
      actionLines.length === 0 &&
      /^[A-Z0-9][A-Z\s,.:'\-!0-9]+$/.test(line) &&
      line.length > 4 &&
      !/^(EPISODE\s+\d+|ACT\s+(ONE|TWO|THREE|FOUR|FIVE|\d+)|PART\s+(ONE|TWO|THREE|FOUR|\d+)|CHAPTER\s+\d+|SCENE\s+\d+)\b/i.test(line) &&
      /\b(FLASHBACK|LATER|AGO|EARLIER|MORNING|YEARS?|MONTHS?|WEEKS?|DAYS?|INTERCUT)\b/.test(line)
    ) {
      titleCard = line;
      continue;
    }

    // Character cue: short ALL-CAPS line (name only, possibly with V.O./O.S.)
    if (
      /^[A-Z][A-Z\s\-.()]{0,35}$/.test(line) &&
      line.length < 40 &&
      !/\b(INT|EXT|DAY|NIGHT|MORNING|EVENING|CONTINUOUS)\b/.test(line)
    ) {
      skipNext = true;
      continue;
    }

    // Dialogue line (indented or follows character cue)
    if (skipNext) {
      skipNext = false;
      continue;
    }

    // Parenthetical: (whispers), (beat) etc.
    if (/^\(.*\)$/.test(line)) continue;

    // Page numbers, scene numbers, header noise
    if (/^\d+\.?$/.test(line)) continue;

    actionLines.push(line);
  }

  return { actionLines, titleCard };
}

/* ━━━ Look generation ━━━ */

function generateLookId(): string {
  return crypto.randomUUID();
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
  // Step 1: Convert scenes to ParsedScene format and run v3 detection
  const parsedScenes = scenes.map((s, i) => sceneToParsedScene(s, i));
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
      storyDaySignal: result.signal,
      storyDayGapNote: result.gapNote,
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
