import type { CallSheetLocation } from './types';

export interface LocationsResult {
  unitBase?: CallSheetLocation;
  shootLocation?: CallSheetLocation;
  crewParking?: CallSheetLocation;
  unitNotes?: string[];
}

export function parseLocations(text: string): LocationsResult {
  const out: LocationsResult = {};

  out.unitBase = pickLocation(text, [/UNIT\s*BASE\b/i]);
  out.shootLocation = pickLocation(text, [
    /\bSHOOTING\s*LOCATION\b/i,
    /\bLOCATION\s*\d*\s*:/i,
    /\bLOCATION\b\s*:/i,
  ]);
  out.crewParking = pickLocation(text, [
    /\bCREW\s*(?:&\s*SA\s*)?PARKING\b/i,
    /\bTECH\s*&?\s*CREW\s*PARKING\b/i,
  ]);

  out.unitNotes = parseUnitNotes(text);
  return out;
}

// Find a location label in a line and assemble its address + W3W. The
// address can spill across the same line (with tabs) or the next 1-2 lines.
// Once we find a postcode-like token or a W3W, we stop collecting more.
function pickLocation(text: string, labels: RegExp[]): CallSheetLocation | undefined {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matched = labels.some((re) => re.test(line));
    if (!matched) continue;
    // Skip if this is actually another section heading we share a regex
    // with (e.g. "LOCATION REQUIREMENTS" matching /\bLOCATION\b/).
    if (/\b(REQUIREMENTS|MOVE|MANAGER)\b/i.test(line)) continue;

    // Strip the label off the line and treat the rest as the start of the address.
    let body = line;
    for (const re of labels) body = body.replace(re, '');
    body = body.replace(/^[:\s\t]+/, '').trim();

    // Walk forward up to 3 lines, but stop when we hit a postcode + W3W
    // pair, a new label, or an obvious unrelated row.
    const parts: string[] = [body];
    const W3W_TOKEN = /\/{0,3}[a-z]+\.[a-z]+\.[a-z]+/i;
    const POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/;
    for (let j = 1; j <= 3; j++) {
      const next = lines[i + j];
      if (!next) break;
      const t = next.trim();
      if (!t) break;
      // A new label means the previous location is finished.
      if (/^[A-Z][A-Z\s&/]+:/.test(t)) break;
      // A new section heading.
      if (/^(?:UNIT\s*NOTES|UNIT\s*BASE|LOCATION|CREW|CAST|PRINCIPAL|SC\b|SHOOT|EP\/SC)/i.test(t)) break;
      parts.push(t);
      if (W3W_TOKEN.test(parts.join(' ')) || POSTCODE.test(parts.join(' '))) break;
    }

    return buildLocation(parts.join(' '));
  }
  return undefined;
}

function buildLocation(raw: string): CallSheetLocation | undefined {
  if (!raw) return undefined;

  // Pull a what3words token in any of: "(W3W: word.word.word)",
  // "W3W - ///word.word.word", "///word.word.word",
  // "what3words.com/word.word.word".
  const w3w =
    raw.match(/\(W3W\s*:\s*([a-z]+\.[a-z]+\.[a-z]+)\)/i) ??
    raw.match(/W3W\s*[-:]\s*\/\/\/\s*([a-z]+\.[a-z]+\.[a-z]+)/i) ??
    raw.match(/\/\/\/([a-z]+\.[a-z]+\.[a-z]+)/i) ??
    raw.match(/what3words\.com\/([a-z]+\.[a-z]+\.[a-z]+)/i);

  // Strip W3W out of the body so it doesn't leak into the address.
  let address = raw
    .replace(/\(?\s*W3W\s*[-:]?\s*\/{0,3}[a-z]+\.[a-z]+\.[a-z]+\s*\)?/i, '')
    .replace(/\/\/\/[a-z]+\.[a-z]+\.[a-z]+/i, '')
    .replace(/https?:\/\/what3words\.com\/[a-z]+\.[a-z]+\.[a-z]+/i, '')
    .trim()
    .replace(/^[\t\s]+|[\t\s]+$/g, '');

  // Drop trailing parens / orphaned punctuation.
  address = address.replace(/\s*\(\s*\)\s*$/, '').replace(/\s+/g, ' ');

  // The "name" is the most useful first chunk before a comma.
  const firstChunk = address.split(',')[0]?.trim() ?? address;

  if (!address && !w3w) return undefined;

  return {
    name: firstChunk || 'Location',
    address: address || undefined,
    what3words: w3w ? `///${w3w[1]}` : undefined,
  };
}

function parseUnitNotes(text: string): string[] | undefined {
  // Find the UNIT NOTES heading and capture content lines until we hit the
  // scene table header or an obvious next section.
  const lines = text.split('\n');
  const idx = lines.findIndex((l) => /^\s*UNIT\s*NOTES\b/i.test(l));
  if (idx < 0) return undefined;

  const notes: string[] = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    if (
      /^(?:SC|SCENE|EP\/SC|LOCATION\s+SCENE|Shot\b|Total\s+Pages?|=== PAGE)/i.test(l) ||
      /^(?:CAST\s*INFORMATION|PRINCIPAL\s*CAST|CAST\s*FITTINGS)\b/i.test(l) ||
      /^ID\b/.test(l)
    ) {
      break;
    }
    // Skip page footers and confidentiality boilerplate.
    if (/highly confidential|do not leave|confidential information|do not disclose/i.test(l)) continue;
    notes.push(l);
    if (notes.length >= 12) break; // safety cap
  }
  return notes.length ? notes : undefined;
}
