// Standard film industry script revision colours (in traditional order)
const REVISION_COLOURS: { name: string; hex: string }[] = [
  { name: 'White', hex: '#E8E8E8' },
  { name: 'Blue', hex: '#5B9BD5' },
  { name: 'Pink', hex: '#FF69B4' },
  { name: 'Yellow', hex: '#FFD700' },
  { name: 'Green', hex: '#70AD47' },
  { name: 'Goldenrod', hex: '#DAA520' },
  { name: 'Buff', hex: '#F0DC82' },
  { name: 'Salmon', hex: '#FA8072' },
  { name: 'Cherry', hex: '#DE3163' },
  { name: 'Red', hex: '#FF0000' },
  { name: 'Tan', hex: '#D2B48C' },
  { name: 'Lavender', hex: '#B57EDC' },
];

// Build a lookup for case-insensitive matching
const COLOUR_LOOKUP = new Map(
  REVISION_COLOURS.map(c => [c.name.toLowerCase(), c])
);

export interface ScriptRevision {
  colour?: string;
  colourHex?: string;
  date?: string;
  formattedDate?: string;
}

// Date patterns to match in filenames
// Matches: 2024-03-01, 20240301, 01-03-2024, 01/03/2024, 1 March 2024, March 1 2024, etc.
const DATE_PATTERNS = [
  // ISO: 2024-03-01 or 2024_03_01
  /(\d{4})[-_.](\d{2})[-_.](\d{2})/,
  // Compact: 20240301
  /(\d{4})(\d{2})(\d{2})/,
  // UK/EU: 01-03-2024 or 01/03/2024
  /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/,
  // Written: 1 March 2024, 1st March 2024, March 1 2024, March 1st 2024
  /(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
  /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i,
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseMonth(str: string): number {
  const idx = MONTH_NAMES.findIndex(m => m.toLowerCase() === str.toLowerCase());
  return idx >= 0 ? idx : -1;
}

function formatDate(year: number, month: number, day: number): string {
  if (year < 2000 || year > 2100 || month < 0 || month > 11 || day < 1 || day > 31) {
    return '';
  }
  const date = new Date(year, month, day);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function extractDate(text: string): { raw: string; formatted: string } | null {
  // Try ISO/compact patterns first
  const isoMatch = text.match(DATE_PATTERNS[0]);
  if (isoMatch) {
    const formatted = formatDate(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3]);
    if (formatted) return { raw: isoMatch[0], formatted };
  }

  const compactMatch = text.match(DATE_PATTERNS[1]);
  if (compactMatch) {
    const y = +compactMatch[1];
    const m = +compactMatch[2];
    const d = +compactMatch[3];
    if (y >= 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const formatted = formatDate(y, m - 1, d);
      if (formatted) return { raw: compactMatch[0], formatted };
    }
  }

  // UK/EU pattern
  const ukMatch = text.match(DATE_PATTERNS[2]);
  if (ukMatch) {
    const formatted = formatDate(+ukMatch[3], +ukMatch[2] - 1, +ukMatch[1]);
    if (formatted) return { raw: ukMatch[0], formatted };
  }

  // Written: "1 March 2024" or "1st March 2024"
  const writtenMatch1 = text.match(DATE_PATTERNS[3]);
  if (writtenMatch1) {
    const month = parseMonth(writtenMatch1[2]);
    if (month >= 0) {
      const formatted = formatDate(+writtenMatch1[3], month, +writtenMatch1[1]);
      if (formatted) return { raw: writtenMatch1[0], formatted };
    }
  }

  // Written: "March 1, 2024" or "March 1st 2024"
  const writtenMatch2 = text.match(DATE_PATTERNS[4]);
  if (writtenMatch2) {
    const monthName = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)/i);
    if (monthName) {
      const month = parseMonth(monthName[1]);
      if (month >= 0) {
        const formatted = formatDate(+writtenMatch2[2], month, +writtenMatch2[1]);
        if (formatted) return { raw: writtenMatch2[0], formatted };
      }
    }
  }

  return null;
}

/**
 * Parse a script filename to extract the revision colour and date.
 *
 * Examples:
 *   "The Punishing 20240301 Red.pdf" → { colour: "Red", colourHex: "#FF0000", formattedDate: "1 Mar 2024" }
 *   "my_film_blue_draft.pdf"         → { colour: "Blue", colourHex: "#5B9BD5" }
 *   "script_v2.pdf"                  → {}
 */
export function parseScriptRevision(filename: string): ScriptRevision {
  if (!filename) return {};

  // Strip file extension
  const name = filename.replace(/\.[^/.]+$/, '');
  // Normalize separators to spaces for matching
  const normalized = name.replace(/[-_]/g, ' ');

  const result: ScriptRevision = {};

  // Extract colour — match whole words only (case-insensitive)
  // Also match "2nd Blue", "2nd Pink" etc.
  const words = normalized.toLowerCase().split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    // Check for "2nd blue", "2nd pink" etc.
    if (/^\d+(st|nd|rd|th)$/.test(word) && i + 1 < words.length) {
      const colourInfo = COLOUR_LOOKUP.get(words[i + 1]);
      if (colourInfo) {
        result.colour = `${word.replace(/\D+/g, '')}${word.match(/st|nd|rd|th/)?.[0]} ${colourInfo.name}`;
        result.colourHex = colourInfo.hex;
        break;
      }
    }
    // Check standalone colour
    const colourInfo = COLOUR_LOOKUP.get(word);
    if (colourInfo) {
      result.colour = colourInfo.name;
      result.colourHex = colourInfo.hex;
      break;
    }
  }

  // Extract date
  const dateResult = extractDate(normalized);
  if (dateResult) {
    result.date = dateResult.raw;
    result.formattedDate = dateResult.formatted;
  }

  return result;
}
