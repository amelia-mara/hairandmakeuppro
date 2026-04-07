import { normalizeSceneWordPrefix } from './scriptParser-pdf';

/**
 * Normalize time of day string to the scene's expected type
 * Maps various script time indicators to our standard set
 */
export function normalizeTimeOfDayForScene(timeStr: string): 'DAY' | 'NIGHT' | 'MORNING' | 'EVENING' | 'CONTINUOUS' {
  const upper = (timeStr || 'DAY').toUpperCase();

  // Night variations
  if (upper === 'NIGHT' || upper === 'NIGHTMARE') return 'NIGHT';

  // Morning variations
  if (upper === 'MORNING' || upper === 'DAWN' || upper === 'SUNRISE') return 'MORNING';

  // Evening variations
  if (upper === 'EVENING' || upper === 'DUSK' || upper === 'SUNSET' ||
      upper === 'MAGIC HOUR' || upper === 'GOLDEN HOUR') return 'EVENING';

  // Continuous variations
  if (upper === 'CONTINUOUS' || upper === 'CONT' || upper === 'LATER' ||
      upper === 'SAME' || upper === 'SAME TIME' || upper === 'MOMENTS LATER' ||
      upper === 'SIMULTANEOUS') return 'CONTINUOUS';

  // Day is default (including AFTERNOON, FLASHBACK, PRESENT, ESTABLISHING, etc.)
  return 'DAY';
}

/**
 * Normalize time of day string to standard format (looser variant used by AI fallback path)
 */
export function normalizeTimeOfDay(tod: string): 'DAY' | 'NIGHT' | 'MORNING' | 'EVENING' | 'CONTINUOUS' {
  const upper = (tod || 'DAY').toUpperCase();
  if (upper.includes('NIGHT')) return 'NIGHT';
  if (upper.includes('MORNING') || upper.includes('DAWN')) return 'MORNING';
  if (upper.includes('EVENING') || upper.includes('DUSK') || upper.includes('SUNSET')) return 'EVENING';
  if (upper.includes('CONTINUOUS') || upper.includes('CONT')) return 'CONTINUOUS';
  return 'DAY';
}

/**
 * Parsed scene heading result
 */
export interface ParsedSceneHeading {
  sceneNumber: string | null;
  intExt: 'INT' | 'EXT';
  location: string;
  timeOfDay: string;
  rawSlugline: string;
  isValid: boolean;
}

/**
 * Check if a line is a scene heading
 * Handles scene numbers before and after INT/EXT
 * Examples:
 *   "4    INT. HOTEL ROOM - CONTINUOUS    4"
 *   "INT. COFFEE SHOP - DAY"
 *   "12A  EXT. PARK - NIGHT  12A"
 *   "I/E. FARMHOUSE - KITCHEN - DAY"
 */
/**
 * Parse a scene heading line and extract all components
 * Handles various formats:
 *   - Scene numbers on left: "4 INT. LOCATION - TIME"
 *   - Scene numbers on both sides: "4 INT. LOCATION - TIME 4"
 *   - Scene numbers with letters: "4A INT. LOCATION - TIME"
 *   - Various INT/EXT formats: INT., EXT., I/E., INT./EXT., INT/EXT
 *   - Various separators: dashes, periods, commas
 */
