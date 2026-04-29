import type { CastCall, SupportingArtistCall } from '@/types';
import { normalizeTime } from './shared';

// Cast section header markers seen across the four example formats. Each
// has its own column order, so we detect which header matched and use a
// matching column-mapper.
const CAST_HEADER_RES: Array<{ name: string; re: RegExp; mapper: ColumnMapper }> = [
  // cs4 (Punishing): ID NAME ROLE STATUS PICKUP DRIVER CALL B/FAST COSTUME H&MU TRAVEL ON SET NOTES
  {
    name: 'punishing',
    re: /\bID\b[\s\S]{0,40}?\bNAME\b[\s\S]{0,40}?\bROLE\b[\s\S]{0,40}?\bSTATUS\b[\s\S]{0,40}?\bPICKUP\b[\s\S]{0,40}?\bDRIVER\b[\s\S]{0,40}?\bCALL\b/i,
    mapper: punishingMapper,
  },
  // cs3 (JJFC): ID Cast Character SWF P/UP B'Fast Costume M'Up Travel On Set
  {
    name: 'jjfc',
    re: /\bID\b[\s\S]{0,40}?\bCAST\b[\s\S]{0,40}?\bCHARACTER\b[\s\S]{0,40}?\bSWF\b[\s\S]{0,40}?\bP\/?UP\b/i,
    mapper: jjfcMapper,
  },
  // cs1 (BDATO): ID ARTISTE CHARACTER SWF P/UP CALL COSTUME TRAVEL MAKE-UP REHEARSAL ON SET
  {
    name: 'bdato',
    re: /\bID\b[\s\S]{0,40}?\bARTISTE\b[\s\S]{0,40}?\bCHARACTER\b[\s\S]{0,40}?\bSWF\b[\s\S]{0,40}?\bP\/?UP\b[\s\S]{0,40}?\bCALL\b/i,
    mapper: bdatoMapper,
  },
  // cs2 (Nanny): ID CHARACTER ARTIST SWF P/U P ARR M/UP COST ON SET
  {
    name: 'nanny',
    re: /\bID\b[\s\S]{0,40}?\bCHARACTER\b[\s\S]{0,40}?\bARTIST\b[\s\S]{0,40}?\bSWF\b/i,
    mapper: nannyMapper,
  },
];

const SA_HEADER_RES = [
  /\bSUPPORTING\s*ARTIST(?:E?S)?\b/i,
  /\bSUPPORTING\s*ARTIST\s*\/\s*DOUBLES/i,
];

const SECTION_END_RE =
  /^(?:CAST\s*FITTINGS|SUPPORTING\s*ARTIST|MINIBUS|TRANSPORT|DEPARTMENTAL\s*REQUIREMENTS|REQUIREMENTS|ADDITIONAL\s*REQUIREMENTS|=== PAGE)\b/i;

const ID_RE = /^\d{1,3}[A-Z]?$/;

export function parseCastCalls(text: string): CastCall[] {
  const lines = text.split('\n');
  for (const { re, mapper } of CAST_HEADER_RES) {
    const headerIdx = lines.findIndex((l) => re.test(l));
    if (headerIdx < 0) continue;
    const out: CastCall[] = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      if (SECTION_END_RE.test(line.trim())) break;
      const cells = splitCells(line);
      if (cells.length < 3) continue;
      if (!ID_RE.test(cells[0])) continue;
      const cast = mapper(cells);
      if (cast) out.push(cast);
    }
    if (out.length) return out;
  }
  return [];
}

