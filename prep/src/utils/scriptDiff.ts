import type { Scene, Character, SceneChange } from '@/stores/breakdownStore';

/**
 * Compare two script revisions and produce a list of scene-level changes.
 *
 * Matching strategy: scenes are matched by their **scene number** because
 * screenplay convention preserves scene numbers across drafts (omitted
 * scenes keep their number with "OMITTED" text).
 *
 * Returns a mapping from old scene IDs → new scene IDs for breakdown
 * remapping, plus a list of human-readable changes.
 */

export interface DiffResult {
  changes: SceneChange[];
  /** Map old scene ID → new scene ID (for scenes that matched by number) */
  idMap: Map<string, string>;
  /** Map old character ID → new character ID */
  characterIdMap: Map<string, string>;
  /** Summary counts */
  stats: {
    modified: number;
    added: number;
    omitted: number;
    unchanged: number;
  };
}

/** Normalise text for comparison — strip excess whitespace */
function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Check if a scene's content indicates it was omitted */
function isOmitted(scene: Scene): boolean {
  const lower = scene.scriptContent.toLowerCase().trim();
  return lower === 'omitted' || lower === 'omitted.' || lower.startsWith('omitted');
}

export function diffScripts(
  oldScenes: Scene[],
  newScenes: Scene[],
  oldCharacters: Character[],
  newCharacters: Character[],
): DiffResult {
  const changes: SceneChange[] = [];
  const idMap = new Map<string, string>();
  const characterIdMap = new Map<string, string>();

  // Build maps keyed by scene number
  const oldByNumber = new Map<number, Scene>();
  for (const s of oldScenes) {
    if (s.location !== 'PREAMBLE') oldByNumber.set(s.number, s);
  }

  const newByNumber = new Map<number, Scene>();
  for (const s of newScenes) {
    if (s.location !== 'PREAMBLE') newByNumber.set(s.number, s);
  }

  let modified = 0;
  let added = 0;
  let omitted = 0;
  let unchanged = 0;

  // Process all new scenes
  for (const [num, newScene] of newByNumber) {
    const oldScene = oldByNumber.get(num);

    if (!oldScene) {
      // Brand new scene
      added++;
      changes.push({
        sceneId: newScene.id,
        sceneNumber: num,
        changeType: 'added',
        summary: `New scene: ${newScene.intExt}. ${newScene.location} — ${newScene.dayNight}`,
        newContent: newScene.scriptContent,
      });
    } else {
      // Map old ID → new ID
      idMap.set(oldScene.id, newScene.id);

      if (isOmitted(newScene)) {
        // Scene was omitted in new draft
        omitted++;
        changes.push({
          sceneId: newScene.id,
          sceneNumber: num,
          changeType: 'omitted',
          summary: `Scene omitted: ${oldScene.intExt}. ${oldScene.location}`,
          oldContent: oldScene.scriptContent,
          newContent: newScene.scriptContent,
        });
      } else if (normalise(oldScene.scriptContent) !== normalise(newScene.scriptContent)) {
        // Content changed
        modified++;
        // Generate a brief summary of what changed
        const summary = generateChangeSummary(oldScene, newScene);
        changes.push({
          sceneId: newScene.id,
          sceneNumber: num,
          changeType: 'modified',
          summary,
          oldContent: oldScene.scriptContent,
          newContent: newScene.scriptContent,
        });
      } else {
        unchanged++;
      }
    }
  }

  // Check for scenes in old that are missing from new (removed entirely — unusual but possible)
  for (const [num, oldScene] of oldByNumber) {
    if (!newByNumber.has(num)) {
      omitted++;
      changes.push({
        sceneId: oldScene.id,
        sceneNumber: num,
        changeType: 'omitted',
        summary: `Scene removed: ${oldScene.intExt}. ${oldScene.location}`,
        oldContent: oldScene.scriptContent,
      });
    }
  }

  // Match characters by normalised name
  for (const oldChar of oldCharacters) {
    const match = newCharacters.find(
      (nc) => nc.name.toUpperCase().trim() === oldChar.name.toUpperCase().trim()
    );
    if (match) {
      characterIdMap.set(oldChar.id, match.id);
    }
  }

  // Sort changes by scene number
  changes.sort((a, b) => a.sceneNumber - b.sceneNumber);

  return {
    changes,
    idMap,
    characterIdMap,
    stats: { modified, added, omitted, unchanged },
  };
}

/** Generate a brief human-readable summary of content changes */
function generateChangeSummary(oldScene: Scene, newScene: Scene): string {
  const parts: string[] = [];

  // Check location change
  if (oldScene.location !== newScene.location) {
    parts.push(`Location changed to ${newScene.location}`);
  }

  // Check INT/EXT change
  if (oldScene.intExt !== newScene.intExt) {
    parts.push(`Changed to ${newScene.intExt}`);
  }

  // Check day/night change
  if (oldScene.dayNight !== newScene.dayNight) {
    parts.push(`Changed to ${newScene.dayNight}`);
  }

  // Check character changes
  const oldChars = new Set(oldScene.characterIds);
  const newChars = new Set(newScene.characterIds);
  const addedChars = [...newChars].filter((c) => !oldChars.has(c));
  const removedChars = [...oldChars].filter((c) => !newChars.has(c));
  if (addedChars.length > 0) parts.push(`${addedChars.length} character(s) added`);
  if (removedChars.length > 0) parts.push(`${removedChars.length} character(s) removed`);

  // Check content length change
  const oldLen = normalise(oldScene.scriptContent).length;
  const newLen = normalise(newScene.scriptContent).length;
  const diff = Math.abs(newLen - oldLen);
  if (diff > 50) {
    parts.push(newLen > oldLen ? 'Dialogue/action expanded' : 'Dialogue/action trimmed');
  }

  if (parts.length === 0) parts.push('Minor text changes');

  return parts.join('. ');
}
