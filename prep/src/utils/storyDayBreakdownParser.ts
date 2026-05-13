import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker — same setup as scriptParser-pdf.ts so the
// two pipelines share a single worker bundle.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Parsed row from a Story Day Breakdown PDF.
 *
 * Source PDF format (one row per scene group):
 *   Story Day            | Scene               | Description       | Timeline
 *   Flashback #1         | 1                   | Young Bry stands… | 12 years prior…
 *   1                    | 2                   | Bry's fight…      | May-19
 *   3                    | 11-15               | Beach, ice creams | Early June 19
 *   Flashback #2         | 23 & 24             | Young Bry…        | 12 years prior…
 *
 * Each row maps to one or more scenes via the Scene field, which can
 * contain a single number, a range (`11-15`), a comma/ampersand list
 * (`23 & 24`, `145-147, 149`), or a value with an alphabetic suffix
 * (`132A`, `31p1`).
 *
 * The PDF also contains FLASHBACKS / SCRIPT ORDER / CHRONOLOGY
 * sections below the main table — those are re-orderings of the same
 * data and are skipped by the parser.
 */
export interface StoryDayRow {
  /** Raw Story Day cell — "Flashback #1", "1", etc. */
  storyDayRaw: string;
  /** Normalised display value to write into `scene.storyDay`.
   *  Numeric values become "Day N"; flashback labels are preserved as-is. */
  storyDay: string;
  /** Set to 'Flashback' when the Story Day cell starts with "Flashback".
   *  Mapped onto `scene.timelineType` so the breakdown form's Timeline →
   *  Type dropdown reflects the chronological context. */
  timelineType?: string;
  /** Raw Scene cell — kept verbatim for the preview UI so the user
   *  can see exactly what the PDF said even when expansion fails. */
  sceneRaw: string;
  /** Expanded list of numeric scene numbers this row targets.
   *  `11-15` expands to [11, 12, 13, 14, 15]; `23 & 24` to [23, 24];
   *  `132A` parses to 132 with `sceneSuffixes` carrying the letter. */
  sceneNumbers: number[];
  /** Optional alphabetic suffixes aligned 1:1 with sceneNumbers.
   *  Lets the apply step prefer scenes whose `numberSuffix` matches
   *  (so `132A` doesn't accidentally overwrite plain scene 132). */
  sceneSuffixes: Array<string | undefined>;
  /** Free-text Description column. Goes into `scene.synopsis`. */
  description: string;
  /** Free-text Timeline column. Goes into `breakdown.timeline.note`. */
  timeline: string;
}

interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
}

/** Position-tagged token harvested from a single PDF page. */
interface Token {
  page: number;
  x: number;
  y: number;
  text: string;
}

/**
 * Extract every text token in the PDF with page + (x, y) positions.
 *
 * Story-day PDFs are essentially long tables, so we flatten across
 * pages — the table continues across page boundaries and the row
 * grouping pass downstream uses `(page, y)` to keep rows on different
 * pages from merging.
 */
async function extractTokens(file: File): Promise<Token[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const tokens: Token[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent({
      includeMarkedContent: true,
      disableNormalization: true,
    });
    for (const item of content.items as PdfTextItem[]) {
      if (!item.str || !item.transform) continue;
      if (item.str.trim() === '') continue;
      tokens.push({
        page: pageNum,
        x: item.transform[4],
        y: item.transform[5],
        text: item.str,
      });
    }
  }
  return tokens;
}

/**
 * Group tokens that share roughly the same Y position into rows.
 *
 * PDF Y coordinates from pdfjs are sub-pixel floats; rows in a printed
 * table sit on the same baseline but text inside a row can shift
 * slightly. We bucket within `±2pt` of each other so a row's tokens
 * stay together while still distinguishing adjacent rows that sit
 * one line-height apart.
 *
 * Returned tuple: { page, y, items: tokens sorted by x ascending }.
 * Rows are sorted top-to-bottom across the document — descending y
 * within each page, ascending page across the doc.
 */
function groupIntoRows(tokens: Token[]): Array<{ page: number; y: number; items: Token[] }> {
  const Y_TOLERANCE = 2;
  type Row = { page: number; y: number; items: Token[] };
  const byPage = new Map<number, Row[]>();

  for (const t of tokens) {
    const rows = byPage.get(t.page) ?? [];
    let placed = false;
    for (const r of rows) {
      if (Math.abs(r.y - t.y) <= Y_TOLERANCE) {
        r.items.push(t);
        placed = true;
        break;
      }
    }
    if (!placed) rows.push({ page: t.page, y: t.y, items: [t] });
    byPage.set(t.page, rows);
  }

  const out: Row[] = [];
  for (const page of Array.from(byPage.keys()).sort((a, b) => a - b)) {
    const rows = byPage.get(page)!;
    rows.sort((a, b) => b.y - a.y); // top of page first
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      out.push(r);
    }
  }
  return out;
}

/** Join a row's tokens into a single string, inserting whitespace
 *  where pdfjs split a fragmented run. Doesn't try to be clever — the
 *  column splitter downstream is what gives us cells. */
