import { normalizeSceneWordPrefix } from './scriptParser-pdf';

/* ━━━ Time of day normalization ━━━ */

export function normalizeTimeOfDay(timeStr: string): 'DAY' | 'NIGHT' | 'MORNING' | 'EVENING' | 'CONTINUOUS' {
  const upper = (timeStr || 'DAY').toUpperCase();
  if (upper === 'NIGHT' || upper === 'NIGHTMARE') return 'NIGHT';
  if (upper === 'MORNING' || upper === 'DAWN' || upper === 'SUNRISE') return 'MORNING';
  if (upper === 'EVENING' || upper === 'DUSK' || upper === 'SUNSET' ||
      upper === 'MAGIC HOUR' || upper === 'GOLDEN HOUR') return 'EVENING';
  if (upper === 'CONTINUOUS' || upper === 'CONT' || upper === 'LATER' ||
      upper === 'SAME' || upper === 'SAME TIME' || upper === 'MOMENTS LATER' ||
      upper === 'SIMULTANEOUS') return 'CONTINUOUS';
  return 'DAY';
}

/* ━━━ Scene heading parsing ━━━ */

export interface ParsedSceneHeading {
  sceneNumber: string | null;
  intExt: 'INT' | 'EXT';
  location: string;
  timeOfDay: string;
  rawSlugline: string;
  isValid: boolean;
}

export function parseSceneHeadingLine(line: string): ParsedSceneHeading {
  const trimmed = line.trim();

  const invalidResult: ParsedSceneHeading = {
    sceneNumber: null, intExt: 'INT', location: '', timeOfDay: 'DAY',
    rawSlugline: trimmed, isValid: false,
  };

  if (!trimmed || trimmed.length < 5) return invalidResult;

  // Normalize "SCENE WORD:" prefix (safety net if text wasn't pre-normalized)
  let cleanLine = normalizeSceneWordPrefix(trimmed).replace(/\s*\*+\s*$/, '').trim();

  const sceneNumPattern = /^(\d+[A-Z]{0,4})\s+/i;
  const trailingSceneNumPattern = /\s+(\d+[A-Z]{0,4})\s*$/i;

  let sceneNumber: string | null = null;
  let workingLine = cleanLine;

  const leadingMatch = workingLine.match(sceneNumPattern);
  if (leadingMatch) {
    sceneNumber = leadingMatch[1].toUpperCase();
    workingLine = workingLine.slice(leadingMatch[0].length).trim();
  }

  const trailingMatch = workingLine.match(trailingSceneNumPattern);
  if (trailingMatch) {
    const trailingNum = trailingMatch[1].toUpperCase();
    if (!sceneNumber) sceneNumber = trailingNum;
    workingLine = workingLine.slice(0, -trailingMatch[0].length).trim();
  }

  const intExtPattern = /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|INT\.?|EXT\.?)\s*/i;
  const intExtMatch = workingLine.match(intExtPattern);

  if (!intExtMatch) return invalidResult;

  const intExtRaw = intExtMatch[1].toUpperCase().replace(/\.$/, '');
  const intExt: 'INT' | 'EXT' = intExtRaw.startsWith('EXT') ? 'EXT' : 'INT';

  workingLine = workingLine.slice(intExtMatch[0].length).trim();
  workingLine = workingLine.replace(/^[\.\-–—]\s*/, '').trim();

  const timeSeparatorPattern = /(?:\s*[-–—\.]+\s*|\s+)(DAY|NIGHT|MORNING|EVENING|AFTERNOON|DAWN|DUSK|SUNSET|SUNRISE|CONTINUOUS|CONT|LATER|SAME|SAME TIME|MOMENTS LATER|SIMULTANEOUS|MAGIC HOUR|GOLDEN HOUR|FLASHBACK|PRESENT|DREAM|FANTASY|NIGHTMARE|ESTABLISHING)(?:\s*[-–—]?\s*(?:FLASHBACK|PRESENT|CONT(?:'D)?)?)?$/i;

  let timeOfDay = 'DAY';
  let location = workingLine;

  const timeMatch = workingLine.match(timeSeparatorPattern);
  if (timeMatch) {
    timeOfDay = timeMatch[1].toUpperCase();
    if (timeOfDay === 'CONT') timeOfDay = 'CONTINUOUS';
    location = workingLine.slice(0, timeMatch.index).trim();
    location = location.replace(/[\s\-–—\.,]+$/, '').trim();
  }

  if (!timeMatch && workingLine.length > 0) {
    // Scene headings should always end after the time-of-day marker (DAY/NIGHT/etc).
    // If no time marker was found at the end, this line likely has action text
    // merged after the heading (PDF extraction artifact).
    // Only accept as a valid heading if the remaining text is short and looks
    // like a bare location (e.g. "INT. OFFICE") — reject anything with
    // character intro patterns (comma + digits) or excessive length.
    if (workingLine.length > 50 || /,\s*\d/.test(workingLine) || /[a-z]/.test(workingLine)) {
      return invalidResult;
    }
    location = workingLine.replace(/[\s\-–—\.,]+$/, '').trim();
  }

  if (!location || location.length < 2) return invalidResult;

  return { sceneNumber, intExt, location, timeOfDay, rawSlugline: trimmed, isValid: true };
}

/**
 * Check if a line is a temporal prefix marker that should be attached to the
 * FOLLOWING scene rather than the preceding scene. These appear on the line
 * immediately before an INT./EXT. heading.
 *
 * Matches: FLASHBACK, FLASH FORWARD, BACK TO PRESENT, END FLASHBACK,
 * and time-jump patterns like "6 MONTHS LATER", "TWO WEEKS AGO", etc.
 */
export function isTemporalPrefixMarker(line: string): boolean {
  if (!line || line.length < 4) return false;
  const t = line.toUpperCase();
  // Don't match scene headings themselves
  if (/^(\d+[A-Z]?\s+)?(INT\.|EXT\.|INT\/EXT|I\/E)/i.test(line)) return false;
  return /\bFLASHBACK\b/.test(t)
      || /\bFLASH\s+FORWARD\b/.test(t)
      || /\bBACK\s+TO\s+PRESENT\b/.test(t)
      || /\bRETURN\s+TO\s+PRESENT\b/.test(t)
      || /\bEND\s+FLASHBACK\b/.test(t)
      || /\b(\d+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|TWENTY|THIRTY|SEVERAL|FEW|MANY|SOME|A\s+FEW)\s+(DAYS?|WEEKS?|MONTHS?|YEARS?)\s+(LATER|AGO|EARLIER)\b/.test(t);
}

/**
 * Scan interstitial text (between two sluglines) for a title card line.
 * Title cards are standalone ALL-CAPS lines like "6 MONTHS LATER",
 * "FRIDAY, DECEMBER 3, 1926", "FLASHBACK - 1985", etc.
 */
export function extractTitleCardFromInterstitial(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (
      /^[A-Z0-9][A-Z\s,.:'\-!0-9]+$/.test(line) &&
      line.length > 4 &&
      line.length < 80 &&
      /\b(FLASHBACK|LATER|AGO|EARLIER|MORNING|YEARS?|MONTHS?|WEEKS?|DAYS?|CHRISTMAS|VALENTINE|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\b/.test(line) &&
      !/^(INT|EXT|EPISODE\s+\d+|ACT\s+(ONE|TWO|THREE|FOUR|FIVE|\d+)|PART\s+(ONE|TWO|THREE|FOUR|\d+)|CHAPTER\s+\d+|SCENE\s+\d+)\b/i.test(line)
    ) {
      return line;
    }
  }
  return null;
}
