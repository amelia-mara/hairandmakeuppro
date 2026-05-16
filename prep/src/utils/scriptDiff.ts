import type { Scene, Character, SceneChange } from '@/stores/breakdownStore';

/**
 * Compare two script revisions and produce a list of scene-level changes.
 *
 * Matching strategy:
 *   1. Primary — composite key of `scene.number + numberSuffix`. Screenplay
 *      convention preserves scene numbers across drafts, and the suffix
 *      keeps 132 / 132A distinct (a previous version used `Map<number>`
 *      which silently collapsed suffixed scenes onto their parent).
 *   2. Fallback — content similarity. For old scenes that have no
 *      matching key in the new draft, we look for an unmatched new scene
 *      with the same location + INT/EXT + day-night + a substantive head
 *      of the script content matching. This catches the case where the
 *      writer adds or removes a scene and the downstream numbering
 *      cascades, which would otherwise orphan all the breakdown work
 *      below the inserted/removed point.
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

/** Composite key for primary scene matching. number alone collapses
 *  132 and 132A (writer-added split scenes) onto each other; the
 *  suffix keeps them distinct. */
function sceneKey(s: Scene): string {
  return `${s.number}|${s.numberSuffix ?? ''}`;
}

/** Normalised location for content-similarity matching — uppercase,
 *  strip punctuation noise that varies between drafts. */
