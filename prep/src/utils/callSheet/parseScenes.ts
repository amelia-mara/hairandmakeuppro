import type { CallSheetScene } from './types';
import { cleanSceneNumber, findAdvanceCutoff, splitRow } from './shared';

// Headers like:
//   SC  I/E  SET & SYNOPSIS  D/N  SD  PGS  CAST  NOTES
//   EP/SC  SET/SYNOPSIS  D/N  PGS  CAST  NOTES
//   LOCATION  SCENE  SET & DESCRIPTION  D/N  PAGES  CAST  NOTES  TIMINGS
const HEADER_RE =
  /\b(SC|SCENE|EP\/SC|LOCATION)\b[\s\S]{0,80}?\b(SET\s*&\s*SYNOPSIS|SET\s*&\s*DESCRIPTION|SET\/SYNOPSIS)\b[\s\S]{0,80}?\bD\/N\b[\s\S]{0,80}?\b(PGS|PAGES)\b[\s\S]{0,80}?\bCAST\b/i;

const PAGES_RE = /^\d+(?:\s+\d+)?\/\d+$/;          // "1/8", "1 5/8"
const PAGES_INT_RE = /^\d+(?:\.\d+)?$/;            // "2"
const DAYNIGHT_RE = /^(?:D|N|D\/N|EVE|MORN|MORNING|EVENING)\s*\d*$/i;
const STORYDAY_RE = /^[A-Z]?\d{1,2}$/;             // story day code "5", "11", "D5"
const SCENE_NUM_RE = /^(?:\d+(?:\/\d+)?(?:[A-Z]+)?(?:\s*-\s*\d+(?:\/\d+)?)?|PU)$/i;
const TIME_RE = /\d{1,2}:\d{2}/;
const CAST_LIST_RE = /\d+[A-Z]*\b(?:\s*[.,]\s*\d+[A-Z]*\b)*/;
const INTEXT_RE = /^(?:INT|EXT|INT\/EXT)\.?$/i;

export function parseScenes(text: string): CallSheetScene[] {
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
    out.push({
      sceneNumber: pending.sceneNumber,
      location: pending.location,
      setDescription,
      action,
      dayNight: pending.dayNight ?? 'D',
      pages: pending.pages,
      cast: pending.cast ?? [],
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
  // First cell is a scene number?
  const first = cleanSceneNumber(cells[0]);
  if (!SCENE_NUM_RE.test(first)) return false;
  // Must also contain at least one classifier on the same row to count.
  const tail = cells.slice(1).join(' ');
  if (DAYNIGHT_RE.test(cells[2] ?? '') || DAYNIGHT_RE.test(cells[3] ?? '')) return true;
  if (PAGES_RE.test(cells[3] ?? '') || PAGES_RE.test(cells[4] ?? '')) return true;
  if (/\b(?:INT|EXT)\b/i.test(tail)) return true;
  if (CAST_LIST_RE.test(tail)) return true;
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

  // Walk remaining cells and classify each.
  for (; i < cells.length; i++) {
    const c = cells[i];
    if (!row.setDescription && (INTEXT_RE.test(c) || /^(?:INT|EXT|INT\/EXT)\b/i.test(c))) {
      // Sometimes I/E is its own tiny cell, sometimes joined with the slug.
      const next = cells[i + 1];
      if (INTEXT_RE.test(c) && next) {
        row.setDescription = `${c} ${next}`.replace(/\s+/g, ' ').trim();
        i += 1;
      } else {
        row.setDescription = c;
      }
      continue;
    }
    if (!row.dayNight && DAYNIGHT_RE.test(c)) {
      row.dayNight = c.toUpperCase();
      continue;
    }
    if (!row.pages && (PAGES_RE.test(c) || PAGES_INT_RE.test(c))) {
      row.pages = c;
      continue;
    }
    if (!row.estimatedTime && /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/.test(c)) {
      row.estimatedTime = c;
      continue;
    }
    if (CAST_LIST_RE.test(c) && /[.,]/.test(c)) {
      row.cast = mergeCast(row.cast, c);
      continue;
    }
    if (!row.action && /[A-Za-z]/.test(c) && c.length > 3) {
      row.action = (row.action ? `${row.action} ${c}` : c).trim();
      continue;
    }
  }

  // Single-token "story day" cells (like "D5") are already captured under
  // dayNight by DAYNIGHT_RE; nothing to do.
  return row;
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
    if (!pending.pages && (PAGES_RE.test(c) || PAGES_INT_RE.test(c))) {
      pending.pages = c;
      continue;
    }
    if (!pending.estimatedTime && /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/.test(c)) {
      pending.estimatedTime = c;
      continue;
    }
    if (CAST_LIST_RE.test(c) && /[.,]/.test(c)) {
      pending.cast = mergeCast(pending.cast, c);
      continue;
    }
    if (/\b(HMU|SFX|VFX|STUNT|AV|PROP|WARDROBE|SET|END\s+OF\s+EP)\b/i.test(c)) {
      pending.notes = pending.notes ? `${pending.notes} ${c}` : c;
      continue;
    }
    if (/^(?:INT|EXT|INT\/EXT)\b/i.test(c)) {
      descBuffer.push(c);
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
  // Whole-line cast list?
  if ((!pending.cast || pending.cast.length === 0) && CAST_LIST_RE.test(rawLine)) {
    const m = rawLine.match(/(?:\d+[A-Z]*\b)(?:\s*[.,]\s*\d+[A-Z]*\b)+/);
    if (m) pending.cast = mergeCast(pending.cast, m[0]);
  }
}

function mergeCast(existing: string[] | undefined, raw: string): string[] {
  const found = (raw.match(/\d+[A-Z]*/g) ?? []).map((s) => s.toUpperCase());
  const set = new Set([...(existing ?? []), ...found]);
  return Array.from(set);
}
// Mark TIME_RE/STORYDAY_RE/HEADER_RE as referenced for tooling that flags
// unused exports — they're consulted via test mirrors.
void TIME_RE;
void STORYDAY_RE;
