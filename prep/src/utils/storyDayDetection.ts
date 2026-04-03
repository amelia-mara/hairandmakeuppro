/**
 * ============================================================
 * STORY DAY DETECTION v3 - Implementation Brief for Claude Code
 * ============================================================
 *
 * File:         prep/src/utils/storyDayDetection.ts
 * Replaces:     buildStoryDayMap(), getTimeOrder(), isExplicitNewDay(),
 *               isNewStoryDay() in lookGenerator.ts + castSyncService.ts
 *
 * Verified against: CBAD_StoryDay_Breakdown.pdf (Kaya Moore, Script Supervisor)
 *                   94 scenes, 25 story days, D1–D25.
 *
 * ─────────────────────────────────────────────────────────────
 * THE 10 RULES (read these first, implement second)
 * ─────────────────────────────────────────────────────────────
 *
 *  1. OUTPUT is sequential integers (Day 1, 2, 3...) NOT elapsed days.
 *     "One week later" → dayCounter +1, note = "One week later". Not +7.
 *
 *  2. PRIMARY SIGNAL is the action line, not TOD. Scan first 350 chars
 *     of action text (dialogue stripped) for time markers.
 *
 *  3. EPISODE HEADERS (EPISODE 1, EPISODE 2...) are stripped before
 *     processing. They never increment the day counter.
 *
 *  4. TRAILING SCENE NUMBERS on sluglines are stripped before TOD
 *     classification. "INT. OFFICE - NIGHT 4" → TOD is NIGHT, not NIGHT4.
 *
 *  5. FLASHBACKS are assigned to the story time they DEPICT (e.g. N1),
 *     not where they sit in the script. Always flag for manual review.
 *
 *  6. CONCURRENT THREADS (London scenes while farm is primary location)
 *     get the same story day as the primary thread. Do NOT increment.
 *
 *  7. CONTINUOUS / MOMENTS LATER / LATER in the TOD field:
 *     (a) same day as previous — never increment, and
 *     (b) do NOT update prevRealTOD baseline (critical for the next comparison).
 *
 *  8. NIGHT→DAY = new story day (overnight transition). INCREMENT.
 *     DAY→NIGHT = same story day (evening of same day). DO NOT increment.
 *     NIGHT→NIGHT = ambiguous. Default same day, flag for review.
 *
 *  9. D12 has 11 consecutive scenes (Sc 43-53). "Too many scenes" on one
 *     day is not an error. Do not add artificial breaks.
 *
 * 10. DIALOGUE time cues ("The funeral is next Friday") are spoken by
 *     characters, not action. Strip dialogue before scanning action lines.
 */

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type TODClass =
  | 'DAWN' | 'MORNING' | 'DAY' | 'AFTERNOON'
  | 'DUSK' | 'EVENING' | 'NIGHT' | 'MIDNIGHT'
  | 'CONTINUOUS' | 'LATER' | 'UNKNOWN';

export type Timeline = 'present' | 'flashback' | 'concurrent' | 'epilogue';

export type Confidence =
  | 'very-high'  // explicit text marker, verified against official breakdown
  | 'high'       // TOD regression, clear continuity, CONTINUOUS lock
  | 'medium'     // concurrent thread, post-flashback return, implied arrival break
  | 'low'        // ambiguous NIGHT→NIGHT, episode break with no other signal
  | 'assumed';   // default — no signal found at all

export interface RawScene {
  slugline: string;
  /** Action/description lines only — no dialogue blocks */
  actionLines: string[];
  /** Optional: full scene text including dialogue, for flashback offset parsing */
  fullText?: string;
}

export interface ParsedScene extends RawScene {
  sceneNumber: string;
  intExt: 'INT' | 'EXT' | 'INT/EXT' | 'UNKNOWN';
  location: string;
  rawTOD: string;
  tod: TODClass;
  isFlashback: boolean;
  flashbackOffset?: string;
}

