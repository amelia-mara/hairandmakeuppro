import type { CallSheetScene } from '@/types';
import { cleanSceneNumber, findAdvanceCutoff, splitRow } from './shared';

// Headers like:
//   SC  I/E  SET & SYNOPSIS  D/N  SD  PGS  CAST  NOTES
//   EP/SC  SET/SYNOPSIS  D/N  PGS  CAST  NOTES
//   LOCATION  SCENE  SET & DESCRIPTION  D/N  PAGES  CAST  NOTES  TIMINGS
const HEADER_RE =
  /\b(SC|SCENE|EP\/SC|LOCATION)\b[\s\S]{0,80}?\b(SET\s*&\s*SYNOPSIS|SET\s*&\s*DESCRIPTION|SET\/SYNOPSIS)\b[\s\S]{0,80}?\bD\/N\b[\s\S]{0,80}?\b(PGS|PAGES)\b[\s\S]{0,80}?\bCAST\b/i;

const PAGES_RE = /^\d+(?:\s+\d+)?\/\d+$/;          // "1/8", "1 5/8"
const PAGES_INT_RE = /^\d+(?:\.\d+)?$/;            // "2"
// A small whole-number followed by a fractional pages cell ("1" + "5/8")
// is split across two cells in some PDF extractions. Recognise the second
// half so we can join them.
const PAGES_FRAC_RE = /^\d+\/\d+$/;
const DAYNIGHT_RE = /^(?:D|N|D\/N|EVE|MORN|MORNING|EVENING)\s*\d*$/i;
const STORYDAY_RE = /^[A-Z]?\d{1,2}$/;             // story day code "5", "11", "D5"
const SCENE_NUM_RE = /^(?:\d+(?:\/\d+)?(?:[A-Z]+)?(?:\s*-\s*\d+(?:\/\d+)?)?|PU)$/i;
const TIME_RE = /\d{1,2}:\d{2}/;
// A cell that is *only* cast IDs: starts with optional asterisk + digit,
// the whole cell is digit-led tokens (with optional trailing letters and
// optional ".Name" suffixes used by JJFC-style productions), separated by
// commas. Trailing comma OK ("*2.Gordon, *3.Madison,").
//
// Critically, a lone numeric cell ("3" — the SD/story-day column on cs2)
// must NOT match. We require either a comma (multiple IDs) or a ".Name"
// suffix that signals a JJFC-style cast token.
const CAST_CELL_RE =
  /^\s*\*?\d+[A-Z]*(?:\.[A-Za-z][A-Za-z\s'’\-]*)?(?:\s*,\s*\*?\d+[A-Z]*(?:\.[A-Za-z][A-Za-z\s'’\-]*)?)*\s*,?\s*$/;
function isCastCell(c: string): boolean {
  if (!CAST_CELL_RE.test(c)) return false;
  // Must have a comma or a ".Name" suffix to count.
  return /,/.test(c) || /\d+[A-Z]*\.[A-Za-z]/.test(c);
}
// A cell that contains at least one cast-style token in *part* of its
// content (used for soft fallbacks).
const CAST_TOKEN_RE = /\*?\d+[A-Z]*\b/;
const INTEXT_PREFIX_RE = /^(INT|EXT|INT\/EXT)\.?\s*[-:]?\s*(.*)$/i;
const INTEXT_RE = /^(?:INT|EXT|INT\/EXT)\.?$/i;

/**
 * Optional project knowledge passed in by the caller. The parser uses it
 * to filter cast tokens that look right in isolation but aren't in the
 * project's actual cast list (e.g. stray timing values like "1330" on
 * cs3-style call sheets), and to confirm/normalise scene numbers.
 */
export interface ParseContext {
  /** Integer cast IDs that exist in the schedule/cast roster. */
  validCastNumbers?: Set<number>;
  /** Scene numbers known from the script/schedule (string form). */
  validSceneNumbers?: Set<string>;
}

