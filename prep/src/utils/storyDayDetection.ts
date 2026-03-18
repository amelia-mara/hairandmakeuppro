/**
 * STORY DAY DETECTION - v2
 *
 * Analysed three real scripts to find all the ways story days are signalled:
 *
 *   Cowboys After Dark  - Simple structure. Day/Night only. New days signalled
 *                         almost entirely via action lines ("The next day,") and
 *                         NIGHT -> DAY regressions. No numbered scenes.
 *
 *   EMD (Christie)      - Complex: MEMORY, FLASHBACK, PRESENT qualifiers.
 *                         Uses dashes AND em-dashes. TOD includes multi-word
 *                         phrases like "THE NEXT DAY", "EARLY MORNING",
 *                         "A LITTLE LATER". Calendar dates appear as title
 *                         cards in action lines ("FRIDAY, DECEMBER 3, 1926").
 *
 *   Killa Bee           - Numbered scene format: "14 INT. LOCATION - NIGHT 14"
 *                         Uses [FLASHBACK] and [PRESENT] bracket notation.
 *                         Strong use of action line title cards ("12 years later",
 *                         "Valentine's Day", "12th March 2020", "Christmas").
 *                         CONTINUOUS and LATER used heavily within a story day.
 *
 * KEY FINDINGS vs. current parser:
 *
 *  1. ACTION LINE TRANSITIONS are the primary signal in many scripts,
 *     not TOD regressions. "The next day," in the first action line after
 *     a slugline is the most reliable indicator. Current parser misses these.
 *
 *  2. CONTINUOUS / MOMENTS LATER / A LITTLE LATER must NOT trigger a new day
 *     and must NOT update the prev_time_order baseline.
 *
 *  3. MEMORY / FLASHBACK / DREAM scenes should be excluded from the day
 *     counter or tracked as a parallel timeline. Merging them into the main
 *     story day sequence breaks continuity tracking for HMU.
 *
 *  4. CALENDAR DATE title cards ("FRIDAY, DECEMBER 3, 1926", "12th March 2020",
 *     "Valentine's Day", "Christmas") are strong explicit new-day signals.
 *
 *  5. TIME JUMP phrases in action lines ("12 years later", "6 months later",
 *     "Later that night") also trigger new days.
 *
 *  6. TOD field can contain junk room names (EMD uses "INT. STYLES - KITCHEN"
 *     split incorrectly). Parser must handle multi-segment sluglines gracefully.
 *
 *  7. NIGHT -> morning/day regression is reliable. DAY -> NIGHT within same
 *     run is NOT a new day. DAY -> NIGHT -> DAY IS a new day.
 */

// ─── Time ordering ───────────────────────────────────────────────────────────

export type TimeOfDay =
  | 'PRE_DAWN'
  | 'DAWN'
  | 'MORNING'
  | 'AFTERNOON'
  | 'DAY'
  | 'DUSK'
  | 'EVENING'
  | 'NIGHT'
  | 'MIDNIGHT'
  | 'CONTINUOUS'
  | 'LATER'
  | 'UNKNOWN';

const TIME_ORDER: Record<TimeOfDay, number> = {
  PRE_DAWN:   0,
  DAWN:       0,
  MORNING:    1,
  AFTERNOON:  2,
  DAY:        2,
  DUSK:       3,
  EVENING:    3,
  NIGHT:      4,
  MIDNIGHT:   4,
  CONTINUOUS: -1, // excluded from baseline
  LATER:      -1, // excluded from baseline
  UNKNOWN:    -1,
};

/** Map raw TOD string to a TimeOfDay bucket. */
export function classifyTOD(raw: string): TimeOfDay {
  const t = raw.toUpperCase();
  // Qualifiers that mean "same continuous scene" - never a new day
  if (/\bCONTINUOUS\b/.test(t))                    return 'CONTINUOUS';
  if (/\bMOMENTS?\s+LATER\b/.test(t))               return 'CONTINUOUS';
  if (/\bA\s+LITTLE\s+LATER\b/.test(t))             return 'CONTINUOUS';
  // Explicit "LATER" without other TOD - treat as same day, unknown order
  if (/^\s*LATER\s*$/.test(t))                      return 'LATER';
  if (/\bPRE[-\s]?DAWN\b/.test(t))                  return 'PRE_DAWN';
  if (/\bDAWN\b|\bSUNRISE\b/.test(t))               return 'DAWN';
  if (/\bEARLY\s+MORNING\b|\bMORNING\b/.test(t))    return 'MORNING';
  if (/\bAFTERNOON\b|\bMIDDAY\b|\bNOON\b/.test(t)) return 'AFTERNOON';
  if (/\bGOLDEN\s+HOUR\b|\bDUSK\b|\bSUNSET\b/.test(t)) return 'DUSK';
  if (/\bEVENING\b/.test(t))                        return 'EVENING';
  if (/\bMIDNIGHT\b/.test(t))                       return 'MIDNIGHT';
  if (/\bNIGHT\b/.test(t))                          return 'NIGHT';
  if (/\bDAY\b/.test(t))                            return 'DAY';
  return 'UNKNOWN';
}