export interface StoryDayResult {
  sceneNumber: string;
  /** Sequential integer: 1, 2, 3... regardless of narrative gaps */
  storyDay: number;
  /** Display label: "D1", "D2"... or "N1", "N7"... */
  storyDayLabel: string;
  tod: TODClass;
  timeline: Timeline;
  /** Human-readable gap note e.g. "One week later", "6 months later" */
  timeGapNote?: string;
  confidence: Confidence;
  /** The signal that drove this assignment */
  signal: string;
  /** True = surface in "Review Story Days" UI for manual confirmation */
  requiresReview: boolean;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const NIGHT_SET  = new Set<TODClass>(['NIGHT', 'MIDNIGHT', 'EVENING', 'DUSK']);
const DAY_SET    = new Set<TODClass>(['DAY', 'MORNING', 'DAWN', 'AFTERNOON']);
const LOCK_SET   = new Set<TODClass>(['CONTINUOUS', 'LATER', 'UNKNOWN']);

/** TOD words that appear verbatim in sluglines, in order of day */
const TOD_KEYWORDS: [RegExp, TODClass][] = [
  [/\bDAWN\b/,       'DAWN'],
  [/\bMORNING\b/,    'MORNING'],
  [/\bAFTERNOON\b/,  'AFTERNOON'],
  [/\bDAY\b/,        'DAY'],
  [/\bDUSK\b/,       'DUSK'],
  [/\bEVENING\b/,    'EVENING'],
  [/\bMIDNIGHT\b/,   'MIDNIGHT'],
  [/\bNIGHT\b/,      'NIGHT'],
  [/\bCONTINUOUS\b/, 'CONTINUOUS'],
  [/\bLATER\b/,      'LATER'],
];

// ─────────────────────────────────────────────────────────────
// STEP 0: Pre-processing — strip episode headers
// ─────────────────────────────────────────────────────────────

export function stripEpisodeHeaders(rawText: string): string {
  return rawText.replace(/^EPISODE\s+\d+[A-Z]?\s*$/gim, '');
}

// ─────────────────────────────────────────────────────────────
// STEP 1: TOD classification — strips trailing scene numbers
// ─────────────────────────────────────────────────────────────

export function classifyTOD(rawTOD: string): TODClass {
  let s = rawTOD.trim().toUpperCase();
  s = s.replace(/\s+\d+\s*$/, '');
  s = s.replace(/\s*\(.*?\)\s*/g, '');
  s = s.replace(/\s*\[.*?\]\s*/g, '');
  s = s.trim();

  for (const [regex, tod] of TOD_KEYWORDS) {
    if (regex.test(s)) return tod;
  }
  return 'UNKNOWN';
}

// ─────────────────────────────────────────────────────────────
// STEP 2: Slugline parser
// ─────────────────────────────────────────────────────────────

export function parseSlugline(
  rawSlugline: string,
  actionLines: string[],
  sceneIndex: number,
): ParsedScene {
  let slug = rawSlugline.trim();

  // Handle OMITTED scenes
  if (/^(\d+[A-Z]?)\s+OMITTED\s*$/i.test(slug)) {
    return {
      slugline: rawSlugline,
      actionLines,
      sceneNumber: slug.match(/^(\d+[A-Z]?)/i)?.[1] ?? String(sceneIndex + 1),
      intExt: 'UNKNOWN',
      location: 'OMITTED',
      rawTOD: '',
      tod: 'UNKNOWN',
      isFlashback: false,
    };
  }

  // Extract leading scene number: "14 INT. ..." or "36A EXT. ..."
  let sceneNumber = String(sceneIndex + 1);
  const leadMatch = slug.match(/^(\d+[A-Z]?)\s+(INT|EXT|I\/E)/i);
  if (leadMatch) {
    sceneNumber = leadMatch[1];
    slug = slug.slice(leadMatch[1].length).trim();
  }

  // INT/EXT
  let intExt: ParsedScene['intExt'] = 'UNKNOWN';
  if (/^INT\.\/EXT\.|^I\/E\./i.test(slug)) intExt = 'INT/EXT';
  else if (/^INT\./i.test(slug))            intExt = 'INT';
  else if (/^EXT\./i.test(slug))            intExt = 'EXT';

  // Split on last dash/em-dash/en-dash to get location + TOD
  const dashRx = /^(.*?)\s*[-\u2013\u2014]\s*([^-\u2013\u2014]+?)\s*(?:\d+\s*)?$/;
  const dashMatch = slug.match(dashRx);
  let location = slug.replace(/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s*/i, '').trim();
  let rawTOD = '';
  if (dashMatch) {
    location = dashMatch[1].replace(/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)\s*/i, '').trim();
    rawTOD = dashMatch[2].trim();
  }

  const tod = classifyTOD(rawTOD);

  // Flashback detection: check slug modifiers AND first action line
  const slugFlashback =
    /\[FLASHBACK\]/i.test(rawSlugline) ||
    /\(FLASHBACK\)/i.test(rawSlugline) ||
    /\(MEMORY\)/i.test(rawSlugline)    ||
    /\[MEMORY\]/i.test(rawSlugline)    ||
    /\(DREAM\)/i.test(rawSlugline);

  const firstAction = actionLines[0]?.trim() ?? '';
  const actionFlashback =
    /^FLASHBACK\s*[:\u2013\-]/i.test(firstAction) ||
    /^FLASH\s+BACK\s*[:\u2013\-]/i.test(firstAction);

