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
 * DETECTION PRIORITY ORDER:
 *
 *  1. Action line transitions ("The next day,", "12 years later") — most reliable
 *  2. Explicit TOD phrases in slugline ("NEXT MORNING", "THE NEXT DAY")
 *  3. NIGHT → DAY regression — reliable overnight indicator
 *  4. Calendar/named date title cards in action lines
 *  5. General TOD time regression — last resort, lower confidence
 *
 * ADDITIONAL RULES:
 *  - CONTINUOUS / MOMENTS LATER / A LITTLE LATER never trigger a new day
 *    and never update the prev_time_order baseline.
 *  - MEMORY / FLASHBACK / DREAM scenes tracked on parallel timeline.
 *  - Multi-segment sluglines handled gracefully (junk room names in TOD).
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

// ─── Written-out number words for time-jump detection ────────────────────────

/** Matches written-out number words (one through fifty) as an alternative to \d+ */
const WRITTEN_NUMBER_RE = '(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY|FIFTY|A\\s+FEW|A\\s+COUPLE(?:\\s+OF)?)';

/** Pre-compiled regex: written-out number + time unit + LATER */
const WRITTEN_TIME_JUMP_RE = new RegExp(`\\b${WRITTEN_NUMBER_RE}\\s+(DAYS?|WEEKS?|MONTHS?|YEARS?)\\s+LATER\\b`);

// ─── Transition detection (split by priority) ───────────────────────────────

/**
 * PRIORITY 1: Explicit time-jump phrases in ACTION LINES.
 * "The next day,", "12 years later", "6 months later", "One week later".
 * This is the most reliable new-day signal in many scripts.
 */
export function actionLinesIndicateTimeJump(lines: string[]): boolean {
  const text = lines.slice(0, 2).join(' ');
  const t = text.toUpperCase();
  return /\bNEXT\s+(DAY|MORNING|NIGHT|EVENING|AFTERNOON)\b/.test(t)
      || /\bTHE\s+NEXT\s+(DAY|MORNING|NIGHT)\b/.test(t)
      || /\bFOLLOWING\s+(DAY|MORNING|NIGHT)\b/.test(t)
      || /\b\d+\s+(DAYS?|WEEKS?|MONTHS?|YEARS?)\s+LATER\b/.test(t)
      || /\b(SEVERAL|FEW|MANY|SOME)\s+(DAYS?|WEEKS?|MONTHS?)\s+LATER\b/.test(t)
      || /\bLATER\s+THAT\s+(DAY|NIGHT|EVENING|MORNING)\b/.test(t)
      || /\b\d{1,2}\s+(YEARS?|MONTHS?|WEEKS?|HOURS?)\s+LATER\b/.test(t)
      || WRITTEN_TIME_JUMP_RE.test(t);
}

/**
 * PRIORITY 2: Explicit new-day phrases IN THE TOD FIELD of the slugline.
 * e.g. "THE NEXT DAY", "NEXT MORNING", "3 DAYS LATER"
 */
export function todIsExplicitNewDay(tod: string): boolean {
  const t = tod.toUpperCase();
  return /\bNEXT\s+(DAY|MORNING|EVENING|NIGHT|AFTERNOON)\b/.test(t)
      || /\bFOLLOWING\s+(DAY|MORNING)\b/.test(t)
      || /\bTHE\s+NEXT\s+(DAY|MORNING)\b/.test(t)
      || /\b\d+\s+(DAYS?|WEEKS?|MONTHS?|YEARS?)\s+LATER\b/.test(t)
      || /\b(SEVERAL|FEW|MANY|SOME)\s+(DAYS?|WEEKS?|MONTHS?)\s+LATER\b/.test(t)
      || WRITTEN_TIME_JUMP_RE.test(t);
}

/**
 * PRIORITY 4: Calendar date title cards and named dates in ACTION LINES.
 * "FRIDAY, DECEMBER 3, 1926", "12TH MARCH 2020", "Valentine's Day", "Christmas"
 */