function rowAsText(items: Token[]): string {
  return items.map((t) => t.text).join('').trim();
}

/**
 * Decide which column an x-coordinate belongs to.
 *
 * The column boundaries are picked from the header row so we don't
 * hard-code page widths — different page sizes / templates still work
 * as long as the header is readable. Each boundary is the midpoint
 * between the start of one column header and the start of the next;
 * tokens whose x falls below the first midpoint land in column 0,
 * and so on.
 */
function columnFor(x: number, bounds: number[]): number {
  for (let i = 0; i < bounds.length; i++) {
    if (x < bounds[i]) return i;
  }
  return bounds.length;
}

/** Locate the four column header start-positions in a row of tokens.
 *  Returns null if the row isn't a header. We accept any subset of
 *  the four canonical labels — some templates omit the "Description"
 *  header but the column is still there structurally. */
function tryParseHeader(items: Token[]): { storyDayX: number; sceneX: number; descX: number; timelineX: number } | null {
  const text = rowAsText(items).toLowerCase();
  if (!text.includes('story day') || !text.includes('scene')) return null;
  if (!text.includes('description') && !text.includes('timeline')) return null;

  let storyDayX = -1;
  let sceneX = -1;
  let descX = -1;
  let timelineX = -1;

  // Tokens often arrive split ("Story", "Day"). Reconstruct labels by
  // walking the sorted-by-x list and grabbing the x of the first
  // token whose lowercased text starts the canonical word.
  for (const t of items) {
    const w = t.text.trim().toLowerCase();
    if (storyDayX < 0 && w.startsWith('story')) storyDayX = t.x;
    else if (sceneX < 0 && w.startsWith('scene')) sceneX = t.x;
    else if (descX < 0 && w.startsWith('descrip')) descX = t.x;
    else if (timelineX < 0 && w.startsWith('timeline')) timelineX = t.x;
  }

  if (storyDayX < 0 || sceneX < 0 || timelineX < 0) return null;
  // Description column is optional in the header; if missing, place
  // its boundary at the midpoint between Scene and Timeline.
  if (descX < 0) descX = Math.round((sceneX + timelineX) / 2);
  return { storyDayX, sceneX, descX, timelineX };
}

/** True when the row looks like a sentinel for one of the trailing
 *  sections (FLASHBACKS / SCRIPT ORDER / CHRONOLOGY) — these are
 *  re-orderings of the main table and shouldn't be re-applied. */
function isSectionSentinel(items: Token[]): boolean {
  const text = rowAsText(items).toUpperCase().replace(/\s+/g, ' ').trim();
  return (
    text === 'FLASHBACKS' ||
    text === 'SCRIPT ORDER' ||
    text === 'CHRONOLOGY' ||
    /^FLASHBACKS\b/.test(text) ||
    /^SCRIPT ORDER\b/.test(text) ||
    /^CHRONOLOGY\b/.test(text)
  );
}

/**
 * Split a row's tokens into 4 column buckets based on the header's
 * column start positions. Each cell's text is the concatenation of
 * tokens that fall into its column, joined with spaces (and trimmed).
 *
 * For description (column 2) we keep the inter-token whitespace exact
 * since wrapped descriptions in the source rely on space-separation
 * between words. The other three columns trim aggressively.
 */
function rowToCells(
  items: Token[],
  header: { storyDayX: number; sceneX: number; descX: number; timelineX: number },
): [string, string, string, string] {
  // Column boundary = midpoint between this column's start and the
  // next column's start. The first column has no left bound — it
  // catches anything whose x is below storyDayX (rare but possible
  // for centred headers).
  const bounds = [
    (header.storyDayX + header.sceneX) / 2,
    (header.sceneX + header.descX) / 2,
    (header.descX + header.timelineX) / 2,
  ];
  const buckets: string[][] = [[], [], [], []];
  for (const t of items) {
    const c = columnFor(t.x, bounds);
    buckets[c].push(t.text);
  }
  return [
    buckets[0].join(' ').replace(/\s+/g, ' ').trim(),
    buckets[1].join(' ').replace(/\s+/g, ' ').trim(),
    buckets[2].join(' ').replace(/\s+/g, ' ').trim(),
    buckets[3].join(' ').replace(/\s+/g, ' ').trim(),
  ];
}