  const isFlashback = slugFlashback || actionFlashback;

  let flashbackOffset: string | undefined;
  if (isFlashback) {
    const m = firstAction.match(
      /(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty)\s+(years?|months?|weeks?|days?)\s*(ago|earlier|before)?/i
    );
    if (m) flashbackOffset = m[0];
  }

  return {
    slugline: rawSlugline,
    actionLines,
    sceneNumber,
    intExt,
    location,
    rawTOD,
    tod,
    isFlashback,
    flashbackOffset,
  };
}

// ─────────────────────────────────────────────────────────────
// STEP 3: Strip dialogue from action text
// ─────────────────────────────────────────────────────────────

function stripDialogue(lines: string[]): string {
  const out: string[] = [];
  let inDialogue = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { inDialogue = false; continue; }

    const isCharName = /^[A-Z][A-Z\s\.']+(\s*\(.*?\))?\s*$/.test(line) && line.length < 40;
    if (isCharName) { inDialogue = true; continue; }

    if (inDialogue) {
      if (/^\(.*\)$/.test(line)) continue;
      if (/^[a-z]/.test(line) || /^[A-Z][a-z]/.test(line)) continue;
      inDialogue = false;
    }

    out.push(line);
  }

  return out.join(' ');
}

// ─────────────────────────────────────────────────────────────
// STEP 4: Tier 1A — Action line pattern matching
// ─────────────────────────────────────────────────────────────

type ActionSignalType = 'new-day' | 'same-day' | 'flashback' | 'large-jump';

interface ActionSignal {
  type: ActionSignalType;
  confidence: Confidence;
  note: string;
  match: string;
}

const TIER1A_PATTERNS: Array<{
  regex: RegExp;
  type: ActionSignalType;
  confidence: Confidence;
  note: (m: RegExpMatchArray) => string;
}> = [
  // Large time jumps
  {
    regex: /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|eighteen|twenty)\s+months?\s+later\b/i,
    type: 'large-jump', confidence: 'very-high',
    note: m => m[0],
  },
  {
    regex: /\b(\d+|one|two|three|four|five|ten|twenty)\s+years?\s+later\b/i,
    type: 'large-jump', confidence: 'very-high',
    note: m => m[0],
  },
  // New day markers
  {
    regex: /\bthe\s+next\s+day\b/i,
    type: 'new-day', confidence: 'very-high',
    note: () => 'The next day',
  },
  {
    regex: /\bthe?\s+following\s+(morning|day|afternoon|evening)\b/i,
    type: 'new-day', confidence: 'very-high',
    note: m => m[0],
  },
  {
    regex: /\bnext\s+morning\b/i,
    type: 'new-day', confidence: 'very-high',
    note: () => 'Next morning',
  },
  {
    regex: /\bdawn\s+breaks?\b/i,
    type: 'new-day', confidence: 'very-high',
    note: () => 'Dawn breaks',
  },
  {
    regex: /\b(\d+|one|two|three|four|five|six|seven)\s+days?\s+later\b/i,
    type: 'new-day', confidence: 'very-high',
    note: m => m[0],
  },
  {
    regex: /\b(\d+|one|two|three|four|five|six)\s+weeks?\s+later\b/i,
    type: 'new-day', confidence: 'very-high',
    note: m => m[0],
  },
  {
    regex: /\bsome\s+time\s+later\b/i,
    type: 'new-day', confidence: 'high',
    note: () => 'Some time later',
  },
  // Wake-up scene — strong hint of a new morning, but medium confidence
  // because "wakes up" could occasionally be mid-day nap. Flagged for review.
  {
    regex: /\b(wakes?\s+up|waking\s+up|woke\s+up)\b/i,
    type: 'new-day', confidence: 'medium',
    note: m => `"${m[0]}" \u2014 morning scene`,
  },
  // Same-day markers
  {
    regex: /\bthat\s+(same\s+)?(morning|afternoon|evening|night)\b/i,
    type: 'same-day', confidence: 'high',
    note: m => m[0],
  },
  {
    regex: /\blater\s+that\s+(day|morning|afternoon|evening|night)\b/i,
    type: 'same-day', confidence: 'high',
    note: m => m[0],
  },
  {
    regex: /\bshortly\s+(after|later)\b/i,
    type: 'same-day', confidence: 'high',
    note: m => m[0],
  },
  {
    regex: /\ba\s+(moment|beat|little\s+later|short\s+time)\b/i,
    type: 'same-day', confidence: 'high',
    note: m => m[0],
  },
];