// ─── Scene metadata ──────────────────────────────────────────────────────────

export interface ParsedScene {
  /** Scene number from slug if present, e.g. "14" */
  sceneNumber: string;
  /** Full slugline text */
  slugline: string;
  /** Raw TOD string extracted from slugline */
  rawTOD: string;
  /** Classified TOD */
  tod: TimeOfDay;
  /** True if scene is flagged as MEMORY / FLASHBACK / DREAM */
  isNonPresent: boolean;
  /** First 3 lines of action text immediately after the slugline */
  actionLines: string[];
}

/** Extract the last segment after a dash/em-dash from a slugline as the TOD. */
export function extractTOD(slugline: string): string {
  // Split on " - " or " – " (em-dash) - take last segment
  const parts = slugline.split(/\s*[-–]\s*/);
  if (parts.length < 2) return '';
  // Last part is the TOD candidate
  let tod = parts[parts.length - 1].trim();
  // Strip scene numbers that Killa Bee appends: "NIGHT 14" -> "NIGHT"
  tod = tod.replace(/\s+\d+\s*$/, '').trim();
  // Strip asterisks (revision marks)
  tod = tod.replace(/\*+/g, '').trim();
  return tod;
}

/** Detect non-present timeline qualifiers. */
export function isNonPresent(slugline: string, tod: string): boolean {
  const combined = (slugline + ' ' + tod).toUpperCase();
  return /\b(MEMORY|MEMORIES|FLASHBACK|FLASH\s+BACK|DREAM|VISION|HALLUCINATION)\b/.test(combined)
      || /\[FLASHBACK\]|\[MEMORY\]|\[DREAM\]/.test(combined);
}

// ─── Transition detection ────────────────────────────────────────────────────

/**
 * Detects explicit new-day phrases IN THE TOD FIELD of the slugline.
 * e.g. "THE NEXT DAY", "NEXT MORNING", "3 DAYS LATER"
 */
export function todIsExplicitNewDay(tod: string): boolean {
  const t = tod.toUpperCase();
  return /\bNEXT\s+(DAY|MORNING|EVENING|NIGHT|AFTERNOON)\b/.test(t)
      || /\bFOLLOWING\s+(DAY|MORNING)\b/.test(t)
      || /\bTHE\s+NEXT\s+(DAY|MORNING)\b/.test(t)
      || /\b\d+\s+(DAYS?|WEEKS?|MONTHS?|YEARS?)\s+LATER\b/.test(t)
      || /\b(SEVERAL|FEW|MANY|SOME)\s+(DAYS?|WEEKS?|MONTHS?)\s+LATER\b/.test(t);
}

/**
 * Detects explicit new-day / time-jump phrases in ACTION LINES.
 *
 * This is the primary new-day signal in many scripts (Cowboys, Killa Bee).
 * Writers commonly open a scene action with "The next day," or "12 years later."
 */
