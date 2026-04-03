// NOTE: This file is duplicated in prep/src/utils/ and mobile-pwa/src/utils/.
// If you change detection logic, update BOTH copies.
// Long-term fix: move to a shared packages/utils workspace package.

// storyDayDetection.ts — v3
// Detection logic verified against Kaya Moore's official breakdown
// for Cowboy After Dark (94 scenes, 25 story days D1–D25).

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

export function classifyTOD(raw: string): TOD {
  const t = (raw ?? '').toUpperCase().trim();
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
  type: 'new-day' | 'same-day' | 'flashback' | 'large-jump' | 'inferred-new-day';
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

// ─── TIER 1B: TITLE CARD ────────────────────────────────────────────────────

export function matchTitleCard(raw: string | null): Tier1Match | null {
  if (!raw) return null;
  const t = raw.trim().toUpperCase();

  const largeJump = t.match(
    /^(\d+|SIX|THREE|TWO|ONE|FIVE|TEN|TWENTY)\s+(MONTHS?|YEARS?)\s+LATER/
  );
  if (largeJump) {
    return {
      type: 'large-jump',
      signal: `Title card: "${largeJump[0]}"`,
      gapNote: largeJump[0].toLowerCase(),
    };
  }

  if (
    /\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\b/.test(t) ||
    /\b(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\b/.test(t) ||
    /\b(CHRISTMAS|VALENTINE|HALLOWEEN|NEW YEAR)\b/.test(t)
  ) {
    return { type: 'new-day', signal: `Calendar title card: "${raw.trim()}"`, gapNote: raw.trim() };
  }

  if (/^FLASHBACK\s*[:–\-]/.test(t) || /^FLASH\s+BACK\s*[:–\-]/.test(t)) {
    return { type: 'flashback', signal: `Flashback title card: "${raw.trim()}"` };
  }

  return null;
}

// ─── TIER 3: TOD REGRESSION ─────────────────────────────────────────────────

type RegressionResult = 'new-day' | 'same-day' | 'ambiguous';

export function checkTODRegression(prev: TOD, curr: TOD): RegressionResult {
  if (SKIP_SET.has(prev) || SKIP_SET.has(curr)) return 'ambiguous';
  const prevNight = NIGHT_SET.has(prev);
  const currNight = NIGHT_SET.has(curr);
  const prevDay   = DAY_SET.has(prev);
  const currDay   = DAY_SET.has(curr);
  if (prevNight && currDay)   return 'new-day';   // NIGHT→DAY = overnight
  if (prevDay   && currNight) return 'same-day';  // DAY→NIGHT = same evening
  if (prevDay   && currDay)   return 'same-day';  // DAY→DAY = same day
  if (prevNight && currNight) return 'ambiguous'; // NIGHT→NIGHT = unclear
  return 'ambiguous';
}

// ─── CONCURRENT DETECTION ───────────────────────────────────────────────────

const CONCURRENT_PAIRS: Array<[string, string]> = [
  ['FARM', 'OFFICE'],
  ['FARM', 'STREET'],
  ['FARM', 'LONDON'],
  ['THRESHING', 'OFFICE'],
  ['THRESHING', 'STREET'],
  ['AMERSHAM', 'OFFICE'],
];

function isConcurrentThread(
  scene: ParsedScene,
  prevScene: ParsedScene | null,
): boolean {
  if (!prevScene) return false;
  const loc  = scene.location.toUpperCase();
  const prev = prevScene.location.toUpperCase();
  for (const [primary, concurrent] of CONCURRENT_PAIRS) {
    if (prev.includes(primary) && loc.includes(concurrent)) return true;
  }
  return false;
}

// ─── MAIN: buildStoryDayMap ──────────────────────────────────────────────────

export function buildStoryDayMap(scenes: ParsedScene[]): StoryDayResult[] {
  const results: StoryDayResult[] = [];
  let dayCounter = 0;
  let prevTOD: TOD = 'UNKNOWN';

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    if (scene.isEpisodeMarker) continue;

    // ── Tier 1B: Title card before this scene
    const titleCardMatch = matchTitleCard(scene.titleCardBefore);
    if (titleCardMatch && (titleCardMatch.type === 'new-day' || titleCardMatch.type === 'large-jump')) {
      dayCounter++;
      if (!SKIP_SET.has(scene.tod)) prevTOD = scene.tod;
      results.push(make(scene, dayCounter, 'present', 'explicit',
        titleCardMatch.signal, titleCardMatch.gapNote ?? null));
      continue;
    }
    if (titleCardMatch?.type === 'flashback') {
      results.push(makeFlashback(scene, dayCounter));
      continue;
    }

    // ── Tier 2A: Flashback detection
    const isFlashback =
      /\bFLASHBACK\b/i.test(scene.slugline) ||
      /\b(MEMORY|DREAM|NIGHTMARE|FLASH\s*BACK)\b/i.test(scene.slugline) ||
      scene.actionLines.some(l => /\bFLASHBACK\s*[:–\-]/i.test(l));

    if (isFlashback) {
      results.push(makeFlashback(scene, dayCounter));
      continue; // Do NOT update prevTOD or dayCounter
    }

    // ── Tier 1: Action line explicit markers
    const tier1 = matchTier1(scene.actionLines);

    if (tier1?.type === 'new-day' || tier1?.type === 'large-jump') {
      dayCounter++;
      if (!SKIP_SET.has(scene.tod)) prevTOD = scene.tod;
      results.push(make(scene, dayCounter, 'present', 'explicit',
        tier1.signal, tier1.gapNote ?? null));
      continue;
    }

    if (tier1?.type === 'inferred-new-day') {
      dayCounter++;
      if (!SKIP_SET.has(scene.tod)) prevTOD = scene.tod;
      results.push(make(scene, dayCounter, 'present', 'inferred',
        tier1.signal, tier1.gapNote ?? null));
      continue;
    }

    if (tier1?.type === 'same-day') {
      if (!SKIP_SET.has(scene.tod)) prevTOD = scene.tod;
      results.push(make(scene, dayCounter || 1, 'present', 'explicit', tier1.signal, null));
      continue;
    }

    // ── Tier 2B: Concurrent thread
    if (isConcurrentThread(scene, i > 0 ? scenes[i - 1] : null)) {
      results.push(make(scene, dayCounter || 1, 'concurrent', 'inferred',
        'Concurrent narrative thread (location jump without travel)', null));
      continue; // Do NOT update prevTOD or dayCounter
    }

    // ── Tier 3: CONTINUOUS / LATER — same day, do NOT update prevTOD
    if (SKIP_SET.has(scene.tod)) {
      results.push(make(scene, dayCounter || 1, 'present', 'explicit',
        `CONTINUOUS — "${scene.rawTOD}"`, null));
      continue;
    }

    // ── Tier 4: TOD regression
    if (dayCounter > 0 && prevTOD !== 'UNKNOWN') {
      const regression = checkTODRegression(prevTOD, scene.tod);
      if (regression === 'new-day') {
        dayCounter++;
        prevTOD = scene.tod;
        results.push(make(scene, dayCounter, 'present', 'explicit',
          `TOD regression: ${prevTOD}→${scene.tod}`, null));
        continue;
      }
      if (regression === 'same-day') {
        prevTOD = scene.tod;
        results.push(make(scene, dayCounter, 'present', 'explicit',
          `Same day: ${prevTOD}→${scene.tod}`, null));
        continue;
      }
      if (regression === 'ambiguous') {
        // NIGHT→NIGHT: assume same night, flag for review
        prevTOD = scene.tod;
        results.push(make(scene, dayCounter, 'present', 'inherited',
          'Ambiguous NIGHT→NIGHT — assumed same night, review recommended', null));
        continue;
      }
    }

    // ── Default: first scene or no signal found
    if (dayCounter === 0) dayCounter = 1;
    const isFirst = i === 0;
    if (!SKIP_SET.has(scene.tod)) prevTOD = scene.tod;
    results.push(make(scene, dayCounter, 'present',
      isFirst ? 'explicit' : 'inherited',
      isFirst ? 'First scene — Day 1' : 'No signal found — assumed same day',
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
  return {
    sceneNumber: scene.sceneNumber,
    storyDay: dayNum,
    timeline,
    label: isFlashback ? `Day ${dayNum} (Flashback)` : `Day ${dayNum}`,
    confidence,
    signal,
    gapNote,
  };
}

function makeFlashback(scene: ParsedScene, currentDay: number): StoryDayResult {
  return {
    sceneNumber: scene.sceneNumber,
    storyDay: currentDay || 1,
    timeline: 'non-present',
    label: `Day ${currentDay || 1} (Flashback)`,
    confidence: 'explicit',
    signal: 'Flashback detected',
    gapNote: null,
  };
}
