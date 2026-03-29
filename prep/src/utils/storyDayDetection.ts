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

/** Detect non-present timeline qualifiers from scene heading / TOD field. */
export function isNonPresent(slugline: string, tod: string): boolean {
  const combined = (slugline + ' ' + tod).toUpperCase();
  return /\b(MEMORY|MEMORIES|FLASHBACK|FLASH\s+BACK|DREAM|VISION|HALLUCINATION)\b/.test(combined)
      || /\[FLASHBACK\]|\[MEMORY\]|\[DREAM\]/.test(combined);
}

/** Written-out number alternative for AGO/EARLIER patterns */
const WRITTEN_NUMBER_AGO_RE = '(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY|FIFTY)';

/**
 * Detect non-present timeline markers in the first 3 action lines.
 * Catches cases where the heading looks normal but the action line
 * immediately below declares a flashback or time-ago jump.
 *
 * Returns false when "END FLASHBACK" / "BACK TO PRESENT" is detected
 * (those signal a return to the present timeline, not non-present).
 */
export function actionLinesIndicateNonPresent(lines: string[]): boolean {
  const text = lines.slice(0, 3).join(' ').toUpperCase();
  // "End flashback" / "back to present" means RETURNING to present — not non-present
  if (actionLinesIndicateEndFlashback(lines)) return false;
  // Flashback markers
  if (/\b(BEGIN\s+FLASHBACK|FLASHBACK|FLASH\s+BACK)\b/.test(text)) return true;
  // Memory / dream markers
  if (/\b(MEMORY|MEMORIES|DREAM|VISION|HALLUCINATION)\b/.test(text)) return true;
  // Bracket notation: [FLASHBACK], [MEMORY], [DREAM]
  if (/\[(FLASHBACK|MEMORY|DREAM)\]/.test(text)) return true;
  // Numeric time-ago: "2 WEEKS AGO", "10 YEARS EARLIER"
  if (/\b\d+\s+(DAYS?|WEEKS?|MONTHS?|YEARS?)\s+(AGO|EARLIER)\b/.test(text)) return true;
  // Written-out time-ago: "THREE MONTHS AGO", "TWENTY YEARS EARLIER"
  const writtenAgoRe = new RegExp(`\\b${WRITTEN_NUMBER_AGO_RE}\\s+(DAYS?|WEEKS?|MONTHS?|YEARS?)\\s+(AGO|EARLIER)\\b`);
  if (writtenAgoRe.test(text)) return true;
  // Vague time-ago: "SEVERAL YEARS AGO", "A FEW DAYS EARLIER"
  if (/\b(A\s+FEW|SEVERAL|SOME|MANY)\s+(DAYS?|WEEKS?|MONTHS?|YEARS?)\s+(AGO|EARLIER)\b/.test(text)) return true;
  return false;
}

/**
 * Detect "end of flashback" markers in the first 3 action lines.
 * When detected, the present day counter should resume from before the flashback.
 */
export function actionLinesIndicateEndFlashback(lines: string[]): boolean {
  const text = lines.slice(0, 3).join(' ').toUpperCase();
  return /\b(END\s+FLASHBACK|BACK\s+TO\s+PRESENT|RETURN\s+TO\s+PRESENT)\b/.test(text);
}

// ─── Written-out number words for time-jump detection ────────────────────────

/** Matches written-out number words (one through fifty) as an alternative to \d+ */
const WRITTEN_NUMBER_RE = '(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FORTY|FIFTY|A\\s+FEW|A\\s+COUPLE(?:\\s+OF)?)';

/** Pre-compiled regex: written-out number + time unit + LATER */
const WRITTEN_TIME_JUMP_RE = new RegExp(`\\b${WRITTEN_NUMBER_RE}\\s+(DAYS?|WEEKS?|MONTHS?|YEARS?)\\s+LATER\\b`);

/** Map written-out cardinal words to numeric values for multi-day jump parsing */
const WRITTEN_TO_NUMBER: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7, EIGHT: 8,
  NINE: 9, TEN: 10, ELEVEN: 11, TWELVE: 12, THIRTEEN: 13, FOURTEEN: 14,
  FIFTEEN: 15, SIXTEEN: 16, SEVENTEEN: 17, EIGHTEEN: 18, NINETEEN: 19,
  TWENTY: 20, THIRTY: 30, FORTY: 40, FIFTY: 50,
};

/**
 * Same-day phrases that must never trigger a day increment.
 * Checked before any jump detection to prevent false positives.
 */