export function actionLinesIndicateNewDay(lines: string[]): boolean {
  // Only check the first 2 action lines - transitions appear immediately
  const text = lines.slice(0, 2).join(' ');
  const t = text.toUpperCase();
  return /\bNEXT\s+(DAY|MORNING|NIGHT|EVENING|AFTERNOON)\b/.test(t)
      || /\bTHE\s+NEXT\s+(DAY|MORNING|NIGHT)\b/.test(t)
      || /\bFOLLOWING\s+(DAY|MORNING|NIGHT)\b/.test(t)
      || /\b\d+\s+(DAYS?|WEEKS?|MONTHS?|YEARS?)\s+LATER\b/.test(t)
      || /\b(SEVERAL|FEW|MANY|SOME)\s+(DAYS?|WEEKS?|MONTHS?)\s+LATER\b/.test(t)
      || /\bLATER\s+THAT\s+(DAY|NIGHT|EVENING|MORNING)\b/.test(t)
      || /\b\d{1,2}\s+(YEARS?|MONTHS?|WEEKS?|HOURS?)\s+LATER\b/.test(t)
      // Calendar date title cards: "FRIDAY, DECEMBER 3, 1926" / "12TH MARCH 2020"
      || /\b(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\b/.test(t)
      || /\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+\d/.test(t)
      || /\b\d{1,2}(ST|ND|RD|TH)\s+(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)/.test(t)
      // Named dates
      || /\bCHRISTMAS\s+(DAY|MORNING|NIGHT|EVE)\b/.test(t)
      || /\bNEW\s+YEAR(S?\s+DAY|S?\s+EVE)?\b/.test(t)
      || /\bVALENTINE.S\s+DAY\b/.test(t);
}

// ─── Core story day builder ───────────────────────────────────────────────────

export interface StoryDayResult {
  sceneNumber: string;
  storyDay: number;
  /** Present / Flashback / Memory etc. */
  timeline: 'present' | 'non-present';
  /** Human label, e.g. "Day 1", "Day 3 (Flashback)" */
  label: string;
}

/**
 * Build a story day map from a list of parsed scenes.
 *
 * Rules (in priority order):
 *  1. Non-present scenes (MEMORY/FLASHBACK) get their own parallel counter
 *     and are labelled separately. They do NOT affect the present-timeline counter.
 *  2. CONTINUOUS / MOMENTS LATER / A LITTLE LATER never trigger a new day
 *     and never update the previous TOD baseline.
 *  3. Explicit new-day phrase in TOD field increments present counter.
 *  4. Explicit new-day phrase in first 2 action lines increments present counter.
 *  5. NIGHT/MIDNIGHT/EVENING -> MORNING/DAWN/DAY/AFTERNOON regression
 *     increments present counter (overnight transition).
 *  6. DAY/MORNING/AFTERNOON -> earlier bucket without CONTINUOUS also
 *     increments (e.g. DAY -> MORNING implies a new morning).
 */
export function buildStoryDayMap(scenes: ParsedScene[]): StoryDayResult[] {
  const results: StoryDayResult[] = [];

  let presentDay = 1;
  let nonPresentDay = 1;

  // Baseline tracking - only updated when TOD is a "real" time (not CONTINUOUS/LATER/UNKNOWN)
  let prevPresentOrder = -1;
  let prevNonPresentOrder = -1;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const { tod, isNonPresent: nonPresent, rawTOD } = scene;
    const timeOrder = TIME_ORDER[tod];
    const isContinuous = tod === 'CONTINUOUS' || tod === 'LATER';

    if (nonPresent) {
      // Non-present timeline (memory/flashback)
      let newDay = false;
      if (i > 0) {
        if (todIsExplicitNewDay(rawTOD)) {
          newDay = true;
        } else if (actionLinesIndicateNewDay(scene.actionLines)) {
          newDay = true;
        } else if (!isContinuous && timeOrder !== -1 && prevNonPresentOrder !== -1) {
          if (timeOrder < prevNonPresentOrder) newDay = true; // regression
          if (prevNonPresentOrder >= TIME_ORDER.NIGHT && timeOrder <= TIME_ORDER.DAY) newDay = true;
        }
      }
      if (newDay) nonPresentDay++;
      if (!isContinuous && timeOrder !== -1) prevNonPresentOrder = timeOrder;

      results.push({
        sceneNumber: scene.sceneNumber,
        storyDay: nonPresentDay,
        timeline: 'non-present',
        label: `Day ${nonPresentDay} (Flashback)`,
      });
    } else {
      // Present timeline
      let newDay = false;
      if (i > 0) {
        if (todIsExplicitNewDay(rawTOD)) {
          newDay = true;
        } else if (actionLinesIndicateNewDay(scene.actionLines)) {
          newDay = true;
        } else if (!isContinuous && timeOrder !== -1 && prevPresentOrder !== -1) {
          if (timeOrder < prevPresentOrder) newDay = true; // time went backwards
          if (prevPresentOrder >= TIME_ORDER.NIGHT && timeOrder <= TIME_ORDER.DAY) newDay = true;
        }
      }
      if (newDay) presentDay++;
      if (!isContinuous && timeOrder !== -1) prevPresentOrder = timeOrder;

      results.push({
        sceneNumber: scene.sceneNumber,
        storyDay: presentDay,
        timeline: 'present',
        label: `Day ${presentDay}`,
      });
    }
  }

  return results;
}

// ─── Slugline parser (use before buildStoryDayMap) ───────────────────────────

/**
 * Parse a raw slugline string and its following action lines into a ParsedScene.
 * Handles:
 *   - Standard:     "INT. COFFEE SHOP - DAY"
 *   - Numbered:     "14 INT. LOCATION - NIGHT 14"  (Killa Bee style)
 *   - Brackets:     "INT. LOCATION - DAY [FLASHBACK]"  (Killa Bee)
 *   - Parenthetical:"INT. LOCATION - NIGHT (MEMORY)"  (EMD style)
 *   - Em-dash:      "INT. LOCATION – MORNING"
 *   - No TOD:       "INT. BATHROOM"
 */
export function parseSlugline(
  rawSlugline: string,
  sceneIndex: number,
  actionLines: string[],
): ParsedScene {
  let slug = rawSlugline.trim();

  // Extract leading scene number if present: "14 INT. ..."
  let sceneNumber = String(sceneIndex + 1);
  const numMatch = slug.match(/^(\d+)\s+(INT|EXT|I\/E)/i);
  if (numMatch) {
    sceneNumber = numMatch[1];
    slug = slug.slice(numMatch[1].length).trim();
  }

  const rawTOD = extractTOD(slug);
  const tod = classifyTOD(rawTOD);
  const nonPresent = isNonPresent(slug, rawTOD);

  return {
    sceneNumber,
    slugline: rawSlugline.trim(),
    rawTOD,
    tod,
    isNonPresent: nonPresent,
    actionLines,
  };
}