const TITLE_CARD_PATTERNS: RegExp[] = [
  /\b(\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|TWELVE|EIGHTEEN|TWENTY)\s+MONTHS?\s+LATER\b/,
  /\b(\d+|ONE|TWO|THREE|FOUR|FIVE|TEN|TWENTY)\s+YEARS?\s+LATER\b/,
  /\bTITLE\s+CARD\s*:\s*.+/,
  /^\s*(\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN)\s+DAYS?\s+LATER\s*$/m,
  /\b(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY),\s+\w+\s+\d+/,
  /\b\d{1,2}(?:ST|ND|RD|TH)?\s+(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+\d{4}/i,
  /^\s*(CHRISTMAS|VALENTINE'S\s+DAY|NEW\s+YEAR'S|HALLOWEEN)\s*$/im,
];

function scanActionLines(actionLines: string[]): ActionSignal | null {
  const text = stripDialogue(actionLines).slice(0, 350);
  for (const p of TIER1A_PATTERNS) {
    const m = text.match(p.regex);
    if (m) return { type: p.type, confidence: p.confidence, note: p.note(m), match: m[0] };
  }
  return null;
}

function scanTitleCards(text: string): { found: true; note: string } | { found: false } {
  for (const rx of TITLE_CARD_PATTERNS) {
    const m = text.match(rx);
    if (m) return { found: true, note: m[0].trim() };
  }
  return { found: false };
}

// ─────────────────────────────────────────────────────────────
// STEP 5: TOD regression
// ─────────────────────────────────────────────────────────────

type RegressionResult = 'new-day' | 'same-day' | 'ambiguous';

function checkTODRegression(prev: TODClass, curr: TODClass): RegressionResult {
  if (LOCK_SET.has(prev) || LOCK_SET.has(curr)) return 'ambiguous';
  if (NIGHT_SET.has(prev) && DAY_SET.has(curr))  return 'new-day';
  if (DAY_SET.has(prev)   && NIGHT_SET.has(curr)) return 'same-day';
  if (DAY_SET.has(prev)   && DAY_SET.has(curr))   return 'same-day';
  if (NIGHT_SET.has(prev) && NIGHT_SET.has(curr)) return 'ambiguous';
  return 'ambiguous';
}

// ─────────────────────────────────────────────────────────────
// STEP 6: Concurrent thread detection
// ─────────────────────────────────────────────────────────────

const CONCURRENT_LOC_RX: RegExp[] = [
  /\blondon\b/i,
  /\bcanary\s+wharf\b/i,
  /\bcity.*office\b/i,
];

function isConcurrentThread(curr: ParsedScene, prev: ParsedScene | null): boolean {
  if (!prev) return false;
  const currLoc = curr.location.toLowerCase();
  const prevLoc = prev.location.toLowerCase();
  const currIsConcurrent = CONCURRENT_LOC_RX.some(r => r.test(currLoc));
  const prevWasNotConcurrent = !CONCURRENT_LOC_RX.some(r => r.test(prevLoc));
  const sameTOD = curr.tod === prev.tod;
  return currIsConcurrent && prevWasNotConcurrent && sameTOD;
}

// ─────────────────────────────────────────────────────────────
// STEP 7: Implied arrival break
// ─────────────────────────────────────────────────────────────

function checkImpliedArrivalBreak(prev: ParsedScene, curr: ParsedScene): boolean {
  const currText = curr.actionLines.join(' ').toLowerCase();
  const prevText = prev.actionLines.join(' ').toLowerCase();

  const arrivalRx = [/\bsuitcase\b/, /\barrives?\s+(at|with)\b/, /\bdriveway\b/];
  const prevEndRx  = [/\bargument\b/, /\bconfrontation\b/, /\bdecision\b/, /\bagreement\b/, /\bultimatum\b/];

  return (
    arrivalRx.some(r => r.test(currText)) &&
    prevEndRx.some(r => r.test(prevText)) &&
    DAY_SET.has(curr.tod) &&
    DAY_SET.has(prev.tod)
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN: buildStoryDayMap
// ─────────────────────────────────────────────────────────────

export function buildStoryDayMap(scenes: ParsedScene[]): StoryDayResult[] {
  const results: StoryDayResult[] = [];

  let dayCounter = 1;
  let prevRealTOD: TODClass | null = null;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const prev  = i > 0 ? scenes[i - 1] : null;

    const push = (
      partialDay: number,
      partialLabel: string,
      timeline: Timeline,
      confidence: Confidence,
      signal: string,
      note?: string,
      updateTOD = true,
    ): void => {
      results.push({
        sceneNumber:    scene.sceneNumber,
        storyDay:       partialDay,
        storyDayLabel:  partialLabel,
        tod:            scene.tod,
        timeline,
        timeGapNote:    note,
        confidence,
        signal,
        requiresReview: confidence === 'medium' || confidence === 'low' || confidence === 'assumed' || timeline !== 'present',
      });
      if (updateTOD && !LOCK_SET.has(scene.tod)) prevRealTOD = scene.tod;
    };

    const makeLabel = (n: number) =>
      NIGHT_SET.has(scene.tod) ? `N${n}` : `D${n}`;

    // FLASHBACK
    if (scene.isFlashback) {
      push(
        1, 'N1',
        'flashback',
        'very-high',
        `FLASHBACK: "${scene.flashbackOffset ?? scene.actionLines[0]?.trim()}"`,
        scene.flashbackOffset ? `Flashback \u2013 ${scene.flashbackOffset}` : 'Flashback',
        false,
      );
      continue;
    }

    // FIRST SCENE
    if (i === 0) {
      push(dayCounter, makeLabel(dayCounter), 'present', 'very-high', 'DEFAULT: first scene');
      continue;
    }

    // TIER 1B: Title card
    const titleCard = scanTitleCards(scene.fullText ?? scene.actionLines.join('\n'));
    if (titleCard.found) {
      dayCounter++;
      push(dayCounter, makeLabel(dayCounter), 'present', 'very-high', `TITLE CARD: "${titleCard.note}"`, titleCard.note);
      continue;
    }

    // TIER 1A: Explicit action line signal
    const actionSig = scanActionLines(scene.actionLines);

    if (actionSig?.type === 'new-day' || actionSig?.type === 'large-jump') {
      dayCounter++;
      push(dayCounter, makeLabel(dayCounter), 'present', actionSig.confidence, `ACTION: "${actionSig.match}"`, actionSig.note);
      continue;
    }

    if (actionSig?.type === 'same-day') {
      push(dayCounter, makeLabel(dayCounter), 'present', actionSig.confidence, `ACTION same-day: "${actionSig.match}"`);
      continue;
    }

    // TIER 3: Concurrent thread
    if (isConcurrentThread(scene, prev)) {
      push(
        dayCounter, makeLabel(dayCounter), 'concurrent', 'medium',
        `CONCURRENT: ${scene.location}`,
        undefined,
        false,
      );
      continue;
    }

    // TIER 4: CONTINUOUS / LATER lock
    if (LOCK_SET.has(scene.tod)) {
      push(
        dayCounter, makeLabel(dayCounter), 'present', 'high',
        `TOD LOCK: ${scene.tod}`,
        undefined,
        false,
      );
      continue;
    }

    // TIER 5: TOD regression
    if (prevRealTOD !== null) {
      const regression = checkTODRegression(prevRealTOD, scene.tod);

      if (regression === 'new-day') {
        dayCounter++;
        push(dayCounter, makeLabel(dayCounter), 'present', 'high', `TOD REGRESSION: ${prevRealTOD}\u2192${scene.tod}`);
        continue;
      }

      if (regression === 'same-day') {
        push(dayCounter, makeLabel(dayCounter), 'present', 'high', `TOD: ${prevRealTOD}\u2192${scene.tod} (same day)`);
        continue;
      }

      // NIGHT→NIGHT ambiguous — try Tier 1C
      if (prev && checkImpliedArrivalBreak(prev, scene)) {
        dayCounter++;
        push(dayCounter, makeLabel(dayCounter), 'present', 'medium', 'IMPLIED OVERNIGHT: arrival-with-luggage after major scene beat');
        continue;
      }

      // Ambiguous default: same day, flag for review
      push(dayCounter, makeLabel(dayCounter), 'present', 'low', `AMBIGUOUS: ${prevRealTOD}\u2192${scene.tod}`);
      continue;
    }

    // TIER 6: Default
    push(dayCounter, makeLabel(dayCounter), 'present', 'assumed', 'DEFAULT: no signal found');
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// UI CONFIDENCE → COLOUR MAPPING
// ─────────────────────────────────────────────────────────────

export const CONFIDENCE_COLOURS: Record<Confidence, { bg: string; text: string; label: string }> = {
  'very-high': { bg: '#D4EDDA', text: '#155724', label: 'Confirmed'        },
  'high':      { bg: '#D4EDDA', text: '#155724', label: 'High confidence'  },
  'medium':    { bg: '#FFF3CD', text: '#856404', label: 'Review suggested' },
  'low':       { bg: '#FFF3CD', text: '#856404', label: 'Review required'  },
  'assumed':   { bg: '#F8D7DA', text: '#721C24', label: 'Manual confirm'   },
};