function isSameDayPhrase(t: string): boolean {
  return /\bLATER\s+THAT\s+(DAY|NIGHT|EVENING|MORNING|AFTERNOON)\b/.test(t)
      || /\bMOMENTS?\s+LATER\b/.test(t)
      || /\bSECONDS?\s+LATER\b/.test(t)
      || /\bMEANWHILE\b/.test(t)
      || /\bIMMEDIATELY\b/.test(t)
      || /\bCONTINUOUS\b/.test(t);
}

// ─── Transition detection (split by priority) ───────────────────────────────

/**
 * PRIORITY 1: Explicit time-jump phrases in ACTION LINES.
 * "The next day,", "12 years later", "6 months later", "One week later".
 * This is the most reliable new-day signal in many scripts.
 */
export function actionLinesIndicateTimeJump(lines: string[]): boolean {
  const text = lines.slice(0, 2).join(' ');
  const t = text.toUpperCase();
  // Same-day phrases must be excluded first
  if (isSameDayPhrase(t)) return false;
  return /\b(?:THE\s+)?(?:NEXT|FOLLOWING)\s+(DAY|MORNING|NIGHT|EVENING|AFTERNOON)\b/.test(t)
      || /\b\d+\s+(DAYS?|WEEKS?|MONTHS?|YEARS?)\s+LATER\b/.test(t)
      || /\bA\s+(WEEK|MONTH)\s+LATER\b/.test(t)
      || /\b(SEVERAL|FEW|MANY|SOME)\s+(DAYS?|WEEKS?|MONTHS?)\s+LATER\b/.test(t)
      || WRITTEN_TIME_JUMP_RE.test(t);
}

/**
 * PRIORITY 2: Explicit new-day phrases IN THE TOD FIELD of the slugline.
 * e.g. "THE NEXT DAY", "NEXT MORNING", "3 DAYS LATER"
 */