/** Normalise the Story Day cell into a display string + timelineType. */
function parseStoryDay(raw: string): { storyDay: string; timelineType?: string } {
  const t = raw.trim();
  if (!t) return { storyDay: '' };
  const flashMatch = t.match(/^flashback\s*#?\s*(\d+)/i);
  if (flashMatch) {
    return { storyDay: `Flashback #${flashMatch[1]}`, timelineType: 'Flashback' };
  }
  const num = t.match(/^(\d+)/);
  if (num) return { storyDay: `Day ${num[1]}` };
  // Free-form story day labels ("Inner child", etc.) pass through verbatim.
  return { storyDay: t };
}

/**
 * Expand the Scene cell into a list of scene numbers (+ optional
 * letter suffixes).
 *
 * Accepts:
 *   - "1"           → [{n:1}]
 *   - "11-15"       → [{n:11},{n:12},{n:13},{n:14},{n:15}]
 *   - "23 & 24"     → [{n:23},{n:24}]
 *   - "145-147, 149"→ [{n:145},{n:146},{n:147},{n:149}]
 *   - "132A"        → [{n:132, suffix:'A'}]
 *   - "31p1"        → [{n:31}] — the "p1" page-fragment marker is
 *                     dropped; closest match is still scene 31.
 *   - "31p2 - 39"   → [{n:31},...,{n:39}] — same fragment-drop, then
 *                     range expansion from 31 to 39.
 *   - "X1, X2"      → []     — non-numeric prefixes are skipped and
 *                              surfaced as "not matched" in the UI.
 *   - "156pt"       → [{n:156}] — partial-scene marker dropped.
 *
 * Garbage in (empty / nothing numeric) returns [].
 */
function parseSceneCell(raw: string): { numbers: number[]; suffixes: Array<string | undefined> } {
  const numbers: number[] = [];
  const suffixes: Array<string | undefined> = [];
  const cell = raw.trim();
  if (!cell) return { numbers, suffixes };

  // Split on commas and ampersands — both legitimate separators in
  // the source. Ranges (with hyphens) are handled per-segment below.
  const segments = cell.split(/\s*[,&]\s*/);
  for (const seg of segments) {
    const s = seg.trim();
    if (!s) continue;

    // Range: "11-15" or "31p2 - 39". Strip page fragments first then
    // re-test for the hyphen.
    const rangeMatch = s.match(/^(\d+)[^-\d]*\s*-\s*(\d+)/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (!isNaN(start) && !isNaN(end) && end >= start && end - start < 200) {
        for (let n = start; n <= end; n++) {
          numbers.push(n);
          suffixes.push(undefined);
        }
        continue;
      }
    }

    // Single value with optional alphabetic suffix: "132A", "31p1" →
    // we accept a single letter suffix (A-Z) but drop multi-char
    // page-fragment markers ("p1", "pt") since they don't map onto
    // our `numberSuffix` field cleanly.
    const singleMatch = s.match(/^(\d+)([A-Z])?\b/);
    if (singleMatch) {
      numbers.push(parseInt(singleMatch[1], 10));
      suffixes.push(singleMatch[2] || undefined);
      continue;
    }

    // Non-numeric scene id (X1, X2, etc.) — caller will surface
    // these as unmatched preview entries.
  }
  return { numbers, suffixes };
}

/**
 * Parse a Story Day Breakdown PDF into structured rows.
 *
 * Strategy:
 *   1. Pull every text token with page + (x, y).
 *   2. Bucket tokens into rows by y-proximity.
 *   3. Find the header row to lock in column x-positions.
 *   4. Walk subsequent rows, splitting tokens into 4 cells per row.
 *   5. Stop at the first FLASHBACKS / SCRIPT ORDER / CHRONOLOGY
 *      sentinel — the rows below are re-orderings of the main table.
 *   6. Merge wrap-rows: any row that has a Description / Timeline
 *      cell but no Story Day or Scene cell is a continuation of the
 *      previous row's description.
 *
 * Returns `{ rows, unmatchedRaw }` — unmatchedRaw is a list of the
 * raw scene cells we couldn't parse to a number (for surfacing in
 * the preview UI so the user knows what got skipped).
 */
export async function parseStoryDayBreakdown(file: File): Promise<{
  rows: StoryDayRow[];
  unmatchedRaw: string[];
}> {
  const tokens = await extractTokens(file);
  const rows = groupIntoRows(tokens);

  let header: ReturnType<typeof tryParseHeader> = null;
  const out: StoryDayRow[] = [];
  const unmatchedRaw: string[] = [];

  for (const row of rows) {
    if (!header) {
      const h = tryParseHeader(row.items);
      if (h) header = h;
      continue;
    }
    if (isSectionSentinel(row.items)) break;

    const [sd, sc, desc, tl] = rowToCells(row.items, header);
    // Skip totally blank rows.
    if (!sd && !sc && !desc && !tl) continue;

    // Continuation row: no Story Day AND no Scene → append the
    // Description / Timeline cells to the previous row so wrapped
    // descriptions survive.
    if (!sd && !sc) {
      if (out.length === 0) continue;
      const last = out[out.length - 1];
      if (desc) last.description = `${last.description} ${desc}`.trim();
      if (tl) last.timeline = `${last.timeline} ${tl}`.trim();
      continue;
    }

    const { storyDay, timelineType } = parseStoryDay(sd);
    const { numbers, suffixes } = parseSceneCell(sc);
    if (numbers.length === 0 && sc) unmatchedRaw.push(sc);

    out.push({
      storyDayRaw: sd,
      storyDay,
      timelineType,
      sceneRaw: sc,
      sceneNumbers: numbers,
      sceneSuffixes: suffixes,
      description: desc,
      timeline: tl,
    });
  }

  return { rows: out, unmatchedRaw };
}