export function parseSceneHeadingLine(line: string): ParsedSceneHeading {
  const trimmed = line.trim();

  // Default invalid result
  const invalidResult: ParsedSceneHeading = {
    sceneNumber: null,
    intExt: 'INT',
    location: '',
    timeOfDay: 'DAY',
    rawSlugline: trimmed,
    isValid: false,
  };

  if (!trimmed || trimmed.length < 5) return invalidResult;

  // Normalize "SCENE WORD:" prefix before parsing (safety net if not pre-normalized)
  let cleanLine = normalizeSceneWordPrefix(trimmed).replace(/\s*\*+\s*$/, '').trim();

  // Pattern to match scene numbers (with optional letter/word suffix)
  // Handles: "33", "33A", "33AA", "33AB", "145PT1", "A1", etc.
  const sceneNumPattern = /^(\d+[A-Z]{0,4})\s+/i;
  const trailingSceneNumPattern = /\s+(\d+[A-Z]{0,4})\s*$/i;

  let sceneNumber: string | null = null;
  let workingLine = cleanLine;

  // Extract leading scene number
  const leadingMatch = workingLine.match(sceneNumPattern);
  if (leadingMatch) {
    sceneNumber = leadingMatch[1].toUpperCase();
    workingLine = workingLine.slice(leadingMatch[0].length).trim();
  }

  // Extract trailing scene number (and validate it matches leading if both exist)
  const trailingMatch = workingLine.match(trailingSceneNumPattern);
  if (trailingMatch) {
    const trailingNum = trailingMatch[1].toUpperCase();
    if (!sceneNumber) {
      sceneNumber = trailingNum;
    }
    // Remove trailing scene number
    workingLine = workingLine.slice(0, -trailingMatch[0].length).trim();
  }

  // Now check for INT/EXT pattern
  // Supports: INT. INT EXT. EXT I/E. I/E INT./EXT. INT/EXT EXT./INT. EXT/INT
  const intExtPattern = /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|INT\.?|EXT\.?)\s*/i;
  const intExtMatch = workingLine.match(intExtPattern);

  if (!intExtMatch) {
    return invalidResult;
  }

  const intExtRaw = intExtMatch[1].toUpperCase().replace(/\.$/, '');
  const intExt: 'INT' | 'EXT' = intExtRaw.startsWith('EXT') ? 'EXT' : 'INT';

  // Remove INT/EXT from working line
  workingLine = workingLine.slice(intExtMatch[0].length).trim();

  // Remove leading period or dash if present (some scripts have "INT. - LOCATION")
  workingLine = workingLine.replace(/^[\.\-–—]\s*/, '').trim();

  // Now extract time of day and location
  // Build regex to find time of day (handling various separators)
  // Matches: "- DAY", "-- DAY", "– DAY", "— DAY", ". DAY", ", DAY", just "DAY" at end
  const timeSeparatorPattern = /(?:\s*[-–—\.]+\s*|\s+)(DAY|NIGHT|MORNING|EVENING|AFTERNOON|DAWN|DUSK|SUNSET|SUNRISE|CONTINUOUS|CONT|LATER|SAME|SAME TIME|MOMENTS LATER|SIMULTANEOUS|MAGIC HOUR|GOLDEN HOUR|FLASHBACK|PRESENT|DREAM|FANTASY|NIGHTMARE|ESTABLISHING)(?:\s*[-–—]?\s*(?:FLASHBACK|PRESENT|CONT(?:'D)?)?)?$/i;

  let timeOfDay = 'DAY';
  let location = workingLine;

  const timeMatch = workingLine.match(timeSeparatorPattern);
  if (timeMatch) {
    timeOfDay = timeMatch[1].toUpperCase();
    // Normalize some time values
    if (timeOfDay === 'CONT') timeOfDay = 'CONTINUOUS';

    // Extract location (everything before the time match)
    location = workingLine.slice(0, timeMatch.index).trim();
    // Clean up trailing separators from location
    location = location.replace(/[\s\-–—\.,]+$/, '').trim();
  }

  // If no time found but line is valid scene heading format, assume DAY
  if (!timeMatch && workingLine.length > 0) {
    location = workingLine.replace(/[\s\-–—\.,]+$/, '').trim();
  }

  // Validate: must have a location
  if (!location || location.length < 2) {
    return invalidResult;
  }

  return {
    sceneNumber,
    intExt,
    location,
    timeOfDay,
    rawSlugline: trimmed, // Keep original for reference
    isValid: true,
  };
}