export function actionLinesIndicateCalendarDate(lines: string[]): boolean {
  const text = lines.slice(0, 2).join(' ');
  const t = text.toUpperCase();
  return /\b(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\b/.test(t)
      || /\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+\d/.test(t)
      || /\b\d{1,2}(ST|ND|RD|TH)\s+(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)/.test(t)
      || /\bCHRISTMAS\s+(DAY|MORNING|NIGHT|EVE)\b/.test(t)
      || /\bNEW\s+YEAR(S?\s+DAY|S?\s+EVE)?\b/.test(t)
      || /\bVALENTINE.S\s+DAY\b/.test(t);
}

// ─── Core story day builder ───────────────────────────────────────────────────

/** How the story day was determined. */
export type StoryDayConfidence = 'explicit' | 'inferred' | 'inherited';

export interface StoryDayResult {
  sceneNumber: string;
  storyDay: number;
  /** Present / Flashback / Memory etc. */
  timeline: 'present' | 'non-present';
  /** Human label, e.g. "Day 1", "Day 3 (Flashback)" */
  label: string;
  /**
   * How this story day was determined:
   *  - 'explicit': action line transition, TOD phrase, or calendar date (high confidence)
   *  - 'inferred': NIGHT→DAY regression or general time regression (medium-low confidence)
   *  - 'inherited': no signal — carrying forward previous day (may need manual review)
   */
  confidence: StoryDayConfidence;
}

/**
 * Build a story day map from a list of parsed scenes.
 *
 * Detection priority order:
 *  1. Action line transitions ("The next day,") — most reliable
 *  2. Explicit TOD phrases in slugline ("NEXT MORNING")
 *  3. NIGHT → DAY regression — reliable overnight indicator
 *  4. Calendar/named date title cards in action lines
 *  5. General TOD time regression — last resort
 *
 * Additional rules:
 *  - Non-present scenes (MEMORY/FLASHBACK) get their own parallel counter.
 *  - CONTINUOUS / MOMENTS LATER / A LITTLE LATER never trigger a new day
 *    and never update the previous TOD baseline.
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

    // Determine: is this a new day? And how confident are we?
    let newDay = false;
    let confidence: StoryDayConfidence = 'inherited';
    const prevOrder = nonPresent ? prevNonPresentOrder : prevPresentOrder;

    if (i > 0) {
      // Priority 1: Action line time-jump phrases (highest confidence)
      if (actionLinesIndicateTimeJump(scene.actionLines)) {
        newDay = true;
        confidence = 'explicit';
      }
      // Priority 2: Explicit TOD phrases in slugline
      else if (todIsExplicitNewDay(rawTOD)) {
        newDay = true;
        confidence = 'explicit';
      }
      // Priority 3: NIGHT/MIDNIGHT/EVENING → MORNING/DAWN/PRE_DAWN/DAY regression (overnight)
      else if (!isContinuous && timeOrder !== -1 && prevOrder !== -1
            && prevOrder >= TIME_ORDER.NIGHT && timeOrder <= TIME_ORDER.DAY) {
        newDay = true;
        confidence = 'inferred';
      }
      // Priority 4: Calendar/named date title cards in action lines
      else if (actionLinesIndicateCalendarDate(scene.actionLines)) {
        newDay = true;
        confidence = 'explicit';
      }
      // Priority 5: General TOD regression (time went backwards without CONTINUOUS)
      else if (!isContinuous && timeOrder !== -1 && prevOrder !== -1
            && timeOrder < prevOrder) {
        newDay = true;
        confidence = 'inferred';
      }
    }

    if (nonPresent) {
      if (newDay) nonPresentDay++;
      if (!isContinuous && timeOrder !== -1) prevNonPresentOrder = timeOrder;

      results.push({
        sceneNumber: scene.sceneNumber,
        storyDay: nonPresentDay,
        timeline: 'non-present',
        label: `Day ${nonPresentDay} (Flashback)`,
        confidence,
      });
    } else {
      if (newDay) presentDay++;
      if (!isContinuous && timeOrder !== -1) prevPresentOrder = timeOrder;

      results.push({
        sceneNumber: scene.sceneNumber,
        storyDay: presentDay,
        timeline: 'present',
        label: `Day ${presentDay}`,
        confidence,
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
