// SYNC REQUIRED: This file is an exact duplicate of
// mobile-pwa/src/utils/storyDayDetection.ts
// Any changes must be applied to both files.
// See prep-happy issue backlog for shared package extraction task.

// storyDayDetection.ts — v3
// Story day detection engine. Universal heuristic-based detection
// verified against professional script supervisor breakdowns.

// ─── TYPES ─────────────────────────────────────────────────────────────────

export type TOD =
  | 'DAY' | 'MORNING' | 'DAWN'
  | 'AFTERNOON'
  | 'DUSK' | 'EVENING'
  | 'NIGHT' | 'MIDNIGHT'
  | 'CONTINUOUS' | 'LATER' | 'MOMENTS_LATER'
  | 'UNKNOWN';

export type Timeline = 'present' | 'non-present' | 'concurrent';

// Keep existing confidence labels for compatibility with lookGenerator.ts:
//   'explicit'   = very-high / high  (parser found a reliable signal)
//   'inferred'   = medium            (concurrent thread, implied break)
//   'inherited'  = low / assumed     (no signal, defaulted)
export type StoryDayConfidence = 'explicit' | 'inferred' | 'inherited';

export interface ParsedScene {
  sceneNumber: string;
  slugline: string;
  rawTOD: string;
  tod: TOD;
  intExt: 'INT' | 'EXT' | 'INT/EXT' | 'UNKNOWN';
  location: string;
  actionLines: string[];          // First 0–3 lines, dialogue-stripped
  titleCardBefore: string | null; // ALL-CAPS title card preceding this slug
  isEpisodeMarker?: boolean;
}

// TODO: dialogueTimeCue — not yet implemented.
// Requires dialogue lines to be passed through
// ParsedScene alongside actionLines. When implemented,
// scan dialogue for countdown phrases ("X days left",
// "X more days") and forward references ("see you
// tomorrow") and populate a dialogueTimeCue field
// on StoryDayResult. Must not change storyDay value —
// flagging only. See Prompt 6 spec for full details.

