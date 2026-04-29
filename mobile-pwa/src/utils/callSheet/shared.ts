// Shared helpers used by every call-sheet sub-parser.

export const MONTHS: Record<string, string> = {
  JAN: '01', JANUARY: '01',
  FEB: '02', FEBRUARY: '02',
  MAR: '03', MARCH: '03',
  APR: '04', APRIL: '04',
  MAY: '05',
  JUN: '06', JUNE: '06',
  JUL: '07', JULY: '07',
  AUG: '08', AUGUST: '08',
  SEP: '09', SEPT: '09', SEPTEMBER: '09',
  OCT: '10', OCTOBER: '10',
  NOV: '11', NOVEMBER: '11',
  DEC: '12', DECEMBER: '12',
};

// Normalise any time-ish string to "HH:MM" 24-hour, or undefined if no match.
// Accepts: "0730", "07:30", "7:30", "8:00 AM", "08.00", "1300".
export function normalizeTime(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  // 4-digit military
  let m = s.match(/^(\d{1,2})[:.\s]?(\d{2})\s*(AM|PM)?$/i);
  if (!m) {
    // try strict 4-digit
    const four = s.match(/^(\d{4})$/);
    if (four) {
      const hh = four[1].slice(0, 2);
      const mm = four[1].slice(2, 4);
      return `${hh}:${mm}`;
    }
    return undefined;
  }
  let hh = parseInt(m[1], 10);
  const mm = m[2];
  const ampm = m[3]?.toUpperCase();
  if (ampm === 'PM' && hh < 12) hh += 12;
  if (ampm === 'AM' && hh === 12) hh = 0;
  if (hh < 0 || hh > 23) return undefined;
  return `${String(hh).padStart(2, '0')}:${mm}`;
}

// "0800-1900" or "07:30 - 08:00" → normalised "HH:MM - HH:MM"
export function normalizeTimeRange(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const m = raw.match(/(\d{1,2}[:.]?\d{2})\s*[-–—to]+\s*(\d{1,2}[:.]?\d{2})/i);
  if (!m) return normalizeTime(raw);
  const a = normalizeTime(m[1]);
  const b = normalizeTime(m[2]);
  if (!a || !b) return undefined;
  return `${a} - ${b}`;
}

// "MONDAY 14TH JULY 2025" / "1ST DECEMBER 2025" / "15TH OF NOVEMBER 2025"
// → ISO YYYY-MM-DD. Returns undefined on no match.
export function parseDateFromText(text: string): string | undefined {
  const re = /(\d{1,2})(?:ST|ND|RD|TH)?\s*(?:OF\s*)?(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:T(?:EMBER)?)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\s*,?\s*(\d{4})?/i;
  const m = text.match(re);
  if (!m) return undefined;
  const day = m[1].padStart(2, '0');
  const month = MONTHS[m[2].toUpperCase()];
  const yearStr = m[3];
  if (!month) return undefined;
  const year = yearStr ?? String(new Date().getFullYear());
  return `${year}-${month}-${day}`;
}

// Tokenise tab-separated row, dropping empty cells.
export function splitRow(line: string): string[] {
  return line.split('\t').map((c) => c.trim()).filter((c) => c.length > 0);
}

// Strip leading "Sc"/"Scene"/"SC" prefix from a scene number cell.
export function cleanSceneNumber(raw: string): string {
  return raw.replace(/^(?:scene|sc\.?)\s*/i, '').trim();
}

// Where the day-of-shoot section ends. Anything after these markers belongs to
// the advance/next-day schedule and must be excluded.
export function findAdvanceCutoff(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (/\b(?:ADVANCE[D]?\s*SCHEDULE|NEXT\s*DAY['’]S?\s*SCHEDULE)\b/i.test(lines[i])) {
      return i;
    }
  }
  return lines.length;
}