export function parseSupportingArtists(text: string): SupportingArtistCall[] {
  const lines = text.split('\n');
  const headerIdx = lines.findIndex((l) =>
    SA_HEADER_RES.some((re) => re.test(l)),
  );
  if (headerIdx < 0) return [];

  const out: SupportingArtistCall[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (
      /^(?:DEPARTMENT|REQUIREMENTS|MINIBUS|TRANSPORT|=== PAGE|TOTAL\s*:)/i.test(
        line.trim(),
      )
    ) {
      break;
    }
    const cells = splitCells(line);
    if (cells.length < 2) continue;

    // SAs use a free-er format. Try to find at least one time cell.
    const timeCells = cells.filter((c) => /\d{3,4}|\d{1,2}:\d{2}/.test(c));
    if (!timeCells.length) continue;

    // Pick the first cell that looks like an artist name (letters, no digits).
    const nameCell = cells.find((c) => /^[A-Z][A-Za-z'’\-\s]+$/.test(c) && c.length > 2);
    if (!nameCell) continue;

    out.push({
      id: cells[0] && /^\d/.test(cells[0]) ? cells[0] : `SA${out.length + 1}`,
      name: nameCell,
      designation: cells.find((c) => /STUDENT|EXTRA|FAN|SUPPORTER|PLAYER|REFEREE|CHAPERONE|SUB|CREW/i.test(c)) ?? '',
      status: '-',
      callTime: normalizeTime(timeCells[0]) ?? '',
      makeupCall: timeCells[1] ? normalizeTime(timeCells[1]) : undefined,
      costumeCall: timeCells[2] ? normalizeTime(timeCells[2]) : undefined,
      onSetTime: timeCells[timeCells.length - 1]
        ? normalizeTime(timeCells[timeCells.length - 1])
        : undefined,
    });
    if (out.length > 60) break;
  }
  return out;
}

// Split a row into cells the same way scenes does: tab-prefer, then collapse
// double-spaces. Some PDFs collapse a tab into a wide space; we accept either.
function splitCells(line: string): string[] {
  const tabs = line.split('\t').map((c) => c.trim()).filter(Boolean);
  if (tabs.length >= 3) return tabs;
  return line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
}

type ColumnMapper = (cells: string[]) => CastCall | null;

function pick(cells: string[], idx: number): string | undefined {
  return cells[idx]?.trim() || undefined;
}

function buildCast(args: {
  id?: string;
  name?: string;
  character?: string;
  status?: string;
  pickup?: string;
  driver?: string;
  call?: string;
  bfast?: string;
  costume?: string;
  hmu?: string;
  travel?: string;
  onSet?: string;
  notes?: string;
}): CallCast {
  return {
    id: args.id ?? '',
    name: args.name ?? '',
    character: args.character ?? '',
    status: (args.status as CastCall['status']) ?? 'W',
    pickup: normalizeTime(args.pickup) ?? args.pickup,
    driver: args.driver,
    callTime: normalizeTime(args.call) ?? args.call ?? '',
    makeupCall: normalizeTime(args.hmu) ?? args.hmu,
    costumeCall: normalizeTime(args.costume) ?? args.costume,
    hmuCall: normalizeTime(args.hmu) ?? args.hmu,
    travelTime: normalizeTime(args.travel) ?? args.travel,
    onSetTime: normalizeTime(args.onSet) ?? args.onSet,
    notes: args.notes,
  };
}

type CallCast = CastCall;

// Punishing: ID NAME ROLE STATUS PICKUP DRIVER CALL B/FAST COSTUME H&MU TRAVEL ON SET NOTES
function punishingMapper(cells: string[]): CastCall | null {
  if (cells.length < 8) return null;
  return buildCast({
    id: pick(cells, 0),
    name: pick(cells, 1),
    character: pick(cells, 2),
    status: pick(cells, 3),
    pickup: pick(cells, 4),
    driver: pick(cells, 5),
    call: pick(cells, 6),
    bfast: pick(cells, 7),
    costume: pick(cells, 8),
    hmu: pick(cells, 9),
    travel: pick(cells, 10),
    onSet: pick(cells, 11),
    notes: pick(cells, 12),
  });
}

// JJFC: ID Cast Character SWF P/UP B'Fast Costume M'Up Travel On Set
function jjfcMapper(cells: string[]): CastCall | null {
  if (cells.length < 6) return null;
  return buildCast({
    id: pick(cells, 0),
    name: pick(cells, 1),
    character: pick(cells, 2),
    status: pick(cells, 3),
    pickup: pick(cells, 4),
    bfast: pick(cells, 5),
    costume: pick(cells, 6),
    hmu: pick(cells, 7),
    travel: pick(cells, 8),
    onSet: pick(cells, 9),
  });
}

// BDATO: ID ARTISTE CHARACTER SWF P/UP CALL COSTUME TRAVEL MAKE-UP REHEARSAL ON SET
function bdatoMapper(cells: string[]): CastCall | null {
  if (cells.length < 7) return null;
  return buildCast({
    id: pick(cells, 0),
    name: pick(cells, 1),
    character: pick(cells, 2),
    status: pick(cells, 3),
    pickup: pick(cells, 4),
    call: pick(cells, 5),
    costume: pick(cells, 6),
    travel: pick(cells, 7),
    hmu: pick(cells, 8),
    onSet: pick(cells, 10),
  });
}

// Nanny: ID CHARACTER ARTIST SWF P/U(P) ARR M/UP COST ON SET
function nannyMapper(cells: string[]): CastCall | null {
  if (cells.length < 6) return null;
  return buildCast({
    id: pick(cells, 0),
    character: pick(cells, 1),
    name: pick(cells, 2),
    status: pick(cells, 3),
    pickup: pick(cells, 4),
    call: pick(cells, 5),
    hmu: pick(cells, 6),
    costume: pick(cells, 7),
    onSet: pick(cells, 8),
  });
}