export interface StoryDayResult {
  sceneNumber: string;
  storyDay: number;               // Sequential integer: 1, 2, 3…
  timeline: Timeline;
  label: string;                  // "Day 1", "Day 3 (Flashback)" etc.
  confidence: StoryDayConfidence;
  signal: string;                 // Human-readable reason (debug / review UI)
  gapNote: string | null;         // "One week later", "6 months later" etc.
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const NIGHT_SET = new Set<TOD>(['NIGHT', 'MIDNIGHT', 'EVENING', 'DUSK']);
const DAY_SET   = new Set<TOD>(['DAY', 'MORNING', 'DAWN', 'AFTERNOON']);
const SKIP_SET  = new Set<TOD>(['CONTINUOUS', 'LATER', 'MOMENTS_LATER', 'UNKNOWN']);

// ─── TOD CLASSIFIER ─────────────────────────────────────────────────────────

/** Determine D/N prefix from a TOD value */
function todPrefix(tod: TOD): 'D' | 'N' {
  return NIGHT_SET.has(tod) ? 'N' : 'D';
}

// ─── TOD PRE-PROCESSING ─────────────────────────────────────────────────────

export interface TODPreprocessResult {
  isNonPresent: boolean;
  isContinuous: boolean;
  cleaned: string;
}

/**
 * Pre-process a raw TOD string before classification.
 * Step A: detect non-present qualifiers (flashback, ago, etc.)
 * Step B: detect continuous/same-moment qualifiers
 * Step C: strip season/intensity prefixes
 */
export function preprocessRawTOD(raw: string): TODPreprocessResult {
  // Strip trailing scene number (e.g. "NIGHT 23" → "NIGHT")
  const stripped = (raw ?? '').replace(/\s+\d+[A-Za-z]?\s*$/, '');
  let t = stripped.toUpperCase().trim();
  if (!t) return { isNonPresent: false, isContinuous: false, cleaned: '' };

  // STEP A — Non-present qualifiers: return early, do not update baseline
  if (/\bAGO\b/.test(t) || /\bEARLIER\b/.test(t) || /\bPRIOR\b/.test(t) ||
      /\bFLASHBACK\b/.test(t) || /\bFLASH\s*FORWARD\b/.test(t)) {
    // For slash format ("NIGHT / FLASHBACK"), extract the part before the slash
    const slashMatch = t.match(/^(.+?)\s*\/\s*/);
    const underlying = slashMatch ? slashMatch[1].trim() : t;
    return { isNonPresent: true, isContinuous: false, cleaned: underlying };
  }

  // STEP B — Continuous/same-moment qualifiers: no day change, no baseline update
  // Note: CONTINUOUS and CONT. are already handled by classifyTOD's own checks,
  // but we catch them here too for consistency with the other same-moment patterns.
  if (/^SAME$/.test(t) || /SECONDS\s+LATER/.test(t) || /MOMENTS?\s+LATER/.test(t) ||
      /A\s+BEAT\s+LATER/.test(t) || /^(CONTINUOUS|CONT\.)/.test(t)) {
    return { isNonPresent: false, isContinuous: true, cleaned: t };
  }

  // STEP C — Season/intensity prefix stripping
  t = t.replace(/^(SUMMER|WINTER|SPRING|AUTUMN)\s+/, '');
  t = t.replace(/^EARLY\s+/, '');
  // Strip "LATE " only before a TOD word — not from "LATER"
  t = t.replace(/^LATE\s+(?=DAY\b|NIGHT\b|MORNING\b|AFTERNOON\b|EVENING\b|DAWN\b|DUSK\b|MIDNIGHT\b)/, '');

  return { isNonPresent: false, isContinuous: false, cleaned: t };
}

export function classifyTOD(raw: string): TOD {
  const pre = preprocessRawTOD(raw);
  if (pre.isNonPresent) return 'UNKNOWN';
  if (pre.isContinuous) return 'CONTINUOUS';
  const t = pre.cleaned;
  if (!t) return 'UNKNOWN';
  if (/^(CONTINUOUS|CONT\.)/.test(t))                    return 'CONTINUOUS';
  if (/^(MOMENTS?\s+LATER|A\s+LITTLE\s+LATER)/.test(t)) return 'MOMENTS_LATER';
  if (/^LATER/.test(t))                                  return 'LATER';
  if (/\bDAWN\b|\bSUNRISE\b/.test(t))                   return 'DAWN';
  if (/\bMORNING\b|\bEARLY\b/.test(t))                  return 'MORNING';
  if (/\bAFTERNOON\b/.test(t))                          return 'AFTERNOON';
  if (/\bDUSK\b|\bSUNSET\b/.test(t))                    return 'DUSK';
  if (/\bEVENING\b/.test(t))                             return 'EVENING';
  if (/\bMIDNIGHT\b/.test(t))                            return 'MIDNIGHT';
  if (/\bNIGHT\b/.test(t))                               return 'NIGHT';
  if (/\bDAY\b/.test(t))                                 return 'DAY';
  return 'UNKNOWN';
}

// ─── TIER 1: ACTION LINE PATTERNS ───────────────────────────────────────────

interface Tier1Match {
  type: 'new-day' | 'same-day' | 'flashback' | 'large-jump' | 'inferred-new-day' | 'concurrent';
  signal: string;
  gapNote?: string;
}

export function matchTier1(actionLines: string[]): Tier1Match | null {
  const text = actionLines.join(' ').slice(0, 400).toLowerCase();
  if (!text) return null;

  // Flashbacks first — highest priority
  if (/\bflashback\b/.test(text) || /\bflash\s+back\b/.test(text)) {
    return { type: 'flashback', signal: 'FLASHBACK in action line' };
  }

  // Large time jumps
  const largeJump = text.match(
    /\b(\d+|six|three|two|one|five|ten|twenty)\s+(months?|years?)\s+later\b/i
  );
  if (largeJump) {
    return { type: 'large-jump', signal: `Large jump: "${largeJump[0]}"`, gapNote: largeJump[0] };
  }

  // New-day patterns
  const newDay: Array<[RegExp, string]> = [
    [/\bthe\s+next\s+day\b/i,                                     '"The next day"'],
    [/\bthe?\s+following\s+(morning|day|afternoon)\b/i,           '"The following day/morning"'],
    [/\bnext\s+morning\b/i,                                        '"Next morning"'],
    [/\bdawn\s+breaks\b/i,                                         '"Dawn breaks"'],
    [/\b(\d+|one|two|three|four|five|six|seven)\s+days?\s+later\b/i,  'N days later'],
    [/\b(\d+|one|two|three|four)\s+weeks?\s+later\b/i,            'N weeks later'],
  ];
  for (const [pattern, signal] of newDay) {
    const m = text.match(pattern);
    if (m) return { type: 'new-day', signal, gapNote: m[0] };
  }

  // Inferred new-day patterns (lower confidence — shown with review flag)
  if (/\b(wakes?\s+up|waking\s+up|woke\s+up)\b/i.test(text)) {
    return { type: 'inferred-new-day', signal: '"Wakes up" — morning scene' };
  }

  // Same-day patterns
  const sameDay: Array<[RegExp, string]> = [
    [/\bthat\s+(same\s+)?(morning|afternoon|evening|night)\b/i,    '"That [same] [time]"'],
    [/\blater\s+that\s+(day|morning|afternoon|evening|night)\b/i,  '"Later that [time]"'],
    [/\bmoments?\s+later\b/i,                                       '"Moments later"'],
    [/\bshortly\s+after(wards?)?\b/i,                              '"Shortly afterwards"'],
    [/\ba\s+(little|while)\s+later\b/i,                            '"A little later"'],
  ];
  for (const [pattern, signal] of sameDay) {
    if (pattern.test(text)) return { type: 'same-day', signal };
  }

  return null;
}

// ─── TIER 1A: HEADING / SLUGLINE TIME JUMP ──────────────────────────────────

/**
 * Detect time jumps embedded in the scene heading text itself.
 * e.g. "INT. OFFICE - 6 MONTHS LATER" or heading containing "ONE YEAR LATER"
 * Flashback keywords in headings are handled separately by Tier 2A.
 */
export function matchHeadingTimeJump(slugline: string): Tier1Match | null {
  const t = slugline.toUpperCase();
  // Check for flashback first — if present, this is not a time jump
  if (/\b(FLASHBACK|FLASH\s*BACK|FLASH\s+FORWARD|DREAM|MEMORY|NIGHTMARE)\b/.test(t)) {
    return null; // Let Tier 2A handle this
  }
  const timeJump = t.match(
    /\b(\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|TWENTY|THIRTY|SEVERAL|FEW|MANY|SOME)\s+(DAYS?|WEEKS?|MONTHS?|YEARS?)\s+(LATER|AGO|EARLIER)\b/
  );
  if (timeJump) {
    return {
      type: 'large-jump',
      signal: `Heading time jump: "${timeJump[0]}"`,
      gapNote: timeJump[0].toLowerCase(),
    };
  }
  return null;
}

// ─── TIER 1B: TITLE CARD ────────────────────────────────────────────────────

/** Structural heading patterns — not valid title cards */
const STRUCTURAL_HEADING_RE = /^(EPISODE\s+\d+|ACT\s+(ONE|TWO|THREE|FOUR|FIVE|\d+)|PART\s+(ONE|TWO|THREE|FOUR|\d+)|CHAPTER\s+\d+|SCENE\s+\d+)\b/i;

export function matchTitleCard(raw: string | null): Tier1Match | null {
  if (!raw) return null;
  const t = raw.trim().toUpperCase();

  // Skip structural headings — these are not title cards
  if (STRUCTURAL_HEADING_RE.test(t)) return null;

  // Return to present markers — check first so "END FLASHBACK" isn't
  // caught by the general \bFLASHBACK\b pattern below
  if (/\b(BACK\s+TO\s+PRESENT|RETURN\s+TO\s+PRESENT|END\s+FLASHBACK)\b/.test(t)) {
    return { type: 'same-day', signal: `Return to present: "${raw.trim()}"` };
  }

  // Flashback colon format: "FLASHBACK: 1985", "FLASH FORWARD: 2050"
  if (/^FLASHBACK:\s*.+/.test(t) || /^FLASH\s*BACK:\s*.+/.test(t) ||
      /^FLASH\s*FORWARD:\s*.+/.test(t)) {
    return { type: 'flashback', signal: `Flashback title card: "${raw.trim()}"`, gapNote: raw.trim() };
  }

  // Non-present markers: FLASHBACK, FLASH BACK, FLASH FORWARD, DREAM, MEMORY
  // Must check BEFORE time jumps — "FLASHBACK: 2 WEEKS AGO" is a flashback,
  // not a present-timeline time jump
  if (/\b(FLASHBACK|FLASH\s*BACK|FLASH\s+FORWARD|DREAM|MEMORY|NIGHTMARE)\b/.test(t)) {
    return { type: 'flashback', signal: `Flashback title card: "${raw.trim()}"` };
  }

  // INTERCUT: mark following scene as concurrent (same story day)
  if (/^INTERCUT\b/.test(t)) {
    return { type: 'concurrent', signal: `Intercut title card: "${raw.trim()}"` };
  }

  // Time jumps: "6 MONTHS LATER", "TWO WEEKS AGO", "3 DAYS LATER", etc.
  // Only fires if NOT a flashback (checked above)
  const timeJump = t.match(
    /\b(\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|TWENTY|THIRTY|SEVERAL|FEW|MANY|SOME)\s+(DAYS?|WEEKS?|MONTHS?|YEARS?)\s+(LATER|AGO|EARLIER)\b/
  );
  if (timeJump) {
    return {
      type: 'large-jump',
      signal: `Title card: "${timeJump[0]}"`,
      gapNote: timeJump[0].toLowerCase(),
    };
  }

  // Calendar dates
  if (
    /\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\b/.test(t) ||
    /\b(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\b/.test(t) ||
    /\b(CHRISTMAS|VALENTINE|HALLOWEEN|NEW YEAR)\b/.test(t)
  ) {
    return { type: 'new-day', signal: `Calendar title card: "${raw.trim()}"`, gapNote: raw.trim() };
  }

  return null;
}

// ─── TIER 3: TOD REGRESSION ─────────────────────────────────────────────────

/** Map a TOD value to a numeric time order for regression detection. */
export function getTimeOrder(tod: TOD): number {
  switch (tod) {
    case 'DAWN':        return 0.5;  // DAWN, SUNRISE
    case 'MORNING':     return 1;    // MORNING, EARLY MORNING
    case 'DAY':         return 2;    // DAY, MIDDAY, NOON
    case 'AFTERNOON':   return 2.5;
    case 'DUSK':        return 3;    // DUSK, SUNSET, GOLDEN HOUR, TWILIGHT
    case 'EVENING':     return 3.5;
    case 'NIGHT':       return 4;    // NIGHT, LATE NIGHT
    case 'MIDNIGHT':    return 4.5;
    default:            return -1;   // UNKNOWN, CONTINUOUS, LATER, etc.
  }
}

type RegressionResult = 'new-day' | 'same-day' | 'ambiguous';

export function checkTODRegression(prev: TOD, curr: TOD): RegressionResult {
  if (SKIP_SET.has(prev) || SKIP_SET.has(curr)) return 'ambiguous';
  const prevTimeOrder = getTimeOrder(prev);
  const currTimeOrder = getTimeOrder(curr);
  if (prevTimeOrder === -1 || currTimeOrder === -1) return 'ambiguous';
  if (currTimeOrder < prevTimeOrder) return 'new-day';
  return 'same-day';
}

// ─── CONCURRENT DETECTION ───────────────────────────────────────────────────

/**
 * Standard screenplay concurrent-thread phrases in action lines.
 * When these appear in a scene's action lines, the scene (or the next scene)
 * is part of a parallel storyline happening at the same time — not a new day.
 */
const CONCURRENT_PHRASES = [
  /\bINTERCUT\s+WITH\b/i,
  /\bINTERCUT\s*[–—:]/i,
  /\bMEANWHILE\s*[,.:]/i,
  /\bAT\s+THE\s+SAME\s+TIME\b/i,
  /\bSIMULTANEOUSLY\b/i,
  /\bCUTTING\s+BETWEEN\b/i,
];

/**
 * Check if a scene's action lines contain a concurrent-thread marker.
 */
export function hasConcurrentMarker(actionLines: string[]): boolean {
  const text = actionLines.join(' ');
  return CONCURRENT_PHRASES.some(re => re.test(text));
}

/**
 * Universal heuristic for concurrent thread detection.
 *
 * A scene is concurrent (parallel storyline, same story day) when:
 *  1. The previous scene's action lines contain a concurrent marker
 *     (INTERCUT WITH, MEANWHILE, SIMULTANEOUSLY, etc.)
 *  2. The current scene has a different location from the previous scene
 *
 * Conservative: when in doubt, do NOT mark as concurrent.
 * A false concurrent suppresses a real day boundary.
 * A missed concurrent only means a day is marked (?) for human review.
 */
function isConcurrentThread(
  scene: ParsedScene,
  prevScene: ParsedScene | null,
): boolean {
  if (!prevScene) return false;
  // Only trigger if the previous scene explicitly set up an intercut/meanwhile
  if (!hasConcurrentMarker(prevScene.actionLines)) return false;
  // Must be a different location
  const loc  = scene.location.toUpperCase();
  const prev = prevScene.location.toUpperCase();
  if (loc === prev) return false;
  return true;
}

// ─── MAIN: buildStoryDayMap ──────────────────────────────────────────────────

export function buildStoryDayMap(scenes: ParsedScene[]): StoryDayResult[] {
  const results: StoryDayResult[] = [];
  let dayCounter = 0;
  let prevTOD: TOD = 'UNKNOWN';
  // Issue 3: after a large time jump, subsequent scenes with no explicit
  // marker get 'inferred' confidence until the next explicit signal.
  let postLargeJump = false;

  /** Helper: push result and clear postLargeJump when an explicit signal fires */
  function pushExplicit(scene: ParsedScene, day: number, timeline: Timeline,
    signal: string, gapNote: string | null, isLargeJump = false) {
    postLargeJump = isLargeJump;
    if (!SKIP_SET.has(scene.tod)) prevTOD = scene.tod;
    results.push(make(scene, day, timeline, 'explicit', signal, gapNote));
  }

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    if (scene.isEpisodeMarker) continue;

    // ── Tier 1B: Title card (prefixMarker) before this scene
    const titleCardMatch = matchTitleCard(scene.titleCardBefore);
    if (titleCardMatch && (titleCardMatch.type === 'new-day' || titleCardMatch.type === 'large-jump')) {
      dayCounter++;
      pushExplicit(scene, dayCounter, 'present',
        titleCardMatch.signal, titleCardMatch.gapNote ?? null,
        titleCardMatch.type === 'large-jump');
      continue;
    }
    if (titleCardMatch?.type === 'flashback') {
      postLargeJump = false;
      results.push(makeFlashback(scene, dayCounter));
      continue;
    }
    if (titleCardMatch?.type === 'concurrent') {
      postLargeJump = false;
      // No day increment, no baseline update
      results.push(make(scene, dayCounter || 1, 'concurrent', 'inferred',
        titleCardMatch.signal, null));
      continue;
    }
    if (titleCardMatch?.type === 'same-day') {
      postLargeJump = false;
      if (!SKIP_SET.has(scene.tod)) prevTOD = scene.tod;
      results.push(make(scene, dayCounter || 1, 'present', 'explicit',
        titleCardMatch.signal, null));
      continue;
    }

    // ── Tier 2A: Flashback detection (slugline or action lines)
    const isFlashback =
      /\bFLASHBACK\b/i.test(scene.slugline) ||
      /\b(MEMORY|DREAM|NIGHTMARE|FLASH\s*BACK)\b/i.test(scene.slugline) ||
      scene.actionLines.some(l => /\bFLASHBACK\s*[:–\-]/i.test(l));

    if (isFlashback) {
      postLargeJump = false;
      results.push(makeFlashback(scene, dayCounter));
      continue;
    }

    // ── Tier 1A: Time jump in heading/slugline (Issue 2)
    const headingJump = matchHeadingTimeJump(scene.slugline);
    if (headingJump && (headingJump.type === 'large-jump' || headingJump.type === 'new-day')) {
      dayCounter++;
      pushExplicit(scene, dayCounter, 'present',
        headingJump.signal, headingJump.gapNote ?? null,
        headingJump.type === 'large-jump');
      continue;
    }

    // ── Tier 1: Action line explicit markers
    const tier1 = matchTier1(scene.actionLines);

    if (tier1?.type === 'new-day' || tier1?.type === 'large-jump') {
      dayCounter++;
      pushExplicit(scene, dayCounter, 'present',
        tier1.signal, tier1.gapNote ?? null,
        tier1.type === 'large-jump');
      continue;
    }

    if (tier1?.type === 'inferred-new-day') {
      dayCounter++;
      postLargeJump = false;
      if (!SKIP_SET.has(scene.tod)) prevTOD = scene.tod;
      results.push(make(scene, dayCounter, 'present', 'inferred',
        tier1.signal, tier1.gapNote ?? null));
      continue;
    }

    if (tier1?.type === 'same-day') {
      postLargeJump = false;
      if (!SKIP_SET.has(scene.tod)) prevTOD = scene.tod;
      results.push(make(scene, dayCounter || 1, 'present', 'explicit', tier1.signal, null));
      continue;
    }

    // ── Tier 3: CONTINUOUS / LATER — same day, do NOT update prevTOD
    if (SKIP_SET.has(scene.tod)) {
      const conf: StoryDayConfidence = postLargeJump ? 'inferred' : 'explicit';
      results.push(make(scene, dayCounter || 1, 'present', conf,
        `CONTINUOUS — "${scene.rawTOD}"`, null));
      continue;
    }

    // ── Tier 4: TOD regression (takes priority over concurrent detection)
    if (dayCounter > 0 && prevTOD !== 'UNKNOWN') {
      const regression = checkTODRegression(prevTOD, scene.tod);
      if (regression === 'new-day') {
        dayCounter++;
        postLargeJump = false;
        prevTOD = scene.tod;
        results.push(make(scene, dayCounter, 'present', 'explicit',
          `TOD regression: ${prevTOD}→${scene.tod}`, null));
        continue;
      }
      if (regression === 'same-day') {
        prevTOD = scene.tod;
        const concurrent = isConcurrentThread(scene, i > 0 ? scenes[i - 1] : null);
        const conf: StoryDayConfidence = concurrent ? 'inferred'
          : postLargeJump ? 'inferred' : 'explicit';
        results.push(make(scene, dayCounter, concurrent ? 'concurrent' : 'present',
          conf,
          concurrent
            ? 'Concurrent thread (INTERCUT/MEANWHILE in previous scene)'
            : `Same day: ${prevTOD}→${scene.tod}`,
          null));
        continue;
      }
      if (regression === 'ambiguous') {
        if (isConcurrentThread(scene, i > 0 ? scenes[i - 1] : null)) {
          results.push(make(scene, dayCounter || 1, 'concurrent', 'inferred',
            'Concurrent thread (INTERCUT/MEANWHILE in previous scene)', null));
          continue;
        }
        prevTOD = scene.tod;
        results.push(make(scene, dayCounter, 'present', 'inherited',
          'Ambiguous NIGHT→NIGHT — assumed same night, review recommended', null));
        continue;
      }
    }

    // ── Tier 5: Concurrent thread (previous scene has INTERCUT/MEANWHILE)
    if (isConcurrentThread(scene, i > 0 ? scenes[i - 1] : null)) {
      if (!SKIP_SET.has(scene.tod)) prevTOD = scene.tod;
      results.push(make(scene, dayCounter || 1, 'concurrent', 'inferred',
        'Concurrent thread (INTERCUT/MEANWHILE in previous scene)', null));
      continue;
    }

    // ── Default: first scene or no signal found
    if (dayCounter === 0) dayCounter = 1;
    const isFirst = i === 0;
    if (!SKIP_SET.has(scene.tod)) prevTOD = scene.tod;
    const conf: StoryDayConfidence = isFirst ? 'explicit' : postLargeJump ? 'inferred' : 'inherited';
    results.push(make(scene, dayCounter, 'present',
      conf,
      isFirst ? 'First scene' : postLargeJump
        ? 'No explicit marker after time jump — review recommended'
        : 'No signal found — assumed same day',
      null));
  }

  return results;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function make(
  scene: ParsedScene,
  dayNum: number,
  timeline: Timeline,
  confidence: StoryDayConfidence,
  signal: string,
  gapNote: string | null,
): StoryDayResult {
  const isFlashback = timeline === 'non-present';
  const prefix = SKIP_SET.has(scene.tod) ? 'D' : todPrefix(scene.tod);
  return {
    sceneNumber: scene.sceneNumber,
    storyDay: dayNum,
    timeline,
    label: isFlashback ? `${prefix}${dayNum} (Flashback)` : `${prefix}${dayNum}`,
    confidence,
    signal,
    gapNote,
  };
}

function makeFlashback(scene: ParsedScene, currentDay: number): StoryDayResult {
  const prefix = SKIP_SET.has(scene.tod) ? 'D' : todPrefix(scene.tod);
  return {
    sceneNumber: scene.sceneNumber,
    storyDay: currentDay || 1,
    timeline: 'non-present',
    label: `${prefix}${currentDay || 1} (Flashback)`,
    confidence: 'explicit',
    signal: 'Flashback detected',
    gapNote: null,
  };
}