export function parseScenes(text: string, context?: ParseContext): CallSheetScene[] {
  const lines = text.split('\n').map((l) => l.trimEnd());
  const cutoff = findAdvanceCutoff(lines);
  const slice = lines.slice(0, cutoff);

  // Find the scene table header.
  const headerIdx = slice.findIndex((l) => HEADER_RE.test(l));
  if (headerIdx < 0) return [];

  // Walk forward, gathering rows until we hit a clear end marker.
  const out: CallSheetScene[] = [];
  let pending: Partial<CallSheetScene> | null = null;
  let descBuffer: string[] = [];
  let order = 1;

  const finish = () => {
    if (!pending || !pending.sceneNumber) {
      pending = null;
      descBuffer = [];
      return;
    }
    const desc = descBuffer.map((s) => s.trim()).filter(Boolean);
    const setDescription = desc[0] ?? pending.setDescription ?? 'Scene';
    const action = desc.slice(1).join(' ').trim() || pending.action;
    // Apply the validCastNumbers whitelist when available. Tokens that
    // don't have an integer in the project's cast list (e.g. "1330" — a
    // misclassified time) get dropped without affecting valid IDs.
    const cast = filterCast(pending.cast ?? [], context?.validCastNumbers);
    out.push({
      sceneNumber: pending.sceneNumber,
      location: pending.location,
      setDescription,
      action,
      dayNight: pending.dayNight ?? 'D',
      pages: pending.pages,
      cast,
      notes: pending.notes,
      estimatedTime: pending.estimatedTime,
      shootOrder: order++,
      status: 'upcoming',
    });
    pending = null;
    descBuffer = [];
  };

  for (let i = headerIdx + 1; i < slice.length; i++) {
    const line = slice[i];
    if (!line.trim()) continue;

    if (/^\s*Total(?:\s+pgs?)?\b/i.test(line) || /TOTAL\s*PAGES/i.test(line)) {
      finish();
      break;
    }
    if (/^=== PAGE/i.test(line)) continue;
    if (/highly confidential|do not leave|confidential information/i.test(line)) continue;

    // Banner rows: "RUNNING SCENES…", "MOVE TO…", "LUNCH:", "BRIEFING ON SET",
    // "LOCATION MOVE", "#X COSTUME AND HMU CHANGE". Treat as separators.
    if (
      /^(?:RUNNING\s+SCENE|MOVE\s+(?:TO|INTO)|LUNCH\s*:|BRIEFING\s+ON\s+SET|LOCATION\s+MOVE|#\d|BLOCK\s*&|PHOTO\s+TO\s+BE\s+TAKEN|\*\*WILL\s+PULL)/i.test(line.trim())
    ) {
      // Consider the description block done if we already have a pending row
      // but don't finish the row yet — there may still be cast/timings on the
      // next line.
      continue;
    }

    const cells = splitRow(line);
    if (cells.length === 0) continue;

    // Decide whether this line begins a NEW scene row.
    // Heuristics: first cell looks like a scene number AND we already have
    // structured cells (D/N or pages or cast) on this line OR the next line.
    const looksLikeNewRow = isLikelyNewRow(cells);

    if (looksLikeNewRow) {
      // Commit anything buffered.
      finish();
      pending = consumeRow(cells);
      // Description column may have flowed onto previous/next lines — gather.
      // Punishing-style call sheets put the slugline (INT/EXT. ...) on the
      // line ABOVE the data row, so scoop it up retroactively.
      if (!pending.setDescription) {
        for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
          const prev = slice[j].trim();
          if (!prev) continue;
          if (/^(?:INT|EXT|INT\/EXT)\b/i.test(prev)) {
            pending.setDescription = prev;
            break;
          }
          // Stop scanning back if we hit anything that's clearly not a slug.
          if (/^(?:LOC\s*\d+|RUNNING|MOVE|LUNCH|BRIEFING|#\d|\d)/.test(prev)) break;
        }
      }
      if (pending.setDescription) descBuffer.push(pending.setDescription);
      if (pending.action) descBuffer.push(pending.action);
      // Reset so we rebuild from descBuffer at finish().
      pending.setDescription = undefined;
      pending.action = undefined;
      continue;
    }

    // Otherwise this is a continuation line for the current pending row.
    if (!pending) continue;
    mergeContinuation(pending, descBuffer, cells, line);
  }
  finish();
  return out;
}

// ── helpers ───────────────────────────────────────────────────────

function isLikelyNewRow(cells: string[]): boolean {
  if (!cells.length) return false;
  // The scene-number cell can be the first cell OR the second cell when
  // the row carries a "LOC 1"-style location prefix. Find which.
  let sceneIdx = 0;
  if (/^LOC\s*\d+$/i.test(cells[0])) sceneIdx = 1;
  if (sceneIdx >= cells.length) return false;
  const sceneCell = cleanSceneNumber(cells[sceneIdx]);
  if (!SCENE_NUM_RE.test(sceneCell)) return false;
  // Must also contain at least one classifier on the same row to count.
  const tail = cells.slice(sceneIdx + 1).join(' ');
  if (cells.slice(sceneIdx + 1).some((c) => DAYNIGHT_RE.test(c))) return true;
  if (cells.slice(sceneIdx + 1).some((c) => PAGES_RE.test(c) || PAGES_INT_RE.test(c))) return true;
  if (/\b(?:INT|EXT)\b/i.test(tail)) return true;
  if (cells.slice(sceneIdx + 1).some((c) => isCastCell(c))) return true;
  return false;
}

function consumeRow(cells: string[]): Partial<CallSheetScene> {
  // Cell roles (variable order across formats). Walk left→right and classify.
  const row: Partial<CallSheetScene> = { cast: [] };
  let i = 0;

  // Optional location prefix (cs4: "LOC 1")
  if (/^LOC\s*\d+$/i.test(cells[i])) {
    row.location = cells[i];
    i += 1;
  }
  // Scene number
  if (i < cells.length && SCENE_NUM_RE.test(cleanSceneNumber(cells[i]))) {
    row.sceneNumber = cleanSceneNumber(cells[i]);
    i += 1;
  }

  // Walk remaining cells and classify each. classifyCell handles mixed
  // content like "INT ABBI argues..." or "1 1/8 1, 2".
  for (; i < cells.length; i++) {
    const next = cells[i + 1];
    const consumed = classifyCell(row, cells[i], next);
    if (consumed) i += 1;
  }
  return row;
}

// Try to slot the cell's content into one of the row fields. Returns true
// when the next cell was also consumed (e.g. pages "1" + "5/8" pair).
function classifyCell(
  row: Partial<CallSheetScene>,
  cell: string,
  next?: string,
): boolean {
  const c = cell.trim();
  if (!c) return false;

  // INT/EXT prefix split: "INT - ABBI argues" → I/E + description.
  const ie = c.match(INTEXT_PREFIX_RE);
  if (ie) {
    const ePart = ie[1].toUpperCase();
    const rest = ie[2].trim();
    // If the prefix is the whole cell ("INT"), pair with next cell as desc.
    if (!rest) {
      row.setDescription = (row.setDescription ?? `${ePart}.${next ? ` ${next}` : ''}`).trim();
      return Boolean(next);
    }
    // Otherwise treat the prefix as part of setDescription and the rest as
    // the synopsis/action — different productions use either column.
    if (!row.setDescription) row.setDescription = `${ePart}. ${rest}`;
    else if (!row.action) row.action = rest;
    return false;
  }

  if (!row.dayNight && DAYNIGHT_RE.test(c)) {
    row.dayNight = c.toUpperCase();
    return false;
  }

  if (!row.pages && (PAGES_RE.test(c) || PAGES_FRAC_RE.test(c))) {
    row.pages = c;
    return false;
  }
  if (!row.pages && PAGES_INT_RE.test(c) && next && PAGES_FRAC_RE.test(next.trim())) {
    row.pages = `${c} ${next.trim()}`;
    return true;
  }

  // Combined "pages + cast" cell: "1 1/8 1, 2" — the cell starts with a
  // pages token and continues with comma-separated cast IDs.
  if (!row.pages || !row.cast?.length) {
    const split = splitPagesAndCast(c);
    if (split) {
      if (!row.pages && split.pages) row.pages = split.pages;
      if (split.cast.length) row.cast = mergeCast(row.cast, split.cast.join(','));
      return false;
    }
  }

  if (!row.estimatedTime && /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/.test(c)) {
    row.estimatedTime = c;
    return false;
  }

  // Strict cast cell: must be only digit-led tokens (with optional ".Name"
  // suffix), comma-separated. Notes columns like "Game time, players take..."
  // won't match because they don't start with digits.
  if (isCastCell(c)) {
    row.cast = mergeCast(row.cast, c);
    return false;
  }
  // Once both dayNight and pages are filled, a lone digit-led token in the
  // remaining cells is the cast column (cs4 single-cast scenes like "2").
  if (row.dayNight && row.pages && /^\s*\*?\d+[A-Z]*\s*$/.test(c)) {
    row.cast = mergeCast(row.cast, c);
    return false;
  }

  // Anything else with substantial text becomes setDescription / action.
  if (/[A-Za-z]/.test(c) && c.length > 3) {
    if (!row.setDescription) row.setDescription = c;
    else if (!row.action) row.action = c;
    else row.action = `${row.action} ${c}`;
  }
  return false;
}

// Split a cell that holds both pages and cast (e.g. "1 1/8 1, 2") into
// the pages portion and the cast tokens. Returns null if it doesn't look
// like a combined cell.
function splitPagesAndCast(c: string): { pages?: string; cast: string[] } | null {
  const m = c.match(/^\s*(\d+(?:\s+\d+)?\/\d+|\d+)\s+(\d.*)$/);
  if (!m) return null;
  const cast = m[2].trim();
  if (!isCastCell(cast)) return null;
  return { pages: m[1].trim(), cast: cast.split(/\s*,\s*/).filter(Boolean) };
}

function mergeContinuation(
  pending: Partial<CallSheetScene>,
  descBuffer: string[],
  cells: string[],
  rawLine: string,
): void {
  // Continuation lines often hold:
  //  - more description ("EXT. ROAD\nGWEN treks…")
  //  - more cast IDs
  //  - the timings cell
  //  - HMU/SFX/STUNT notes
  for (const c of cells) {
    if (!pending.dayNight && DAYNIGHT_RE.test(c)) {
      pending.dayNight = c.toUpperCase();
      continue;
    }
    if (!pending.pages && (PAGES_RE.test(c) || PAGES_FRAC_RE.test(c) || PAGES_INT_RE.test(c))) {
      pending.pages = c;
      continue;
    }
    if (!pending.estimatedTime && /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/.test(c)) {
      pending.estimatedTime = c;
      continue;
    }
    // Combined "pages + cast" cell on a continuation line.
    const split = splitPagesAndCast(c);
    if (split) {
      if (!pending.pages && split.pages) pending.pages = split.pages;
      if (split.cast.length) pending.cast = mergeCast(pending.cast, split.cast.join(','));
      continue;
    }
    if (isCastCell(c)) {
      pending.cast = mergeCast(pending.cast, c);
      continue;
    }
    if (pending.dayNight && pending.pages && /^\s*\*?\d+[A-Z]*\s*$/.test(c)) {
      pending.cast = mergeCast(pending.cast, c);
      continue;
    }
    if (/\b(HMU|SFX|VFX|STUNT|AV|PROP|WARDROBE|END\s+OF\s+EP)\b/i.test(c)) {
      pending.notes = pending.notes ? `${pending.notes} ${c}` : c;
      continue;
    }
    if (/^(?:INT|EXT|INT\/EXT)\b/i.test(c)) {
      // Descriptive slug — keep the first one we see, ignore later dupes
      // so we don't append the same slug twice.
      if (!descBuffer.some((s) => s.trim() === c.trim())) descBuffer.push(c);
      continue;
    }
    if (/[A-Za-z]/.test(c) && c.length > 3) {
      descBuffer.push(c);
    }
  }
  // Sometimes a single-time cell (just "13:45 - 14:15") sits alone on its line.
  if (!pending.estimatedTime && /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/.test(rawLine)) {
    const m = rawLine.match(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/);
    if (m) pending.estimatedTime = m[0];
  }
}

// Pull cast IDs from a "*2.Gordon, *3.Madison, 14C.Daniella" style cell.
// Strict: each token must start with optional asterisk + digit, and we
// ignore any name suffix after the dot. mergeCast preserves order.
function mergeCast(existing: string[] | undefined, raw: string): string[] {
  const found: string[] = [];
  for (const tok of raw.split(/\s*,\s*/)) {
    const m = tok.match(/^\s*\*?(\d+[A-Z]*)\b/);
    if (m) found.push(m[1].toUpperCase());
  }
  const set = new Set([...(existing ?? []), ...found]);
  return Array.from(set);
}

// Drop cast IDs whose integer prefix isn't in the project's known cast
// list. Without a whitelist, return the list untouched. Letter suffixes
// like "10C" / "20T" are preserved on the token; only the integer is
// validated against the whitelist.
function filterCast(ids: string[], valid?: Set<number>): string[] {
  if (!valid || valid.size === 0) return ids;
  return ids.filter((id) => {
    const m = id.match(/^(\d+)/);
    if (!m) return false;
    return valid.has(parseInt(m[1], 10));
  });
}
// Silence "unused" lint for regexes referenced only by test mirrors.
void TIME_RE;
void STORYDAY_RE;
void INTEXT_RE;
void CAST_TOKEN_RE;