export function todIsExplicitNewDay(tod: string): boolean {
  const t = tod.toUpperCase();
  // Same-day phrases must be excluded first
  if (isSameDayPhrase(t)) return false;
  return /\b(?:THE\s+)?(?:NEXT|FOLLOWING)\s+(DAY|MORNING|NIGHT|EVENING|AFTERNOON)\b/.test(t)
      || /\b\d+\s+(DAYS?|WEEKS?|MONTHS?|YEARS?)\s+LATER\b/.test(t)
      || /\bA\s+(WEEK|MONTH)\s+LATER\b/.test(t)
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

// ─── Multi-day jump parsing ─────────────────────────────────────────────────

/** Parse a written-out number word to its numeric value. Returns 0 if unrecognised. */
function writtenToNumber(word: string): number {
  return WRITTEN_TO_NUMBER[word.toUpperCase()] ?? 0;
}

/**
 * Parse the number of story days to advance from action line text.
 * Returns 0 if no jump detected, 1+ for the day increment.
 * "a month later" returns 1 with a console warning (large jump, no exact days).
 */
export function parseActionLineJumpDays(lines: string[]): number {
  const text = lines.slice(0, 2).join(' ');
  const t = text.toUpperCase();
  if (isSameDayPhrase(t)) return 0;
  if (!actionLinesIndicateTimeJump(lines)) return 0;
  return parseJumpDaysFromText(t);
}

/**
 * Parse the number of story days to advance from a TOD field.
 * Returns 0 if no jump detected, 1+ for the day increment.
 */
export function parseTodJumpDays(tod: string): number {
  const t = tod.toUpperCase();
  if (isSameDayPhrase(t)) return 0;
  if (!todIsExplicitNewDay(tod)) return 0;
  return parseJumpDaysFromText(t);
}

/** Shared logic: extract the numeric day increment from uppercased text. */
function parseJumpDaysFromText(t: string): number {
  // "next day/morning/evening" or "following day/morning/evening" → +1
  if (/\b(?:THE\s+)?(?:NEXT|FOLLOWING)\s+(DAY|MORNING|NIGHT|EVENING|AFTERNOON)\b/.test(t)) return 1;

  // "a few days later" → +3
  if (/\bA\s+FEW\s+DAYS?\s+LATER\b/.test(t)) return 3;
  // "a couple of days later" / "a couple days later" → +2
  if (/\bA\s+COUPLE\s+(?:OF\s+)?DAYS?\s+LATER\b/.test(t)) return 2;
  // "several days later" → +5
  if (/\bSEVERAL\s+DAYS?\s+LATER\b/.test(t)) return 5;

  // "a week later" → +7
  if (/\bA\s+WEEK\s+LATER\b/.test(t)) return 7;

  // "a month later" → flag as large jump, increment by 1
  if (/\bA\s+MONTH\s+LATER\b/.test(t)) {
    console.warn('[storyDayDetection] "a month later" detected — large jump, exact days not calculated');
    return 1;
  }

  // Numeric: "3 days later", "2 weeks later", "6 months later", "12 years later"
  let m = t.match(/\b(\d+)\s+DAYS?\s+LATER\b/);
  if (m) return parseInt(m[1], 10);

  m = t.match(/\b(\d+)\s+WEEKS?\s+LATER\b/);
  if (m) return parseInt(m[1], 10) * 7;

  m = t.match(/\b(\d+)\s+MONTHS?\s+LATER\b/);
  if (m) {
    console.warn(`[storyDayDetection] "${m[0]}" detected — large jump, exact days not calculated`);
    return 1;
  }

  m = t.match(/\b(\d+)\s+YEARS?\s+LATER\b/);
  if (m) {
    console.warn(`[storyDayDetection] "${m[0]}" detected — large jump, exact days not calculated`);
    return 1;
  }

  // Written-out number + days: "THREE DAYS LATER"
  const writtenDaysRe = new RegExp(`\\b(${Object.keys(WRITTEN_TO_NUMBER).join('|')})\\s+DAYS?\\s+LATER\\b`);
  m = t.match(writtenDaysRe);
  if (m) return writtenToNumber(m[1]) || 1;

  // Written-out number + weeks: "TWO WEEKS LATER"
  const writtenWeeksRe = new RegExp(`\\b(${Object.keys(WRITTEN_TO_NUMBER).join('|')})\\s+WEEKS?\\s+LATER\\b`);
  m = t.match(writtenWeeksRe);
  if (m) return (writtenToNumber(m[1]) || 1) * 7;

  // Written-out number + months/years: flag as large jump
  const writtenLargeRe = new RegExp(`\\b(${Object.keys(WRITTEN_TO_NUMBER).join('|')})\\s+(MONTHS?|YEARS?)\\s+LATER\\b`);
  m = t.match(writtenLargeRe);
  if (m) {
    console.warn(`[storyDayDetection] "${m[0]}" detected — large jump, exact days not calculated`);
    return 1;
  }

  // Vague quantities + time units: "some weeks later", "many months later"
  if (/\b(SEVERAL|FEW|MANY|SOME)\s+(DAYS?)\s+LATER\b/.test(t)) return 3;
  if (/\b(SEVERAL|FEW|MANY|SOME)\s+(WEEKS?|MONTHS?)\s+LATER\b/.test(t)) {
    console.warn('[storyDayDetection] Vague large time jump detected — exact days not calculated');
    return 1;
  }

  // Fallback: something matched the boolean check but we couldn't parse a number
  return 1;
}

// ─── Location extraction (for concurrent-thread detection) ──────────────────

/**
 * Extract the normalised location string from a slugline.
 * Strips scene numbers, INT/EXT prefixes, and time-of-day suffixes so that
 * "14 INT. COFFEE SHOP - NIGHT 14" and "INT. COFFEE SHOP - DAY" both yield
 * "COFFEE SHOP".
 */
export function extractLocation(slugline: string): string {
  let s = slugline.trim().toUpperCase();
  // Strip leading scene number: "14 INT..." → "INT..."
  s = s.replace(/^\d+[A-Z]{0,4}\s+/, '');
  // Strip trailing scene number (Killa Bee style): "... NIGHT 14" → "... NIGHT"
  s = s.replace(/\s+\d+[A-Z]{0,4}\s*$/, '');
  // Strip INT/EXT prefix
  s = s.replace(/^(INT\.?\s*\/\s*EXT\.?|EXT\.?\s*\/\s*INT\.?|I\s*\/\s*E\.?|INT\.?|EXT\.?)\s*\.?\s*/, '');
  // Strip leading dash/dot after prefix
  s = s.replace(/^[\.\-–—]\s*/, '');
  // Split on dash — last segment is TOD, everything before is location
  const parts = s.split(/\s*[-–—]\s*/);
  if (parts.length > 1) parts.pop();
  return parts.join(' - ').trim();
}

// ─── Dialogue time-cue detection ��───────────────────────────────────────────

/** Cardinal number word pattern for dialogue matching */
const DIALOGUE_NUMBER_RE = '(?:\\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY(?:[- ](?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|THIRTY(?:[- ](?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|FORTY(?:[- ](?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE))?|FIFTY)';

/** Day-of-week pattern */
const DAY_OF_WEEK_RE = '(?:MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)';

/**
 * Detect timeline-position cues in dialogue lines.
 *
 * These phrases indicate a countable position within an active story timeline
 * and are evidence that a time jump may have occurred before this scene that
 * the parser did not detect. They must be flagged for human review.
 *
 * Only matches forward-looking / countdown phrases. Backward-looking phrases
 * ("it's been X days", "X days ago", "back when") are explicitly excluded
 * because they describe elapsed time, not the current position in the story.
 *
 * Returns the first matched phrase, or empty string if none found.
 */
export function detectDialogueTimeCues(dialogueLines: string[]): string {
  const text = dialogueLines.join(' ');
  const t = text.toUpperCase();

  // ── Exclusion: backward-looking / elapsed-time phrases ──
  // If the text contains these contextual words, the entire text is
  // treated as backward-looking and excluded.
  // Blanket exclusions — always backward-looking regardless of position:
  if (/\bAGO\b/.test(t)) return '';
  if (/\bSINCE\b/.test(t)) return '';
  if (/\bBACK\s+WHEN\b/.test(t)) return '';
  if (/\bI\s+REMEMBER\s+WHEN\b/.test(t)) return '';
  if (/\bIT'?S\s+BEEN\b/.test(t)) return '';
  if (/\bBEEN\s+HERE\b/.test(t)) return '';
  if (/\bWE'?VE\s+BEEN\b/.test(t)) return '';
  // Positional exclusions — only exclude when they PRECEDE a time quantity
  // (i.e. the time reference follows the exclusion word).
  // "until five days" = excluded, but "five days until the trial" = allowed.
  const timeQtyRe = `(?:${DIALOGUE_NUMBER_RE})\\s+(?:DAYS?|WEEKS?|MONTHS?|YEARS?)`;
  if (new RegExp(`\\b(?:BEFORE|AFTER|UNTIL|BACK)\\s+${timeQtyRe}\\b`).test(t)) return '';

  // ── COUNTDOWN TO A FIXED STORY ENDPOINT ──
  let m: RegExpMatchArray | null;

  // "X days left", "only X days left"
  const daysLeftRe = new RegExp(`\\b(?:ONLY\\s+)?(${DIALOGUE_NUMBER_RE})\\s+DAYS?\\s+LEFT\\b`);
  m = t.match(daysLeftRe);
  if (m) return m[0].trim();

  // "X more days"
  const moreDaysRe = new RegExp(`\\b(?:ONLY\\s+)?(${DIALOGUE_NUMBER_RE})\\s+MORE\\s+DAYS?\\b`);
  m = t.match(moreDaysRe);
  if (m) return m[0].trim();

  // "X days remaining"
  const daysRemainingRe = new RegExp(`\\b(${DIALOGUE_NUMBER_RE})\\s+DAYS?\\s+REMAINING\\b`);
  m = t.match(daysRemainingRe);
  if (m) return m[0].trim();

  // ── FORWARD REFERENCES TO A SPECIFIC UPCOMING MOMENT ──

  // "see you tomorrow"
  m = t.match(/\bSEE\s+YOU\s+TOMORROW\b/);
  if (m) return m[0].trim();

  // "tomorrow morning"
  m = t.match(/\bTOMORROW\s+MORNING\b/);
  if (m) return m[0].trim();

  // "see you on [day of week]"
  const seeYouOnRe = new RegExp(`\\bSEE\\s+YOU\\s+ON\\s+${DAY_OF_WEEK_RE}\\b`);
  m = t.match(seeYouOnRe);
  if (m) return m[0].trim();

  // "the [any word] is tomorrow"
  m = t.match(/\bTHE\s+\w+\s+IS\s+TOMORROW\b/);
  if (m) return m[0].trim();

  // "the [any word] is on [day of week]"
  const theXIsOnRe = new RegExp(`\\bTHE\\s+\\w+\\s+IS\\s+ON\\s+${DAY_OF_WEEK_RE}\\b`);
  m = t.match(theXIsOnRe);
  if (m) return m[0].trim();

  return '';
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
  /**
   * Dialogue time cue detected in this scene's lines, e.g. "5 DAYS LEFT".
   * Non-empty when a countdown or forward-reference phrase is found.
   * Empty string when no cue is detected.
   */
  dialogueTimeCue: string;
  /**
   * True when a dialogue time cue suggests a time jump may have occurred
   * before this scene that the parser did not catch. A human reviewer
   * should check the scene boundary immediately preceding this scene.
   */
  needsReview: boolean;
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

  // Flashback resume: save present-timeline state when entering a flashback
  // sequence so it can be restored when "END FLASHBACK" / "BACK TO PRESENT"
  // is encountered.
  let savedPresentDay = -1;
  let savedPrevPresentOrder = -1;
  let inFlashbackSequence = false;

  // Concurrent-thread tracking: locations seen per story day, keyed by
  // "location\0tod" so we can detect cuts back to an earlier location.
  let prevLocation = '';
  const presentDayLocTod = new Set<string>();
  const nonPresentDayLocTod = new Set<string>();

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const { tod, isNonPresent: nonPresent, rawTOD } = scene;
    const timeOrder = TIME_ORDER[tod];
    const isContinuous = tod === 'CONTINUOUS' || tod === 'LATER';
    const location = extractLocation(scene.slugline);

    // Flashback entry: first non-present scene after present scenes
    if (nonPresent && !inFlashbackSequence) {
      savedPresentDay = presentDay;
      savedPrevPresentOrder = prevPresentOrder;
      inFlashbackSequence = true;
    }

    // Flashback exit: returning to present timeline after a flashback sequence
    if (!nonPresent && inFlashbackSequence) {
      presentDay = savedPresentDay;
      prevPresentOrder = savedPrevPresentOrder;
      inFlashbackSequence = false;
    }

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
      // ── Concurrent-thread detection (before Priority 3 & 5 regressions) ──
      // When the script cross-cuts between simultaneous storylines in
      // different locations, the TOD may appear to regress even though
      // the story day has not changed. Detect this and suppress the
      // regression. Guiding principle: when in doubt, do NOT increment.
      //
      // A scene is concurrent when:
      //  (a) P1 and P2 did not fire, AND
      //  (b) TOD is identical to the preceding scene AND location differs, OR
      //  (c) This location+TOD combination already appeared earlier in the
      //      current story day.
      else {
        const dayLocTod = nonPresent ? nonPresentDayLocTod : presentDayLocTod;
        const locTodKey = location + '\0' + tod;
        const sameTodAsPrev = timeOrder !== -1 && timeOrder === prevOrder;
        const differentLocation = location !== prevLocation;
        const locationSeenThisDay = dayLocTod.has(locTodKey);
        const concurrent = (sameTodAsPrev && differentLocation) || locationSeenThisDay;

        if (!concurrent) {
          // Priority 3: NIGHT/MIDNIGHT/EVENING → MORNING/DAWN/PRE_DAWN/DAY regression (overnight)
          if (!isContinuous && timeOrder !== -1 && prevOrder !== -1
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
        } else {
          // Concurrent — still check Priority 4 (calendar dates are explicit, not regression)
          if (actionLinesIndicateCalendarDate(scene.actionLines)) {
            newDay = true;
            confidence = 'explicit';
          }
        }
      }
    }

    // Compute multi-day increment when a jump is detected
    let increment = 0;
    if (newDay) {
      // Try action lines first (Priority 1), then TOD field (Priority 2)
      increment = parseActionLineJumpDays(scene.actionLines);
      if (increment === 0) increment = parseTodJumpDays(rawTOD);
      // Priorities 3-5 (regressions, calendar dates) are always +1
      if (increment === 0) increment = 1;
    }

    // Dialogue time-cue detection
    const dialogueTimeCue = detectDialogueTimeCues(scene.actionLines);
    const needsReview = dialogueTimeCue !== '';

    if (nonPresent) {
      if (increment > 0) { nonPresentDayLocTod.clear(); }
      nonPresentDay += increment;
      if (!isContinuous && timeOrder !== -1) prevNonPresentOrder = timeOrder;
      nonPresentDayLocTod.add(location + '\0' + tod);

      results.push({
        sceneNumber: scene.sceneNumber,
        storyDay: nonPresentDay,
        timeline: 'non-present',
        label: `Day ${nonPresentDay} (Flashback)`,
        confidence,
        dialogueTimeCue,
        needsReview,
      });
    } else {
      if (increment > 0) { presentDayLocTod.clear(); }
      presentDay += increment;
      if (!isContinuous && timeOrder !== -1) prevPresentOrder = timeOrder;
      presentDayLocTod.add(location + '\0' + tod);

      results.push({
        sceneNumber: scene.sceneNumber,
        storyDay: presentDay,
        timeline: 'present',
        label: `Day ${presentDay}`,
        confidence,
        dialogueTimeCue,
        needsReview,
      });
    }

    prevLocation = location;
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
  // "End flashback" markers override heading-level flashback flags
  const nonPresent = actionLinesIndicateEndFlashback(actionLines)
    ? false
    : (isNonPresent(slug, rawTOD) || actionLinesIndicateNonPresent(actionLines));

  return {
    sceneNumber,
    slugline: rawSlugline.trim(),
    rawTOD,
    tod,
    isNonPresent: nonPresent,
    actionLines,
  };
}
