/**
 * Story-day cascade helper.
 *
 * When the user manually confirms a scene's story day in the breakdown
 * form, every later scene's *suggested* day (the placeholder coming
 * from `scene.storyDay`) should shift to match. We compute a numeric
 * delta between the original detection and the user's value, then
 * re-stamp the day number on every scene after the anchor while
 * preserving the rest of the label (the existing "(?)" suffix that
 * marks inferred/inherited days, the "D" or "Day" prefix style, any
 * "Flashback" suffix, etc.).
 *
 * Cascading is skipped when:
 * - either value is missing a clean integer day number,
 * - the anchor or downstream scene is on a non-main timeline (its
 *   storyDay carries a Flashback/Dream/Memory marker — the deltas
 *   shouldn't bleed across timelines),
 * - delta is zero (no work to do).
 *
 * Returned tuple lets the caller persist only when something changed.
 */

import type { ParsedSceneData } from '@/stores/breakdownStore';

const DAY_PATTERN = /^\s*(?:D(?:ay)?\s*)?(\d+)\b/i;
const NON_MAIN_TIMELINE = /\b(?:flashback|dream|memory|fantasy|nightmare|vision)\b/i;

/** Extract the first integer-day number from a label like "D3 (?)" → 3. */
function extractDayNumber(label: string | undefined): number | null {
  if (!label) return null;
  const m = label.match(DAY_PATTERN);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/** Replace the first integer in `label` with `nextNum`, preserving the rest. */
function rewriteDayNumber(label: string, nextNum: number): string {
  return label.replace(/\d+/, String(nextNum));
}

export interface CascadeOptions {
  /** Sorted scene array (by `number`) — modifies a copy, not in place. */
  scenes: ParsedSceneData[];
  /** Number of the scene the user just confirmed. */
  anchorSceneNumber: number;
  /** The user-typed value (e.g. "D3", "Day 3", "3"). */
  newDayValue: string;
  /** Original storyDay label of the anchor scene before the edit. */
  anchorOriginalLabel: string;
}

export interface CascadeResult {
  /** Scenes the cascade ended up changing — empty when nothing applied. */
  changed: ParsedSceneData[];
  /** All scenes (post-cascade) — caller can persist this whole array. */
  scenes: ParsedSceneData[];
  /** Reason the cascade was a no-op, when applicable. */
  skippedReason?: 'no-anchor-number' | 'no-new-number' | 'non-main-timeline' | 'zero-delta';
}

export function cascadeStoryDays(opts: CascadeOptions): CascadeResult {
  const { scenes, anchorSceneNumber, newDayValue, anchorOriginalLabel } = opts;

  const newNum = extractDayNumber(newDayValue);
  if (newNum === null) {
    return { changed: [], scenes, skippedReason: 'no-new-number' };
  }
  const oldNum = extractDayNumber(anchorOriginalLabel);
  if (oldNum === null) {
    return { changed: [], scenes, skippedReason: 'no-anchor-number' };
  }
  if (NON_MAIN_TIMELINE.test(anchorOriginalLabel) || NON_MAIN_TIMELINE.test(newDayValue)) {
    return { changed: [], scenes, skippedReason: 'non-main-timeline' };
  }
  const delta = newNum - oldNum;
  if (delta === 0) {
    return { changed: [], scenes, skippedReason: 'zero-delta' };
  }

  const changed: ParsedSceneData[] = [];
  const next = scenes.map((s) => {
    if (s.number <= anchorSceneNumber) return s;
    if (!s.storyDay) return s;
    if (NON_MAIN_TIMELINE.test(s.storyDay)) return s;
    const oldSceneNum = extractDayNumber(s.storyDay);
    if (oldSceneNum === null) return s;
    const updated = { ...s, storyDay: rewriteDayNumber(s.storyDay, oldSceneNum + delta) };
    changed.push(updated);
    return updated;
  });

  return { changed, scenes: next };
}