function normaliseLocation(s: Scene): string {
  return s.location.toUpperCase().replace(/[^A-Z0-9, '&]/g, '').replace(/\s+/g, ' ').trim();
}

/** First ~120 characters of the body content for content similarity.
 *  Skips the slugline if it was inlined, normalises whitespace so
 *  reflow doesn't break the match. */
function contentHead(s: Scene): string {
  return s.scriptContent.replace(/\s+/g, ' ').trim().slice(0, 120);
}

/**
 * Score how confidently `a` and `b` are the same scene across drafts.
 *
 * Hard gates: location, INT/EXT, day-night must all align — a scene
 * that swaps from EXT BEACH DAY to INT KITCHEN NIGHT is almost
 * certainly a different scene even if its dialogue overlaps.
 *
 * Soft signals: content-head match (the first ~120 chars line up) and
 * body-length similarity (writers usually preserve scene length when
 * just renumbering). Threshold of 50 means we need at least one
 * strong signal — full head match OR partial head + length within
 * 20%. Bumped low enough that 30-char head + similar length still
 * counts as a recoverable match, high enough that two coincidentally
 * similar scenes (e.g. two MMA GYM scenes) don't cross-match.
 */
function contentMatchScore(a: Scene, b: Scene): number {
  if (normaliseLocation(a) !== normaliseLocation(b)) return 0;
  if (a.intExt !== b.intExt) return 0;
  if (a.dayNight !== b.dayNight) return 0;
  if (!!a.isOmitted !== !!b.isOmitted) return 0;
  if (a.location === 'PRELUDE' || b.location === 'PRELUDE') return 0;

  const headA = contentHead(a);
  const headB = contentHead(b);
  if (headA.length < 20 || headB.length < 20) return 0;

  let score = 0;
  if (headA === headB) score += 100;
  else if (headA.slice(0, 60) === headB.slice(0, 60)) score += 60;
  else if (headA.slice(0, 30) === headB.slice(0, 30)) score += 30;

  const lenA = a.scriptContent.length;
  const lenB = b.scriptContent.length;
  if (lenA > 0 && lenB > 0) {
    const ratio = Math.min(lenA, lenB) / Math.max(lenA, lenB);
    score += Math.round(ratio * 20);
  }
  return score;
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

  // Skip PRELUDE/PREAMBLE in both maps — those are synthetic title-page
  // wrappers, not script scenes the diff is meant to track.
  const isReal = (s: Scene) => s.location !== 'PREAMBLE' && s.location !== 'PRELUDE';

  // Build maps keyed by (number, numberSuffix) — composite key keeps
  // 132 and 132A distinct, which a plain integer-keyed Map would not.
  const oldByKey = new Map<string, Scene>();
  for (const s of oldScenes) {
    if (isReal(s)) oldByKey.set(sceneKey(s), s);
  }
  const newByKey = new Map<string, Scene>();
  for (const s of newScenes) {
    if (isReal(s)) newByKey.set(sceneKey(s), s);
  }

  let modified = 0;
  let added = 0;
  let omitted = 0;
  let unchanged = 0;

  // ── Pass 1: key-based matching (the common case) ──────────────
  const matchedOld = new Set<string>();
  const matchedNew = new Set<string>();
  for (const [key, newScene] of newByKey) {
    const oldScene = oldByKey.get(key);
    if (!oldScene) continue;
    idMap.set(oldScene.id, newScene.id);
    matchedOld.add(oldScene.id);
    matchedNew.add(newScene.id);
  }

  // ── Pass 2: content-similarity fallback for orphans ───────────
  // Renumbering cascades (writer inserts a new scene mid-script and
  // every scene below shifts by one) leave many "old" scenes without
  // a key match in the new draft, even though the same scene is
  // sitting at a different number in the new list. Rather than
  // marking all of those as removed + added and losing every
  // breakdown row below the insertion point, we walk the orphans and
  // try a hard-gated content match — same location, same INT/EXT,
  // same day-night, plus a strong head-of-content overlap.
  const unmatchedNew = newScenes.filter((s) => isReal(s) && !matchedNew.has(s.id));
  const unmatchedOld = oldScenes.filter((s) => isReal(s) && !matchedOld.has(s.id));
  const newClaimed = new Set<string>();
  for (const oldScene of unmatchedOld) {
    let bestMatch: Scene | null = null;
    let bestScore = 0;
    for (const candidate of unmatchedNew) {
      if (newClaimed.has(candidate.id)) continue;
      const score = contentMatchScore(oldScene, candidate);
      if (score > bestScore && score >= 50) {
        bestScore = score;
        bestMatch = candidate;
      }
    }
    if (bestMatch) {
      idMap.set(oldScene.id, bestMatch.id);
      matchedOld.add(oldScene.id);
      matchedNew.add(bestMatch.id);
      newClaimed.add(bestMatch.id);
    }
  }

  // ── Pass 3: emit change entries for every new scene ───────────
  for (const [, newScene] of newByKey) {
    // Find the old scene we mapped to this new one (if any) by
    // walking idMap in reverse — small N so this is fine.
    let oldScene: Scene | undefined;
    for (const [oldId, newId] of idMap) {
      if (newId === newScene.id) {
        oldScene = oldScenes.find((s) => s.id === oldId);
        break;
      }
    }

    if (!oldScene) {
      added++;
      changes.push({
        sceneId: newScene.id,
        sceneNumber: newScene.number,
        changeType: 'added',
        summary: `New scene: ${newScene.intExt}. ${newScene.location} — ${newScene.dayNight}`,
        newContent: newScene.scriptContent,
      });
      continue;
    }

    if (isOmitted(newScene)) {
      omitted++;
      changes.push({
        sceneId: newScene.id,
        sceneNumber: newScene.number,
        changeType: 'omitted',
        summary: `Scene omitted: ${oldScene.intExt}. ${oldScene.location}`,
        oldContent: oldScene.scriptContent,
        newContent: newScene.scriptContent,
      });
    } else if (normalise(oldScene.scriptContent) !== normalise(newScene.scriptContent)) {
      modified++;
      changes.push({
        sceneId: newScene.id,
        sceneNumber: newScene.number,
        changeType: 'modified',
        summary: generateChangeSummary(oldScene, newScene),
        oldContent: oldScene.scriptContent,
        newContent: newScene.scriptContent,
      });
    } else {
      unchanged++;
    }
  }

  // Check for scenes in old that are missing from new (removed
  // entirely — unusual but possible). Excludes scenes we content-matched.
  for (const oldScene of oldScenes) {
    if (!isReal(oldScene)) continue;
    if (matchedOld.has(oldScene.id)) continue;
    omitted++;
    changes.push({
      sceneId: oldScene.id,
      sceneNumber: oldScene.number,
      changeType: 'omitted',
      summary: `Scene removed: ${oldScene.intExt}. ${oldScene.location}`,
      oldContent: oldScene.scriptContent,
    });
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
