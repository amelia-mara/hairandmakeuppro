/**
 * Schedule PDF parser — handles both "Full Fat" and "One-line"
 * production schedule layouts that Movie Magic Scheduling produces.
 *
 *   Full Fat: each scene takes ~5 lines: a SCN header, a data line
 *   with scene number + description + story-day code + pages, then
 *   one or more "Cast Members" sub-blocks with "N. NAME" rows.
 *
 *   One-line: each scene is two lines: a "Scn" marker + a data line
 *   that includes cast numbers inline (e.g. "1, 2, 5, 6") followed
 *   by "AVs".
 *
 * Both share day boundaries:
 *   "Shoot Day #N <weekday>, <date>, <year>" opens a day,
 *   "End of Day #N ..."                       closes it.
 *
 * The parser walks lines line-by-line, tracking the current day +
 * pending scene, and folds Full-Fat cast rows / One-line inline
 * numbers into the same `castNumbers: number[]` field.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import type {
  ProductionSchedule,
  ScheduleCastMember,
  ScheduleDay,
  ScheduleSceneEntry,
} from '@/stores/scheduleStore';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface ParseResult {
  schedule: ProductionSchedule;
  rawText: string;
}

/* ━━━ Public API ━━━ */

export async function parseSchedulePDF(file: File): Promise<ParseResult> {
  const pdfUri = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

  const text = await extractTextFromPDF(file);
  const days = extractDays(text);
  const castList = buildCastList(text, days);
  const metadata = extractMetadata(text);

  const schedule: ProductionSchedule = {
    id: crypto.randomUUID(),
    productionName: metadata.productionName,
    scriptVersion: metadata.scriptVersion,
    scheduleVersion: metadata.scheduleVersion,
    status: days.length > 0 ? 'complete' : 'partial',
    castList,
    days,
    totalDays: days.length,
    uploadedAt: new Date().toISOString(),
    pdfUri,
    rawText: text,
  };

  return { schedule, rawText: text };
}

/**
 * Generate a thumbnail image (PNG data URI) from the first page.
 */
export async function generateScheduleThumbnail(pdfDataUri: string): Promise<string> {
  const raw = atob(pdfDataUri.split(',')[1]);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 0.5 });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  return canvas.toDataURL('image/png');
}

/* ━━━ Text extraction ━━━ */

async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const rows: Map<number, Array<{ x: number; text: string; width: number }>> = new Map();

    for (const item of textContent.items as Array<{ str: string; transform: number[]; width: number }>) {
      if (!item.str || item.str.trim() === '') continue;
      const y = Math.round(item.transform[5] / 3) * 3;
      const x = item.transform[4];
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x, text: item.str, width: item.width || 0 });
    }

    const sortedY = Array.from(rows.keys()).sort((a, b) => b - a);
    for (const y of sortedY) {
      const rowItems = rows.get(y)!.sort((a, b) => a.x - b.x);
      let rowText = '';
      let lastX = 0;
      let lastWidth = 0;
      for (const item of rowItems) {
        const gap = item.x - (lastX + lastWidth);
        if (lastX > 0 && gap > 15) rowText += '\t';
        else if (lastX > 0 && gap > 3) rowText += ' ';
        rowText += item.text;
        lastX = item.x;
        lastWidth = item.width;
      }
      fullText += rowText.trimEnd() + '\n';
    }
    fullText += `\n=== PAGE ${i} ===\n\n`;
  }

  return fullText;
}

/* ━━━ Day + scene extraction ━━━ */

const DAY_HEADER_RE = /Shoot\s+Day\s+#(\d+)\s+([A-Za-z]+),\s+(\d{1,2}\s+[A-Za-z]+,\s+\d{4})/i;
const DAY_END_RE = /End\s+of\s+Day\s+#(\d+)/i;
const HOURS_RE = /(\d{4})-(\d{4})\s+SCWD/i;
const LOCATION_HEADER_RE = /^[\s\t]*([A-Z][^\n]*\([A-Za-z][^)]*\))\s*$/;

const SCENE_HEADER_RE =
  /^[\s\t]*(?:Scn|SCN)\s+(INT|EXT|I\/E|INT\/EXT|EXT\/INT)\s+(.+?)\s+(DAY|NIGHT|DAWN|DUSK|EVENING|EVENIN|MORNING|MORNI|AFTERNOON|CONT|CONTINUOUS|MAGIC\s+HOUR)\b/i;

// Full-Fat data line: <num>\t<desc>\t<storyDay> <pages>\t<address>
//   "51\tTOM finds JESS & SOREN…\tD10 6/8\t58 Bassett Crescent…"
const FULL_FAT_DATA_RE =
  /^[\s\t]*(\d+(?:[A-Za-z]{1,3})?)[\s\t]+(.+?)[\s\t]+([DNFP][A-Z]?\d+(?:[A-Za-z]{0,3})?|FB\d+|DAWN\d*|DUSK\d*)\s+(\d+(?:\s+\d+\/\d+)?|\d+\/\d+|\d+)(?:[\s\t]+(.*))?$/;

// One-Line data line — pdf.js splits the row into TWO entries
// because the storyDay sits at a slightly different baseline:
//   "51 TOM finds JESS & SOREN…\t6/8 2, 5, 6"      ← this regex
//   "D10\tAVs"                                     ← STORYDAY_TAIL_RE
// So the data line has number + description + pages + cast list,
// and storyDay is filled in from the follow-up line. We anchor on
// the literal \t between description and pages — the pdf.js
// extractor inserts it for the column gap, and it lets us match
// descriptions containing digits ("6 months pass…") without the
// regex consuming the wrong digit as the pages start.
const ONE_LINE_DATA_RE =
  /^[\s\t]*(\d+(?:[A-Za-z]{1,3})?)[\s]+([^\t]+?)\t+(\d.*)$/;

// Tail line for One-Line scenes: the storyDay code is on its own
// row in pdf.js extraction, terminated by "AVs".
const STORYDAY_TAIL_RE =
  /^[\s\t]*([DNFP][A-Z]?\d+(?:[A-Za-z]{0,3})?|FB\d+|DAWN\d*|DUSK\d*)[\s\t]*AVs\b/i;

const CAST_ROW_RE = /^[\s\t]*(_?\d+[A-Za-z]?)\.\s*(.+?)\s*$/;
// Same pattern but globally scoped — used for picking out every
// cast entry on a multi-column line like
// "1. BRY                  6. SOREN              Chaperone (...)"
// where columns 2+ would otherwise be missed.
const CAST_INLINE_RE = /(_?\d{1,3}[A-Za-z]?)\.\s+([A-Z][A-Za-z'\-/.\s]+?)(?=\s{2,}|\t|$)/g;

interface PendingScene {
  intExt: 'INT' | 'EXT';
  setLocation: string;
  dayNight: string;
  sceneNumber?: string;
  description?: string;
  storyDay?: string;
  pages?: string;
  castNumbers: number[];
  shootOrder: number;
}

function extractDays(text: string): ScheduleDay[] {
  const movieMagic = extractDaysMovieMagic(text);
  if (movieMagic.length > 0) return movieMagic;
  // Fall back to the production-schedule layout (DAY N + "pgs Scenes:")
  return extractDaysProductionSchedule(text);
}

function extractDaysMovieMagic(text: string): ScheduleDay[] {
  const days: ScheduleDay[] = [];
  const lines = text.split('\n');

  let currentDay: ScheduleDay | null = null;
  let pendingScene: PendingScene | null = null;
  let pendingLocation: string | null = null;
  let pendingHours: string | null = null;
  let shootOrder = 0;

  const finalizeScene = () => {
    if (currentDay && pendingScene && pendingScene.sceneNumber) {
      const entry: ScheduleSceneEntry = {
        sceneNumber: pendingScene.sceneNumber,
        intExt: pendingScene.intExt,
        dayNight: normalizeDayNight(pendingScene.dayNight),
        setLocation: pendingScene.setLocation,
        description: pendingScene.description,
        pages: pendingScene.pages,
        castNumbers: dedupe(pendingScene.castNumbers),
        shootOrder: pendingScene.shootOrder,
        // Extra: storyDay is preserved via description prefix? No — store separately later.
      };
      // Attach storyDay onto the entry by extending the type at runtime;
      // ScheduleSceneEntry doesn't have it but the rest of prep reads
      // it via the description if needed.
      (entry as ScheduleSceneEntry & { storyDay?: string }).storyDay = pendingScene.storyDay;
      currentDay.scenes.push(entry);
    }
    pendingScene = null;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const line = rawLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();

    // "Shoot Day #N Monday, 18 May, 2026" → open a new day.
    const dayHeader = line.match(DAY_HEADER_RE);
    if (dayHeader) {
      finalizeScene();
      const dayNumber = parseInt(dayHeader[1], 10);
      const dayOfWeek = dayHeader[2];
      // The schedule prints "18 May, 2026"; the UI uses
      // `new Date(iso + 'T00:00:00')` which only accepts
      // YYYY-MM-DD, so convert before storing.
      const date = toIsoDate(dayHeader[3]);
      currentDay = {
        dayNumber,
        date,
        dayOfWeek,
        location: pendingLocation || '',
        hours: pendingHours || undefined,
        scenes: [],
      };
      days.push(currentDay);
      shootOrder = 0;
      pendingLocation = null;
      pendingHours = null;
      continue;
    }

    // "End of Day #N ..." → close the day.
    if (DAY_END_RE.test(line)) {
      finalizeScene();
      // Attempt to grab "Total Pages: 4 6/8" from the same line.
      const totalPagesMatch = line.match(/Total\s+Pages?:?\s+(.+?)(?:\s|$)/i);
      if (currentDay && totalPagesMatch) currentDay.totalPages = totalPagesMatch[1].trim();
      currentDay = null;
      continue;
    }

    // Scene marker — both formats start with SCN/Scn + INT/EXT.
    const sceneHeader = rawLine.match(SCENE_HEADER_RE);
    if (sceneHeader && currentDay) {
      finalizeScene();
      const intExtRaw = sceneHeader[1].toUpperCase();
      const intExt: 'INT' | 'EXT' = intExtRaw.startsWith('EXT') ? 'EXT' : 'INT';
      shootOrder++;
      pendingScene = {
        intExt,
        setLocation: sceneHeader[2].trim(),
        dayNight: sceneHeader[3].trim(),
        castNumbers: [],
        shootOrder,
      };
      continue;
    }

    // Scene data line (right after the SCN header). We try the
    // Full-Fat layout first because its storyDay-inline shape is
    // more specific; if that doesn't match, fall through to the
    // One-Line layout (storyDay arrives on the next line via
    // STORYDAY_TAIL_RE).
    if (pendingScene && !pendingScene.sceneNumber) {
      const ff = rawLine.match(FULL_FAT_DATA_RE);
      if (ff) {
        pendingScene.sceneNumber = ff[1];
        pendingScene.description = ff[2].trim();
        pendingScene.storyDay = ff[3].trim();
        pendingScene.pages = ff[4].trim();
        // Full-Fat trailing is the address — ignore.
        continue;
      }

      const ol = rawLine.match(ONE_LINE_DATA_RE);
      if (ol) {
        pendingScene.sceneNumber = ol[1];
        pendingScene.description = ol[2].trim();
        // Tail = pages + cast numbers run together. Pages comes
        // first in fractions/integers; the rest is cast.
        const tail = ol[3];
        const pagesM = tail.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+)\s*(.*)$/);
        if (pagesM) {
          pendingScene.pages = pagesM[1].trim();
          if (pagesM[2]) {
            pendingScene.castNumbers.push(...parseCastNumberList(pagesM[2]));
          }
        }
        continue;
      }
    }

    // One-Line storyDay tail line: "D10\tAVs" arrives on the row
    // AFTER the data line because pdf.js bins the storyDay column
    // separately. Only apply if the pending scene has data but no
    // storyDay yet.
    if (pendingScene && pendingScene.sceneNumber && !pendingScene.storyDay) {
      const sd = rawLine.match(STORYDAY_TAIL_RE);
      if (sd) {
        pendingScene.storyDay = sd[1].trim();
        continue;
      }
    }

    // Cast rows inside a Full-Fat "Cast Members" block. The PDF
    // lays the section out in columns, e.g.
    //   "1. BRY                  6. SOREN              Chaperone …"
    // so we use a global regex (CAST_INLINE_RE) to pick up every
    // "N. NAME" hit on the line, not just the first.
    if (pendingScene && CAST_ROW_RE.test(rawLine)) {
      for (const m of rawLine.matchAll(CAST_INLINE_RE)) {
        const numToken = m[1];
        if (numToken.startsWith('_')) continue; // stunt double
        const num = parseInt(numToken, 10);
        if (Number.isFinite(num) && num > 0 && num < 1000) {
          pendingScene.castNumbers.push(num);
        }
      }
      continue;
    }

    // Location header for the NEXT day (Full-Fat + One-line both
    // print a centred location name + hours line above each "Shoot
    // Day #N" marker).
    if (!currentDay) {
      const locMatch = rawLine.match(LOCATION_HEADER_RE);
      if (locMatch) pendingLocation = locMatch[1].trim();
      const hoursMatch = line.match(HOURS_RE);
      if (hoursMatch) pendingHours = `${formatTime(hoursMatch[1])}–${formatTime(hoursMatch[2])}`;
    }
  }

  finalizeScene();
  return days;
}

/* ━━━ Cast list ━━━ */

/**
 * Build the cast number → name map. Scans (in order):
 *
 * 1. A dedicated cast-list page or section, when present.
 *    Production schedules often include a numbered cast roster
 *    on page 1 like:
 *
 *        1.  BRY ............ Sarah Smith
 *        2.  TOM ............ John Doe
 *        3.  HARPER / JESSICA Anna Lee
 *
 *    or as a tab-separated table. This is the preferred source
 *    because One-Line schedules carry no inline cast names.
 *
 * 2. Aggregated inline references — every "N. NAME" row in any
 *    "Cast Members" block across the body. Full-Fat layouts cover
 *    this; the most-common name variant for a number wins.
 *
 * 3. Backfill — for any cast number referenced in scene rows but
 *    never resolved to a name, insert a placeholder ("Cast N") so
 *    the UI still shows the number.
 */
function buildCastList(text: string, days: ScheduleDay[]): ScheduleCastMember[] {
  // Pass 1 — dedicated cast list section, if present.
  const explicit = scanExplicitCastList(text);
  // Pass 1b — production-schedule format ("1.PETER" columns on
  // page 1). The generic scanner misses this when there's no
  // space after the dot.
  const production = scanProductionCastList(text);
  // Pass 2 — inline aggregation across the whole text.
  const inline = aggregateInlineCastRows(text);

  // Merge: production / explicit win where both exist; inline
  // fills the rest.
  const byNumber = new Map<number, string>();
  for (const c of inline) byNumber.set(c.number, c.name);
  for (const c of production) byNumber.set(c.number, c.name);
  for (const c of explicit) byNumber.set(c.number, c.name); // override

  // Pass 3 — backfill referenced numbers with placeholders.
  for (const day of days) {
    for (const scene of day.scenes) {
      for (const n of scene.castNumbers) {
        if (!byNumber.has(n)) byNumber.set(n, `Cast ${n}`);
      }
    }
  }

  const list: ScheduleCastMember[] = Array.from(byNumber.entries())
    .map(([number, name]) => ({ number, name }))
    .sort((a, b) => a.number - b.number);
  return list;
}

/**
 * Look for a dedicated cast roster on the first page or under a
 * "Cast List / Cast Members / Cast" heading. Tolerates several
 * common layouts:
 *
 *   "1.  BRY                  Sarah Smith"
 *   "1   BRY"
 *   "1)  BRY ........ Sarah Smith"
 *   "1\tBRY\tSarah Smith"
 *
 * Returns whatever it can resolve; an empty list is fine — the
 * caller will fall back to inline aggregation.
 */
function scanExplicitCastList(text: string): ScheduleCastMember[] {
  // Section to scan: from start until just before the first
  // "Shoot Day #1" marker (so we never scoop up day-block text).
  const firstDayPos = text.search(/Shoot\s+Day\s+#\d/i);
  const head = firstDayPos > 0 ? text.slice(0, firstDayPos) : text.slice(0, 5000);

  // If there's an explicit "Cast List" / "Cast Members" header
  // followed by entries, narrow to that block. Otherwise scan the
  // whole head section.
  const headerRe = /\b(?:CAST\s+LIST|CAST\s+MEMBERS?|CAST(?!\s+\d))\s*[:\n]/i;
  const headerMatch = head.match(headerRe);
  const block = headerMatch
    ? head.slice(headerMatch.index! + headerMatch[0].length)
    : head;

  // A cast row is one of:
  //   "1.  BRY <leader> <actor>"
  //   "1   BRY"
  //   "1)  BRY"
  // The name is the first ALL-CAPS-y word group; an optional
  // performer name in title case may follow but we only take the
  // character.
  const rowRe = /(?:^|\n)\s*(\d{1,3})\s*[.)\]]?\s+([A-Z][A-Z'\-/.&\s]{1,40}?)(?=\s{2,}|\t|\.{2,}|\n|$)/g;

  const out: ScheduleCastMember[] = [];
  const seen = new Set<number>();
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(block)) !== null) {
    const num = parseInt(m[1], 10);
    if (!Number.isFinite(num) || num < 1 || num > 999) continue;
    if (seen.has(num)) continue;

    let name = m[2].trim().replace(/\s+/g, ' ').replace(/[.,;:]+$/, '').trim();
    if (name.length < 2 || name.length > 60) continue;
    // Filter common false positives — column headers, addresses,
    // page numbers, day titles, schedule metadata.
    if (/^(INT|EXT|DAY|NIGHT|MORNING|HOURS|PAGE|SCENE|SHOOT|TOTAL|UNIT|SET|END|TIME|CALL|LOC|BACKGROUND|SOUND|NOTES|MEMBERS|ADDITIONAL|LABOUR|STUNT|VEHICLES|MAKEUP|HAIR|COSTUME|VISUAL|EFFECTS|SPECIAL|EQUIPMENT|SCN|TUE|WED|THU|FRI|SAT|SUN|MON|JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|SCHEDULE)/i.test(name)) continue;

    seen.add(num);
    out.push({ number: num, name: name.toUpperCase() });
  }
  return out;
}

/**
 * Pass 2 — Aggregate every "N. NAME" hit across the full text.
 * Full-Fat schedules embed cast members under each scene block,
 * so we count occurrences and pick the most-common variant per
 * number (so "5. HARPER / JESSICA" beats a stray "5. HARPER").
 */
function aggregateInlineCastRows(text: string): ScheduleCastMember[] {
  const occurrences = new Map<number, Map<string, number>>();

  for (const line of text.split('\n')) {
    const m = line.match(CAST_ROW_RE);
    if (!m) continue;
    if (m[1].startsWith('_')) continue; // stunt double
    const num = parseInt(m[1], 10);
    if (!Number.isFinite(num) || num <= 0 || num > 999) continue;
    let name = m[2].trim().replace(/\s+/g, ' ').replace(/[.,;:]+$/, '').trim();
    if (name.length < 2 || name.length > 60) continue;
    if (/^(INT|EXT|DAY|NIGHT|MORNING|HOURS|PAGE|SCENE|EST|TIME|CALL|UNIT|SET|LOC|END|TOTAL|SHOOT|MEMBERS|ADDITIONAL|LABOUR|STUNT|VEHICLES|MAKEUP|HAIR|COSTUME|VISUAL|EFFECTS|SPECIAL|EQUIPMENT|BACKGROUND|SOUND|NOTES|SCN)/i.test(name)) continue;
    if (/^\d/.test(name)) continue;
    name = name.toUpperCase();

    if (!occurrences.has(num)) occurrences.set(num, new Map());
    const variants = occurrences.get(num)!;
    variants.set(name, (variants.get(name) || 0) + 1);
  }

  const out: ScheduleCastMember[] = [];
  for (const num of Array.from(occurrences.keys()).sort((a, b) => a - b)) {
    const variants = occurrences.get(num)!;
    let bestName = '';
    let bestCount = -1;
    for (const [name, count] of variants) {
      if (count > bestCount || (count === bestCount && name.length > bestName.length)) {
        bestName = name;
        bestCount = count;
      }
    }
    out.push({ number: num, name: bestName });
  }
  return out;
}

// Kept for API compatibility — no longer used directly.
function scanLegacyCastList(_text: string): ScheduleCastMember[] {
  return [];
}
void scanLegacyCastList;

/* ━━━ Metadata ━━━ */

function extractMetadata(text: string): { productionName?: string; scriptVersion?: string; scheduleVersion?: string } {
  const firstPage = text.slice(0, 2000);

  // Production name: the first line of the title block is usually
  // " 'Killa Bee' Full Fat Schedule" — quoted name OR all-caps word.
  let productionName: string | undefined;
  const quoted = firstPage.match(/['"]([^'"]+?)['"]\s+(?:Full\s+Fat|One-?\s*line|One\s+line|Schedule|Shooting)/i);
  if (quoted) productionName = quoted[1].trim();
  if (!productionName) {
    const allCapsLine = firstPage.match(/^\s*([A-Z][A-Z\s\-']{2,40})\s*$/m);
    if (allCapsLine) productionName = allCapsLine[1].trim();
  }

  // Schedule version e.g. "Schedule 5A (PPM)" or "Version 5A"
  const sched = firstPage.match(/Schedule\s+([A-Za-z0-9]+(?:\s*\([^)]+\))?)/i)
              || firstPage.match(/Version\s+([A-Za-z0-9.]+)/i);
  const scheduleVersion = sched ? sched[1].trim() : undefined;

  // Script colour/draft is rarely on a schedule — leave undefined.
  return { productionName, scriptVersion: undefined, scheduleVersion };
}

/* ━━━ Helpers ━━━ */

function parseCastNumberList(input: string): number[] {
  return input
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !t.startsWith('_'))
    .map((t) => parseInt(t.replace(/[^\d]/g, ''), 10))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 999);
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function normalizeDayNight(raw: string): string {
  const upper = raw.toUpperCase().replace(/\s+/g, ' ');
  // Truncated PDF columns sometimes cut "MORNING"→"MORNI" or
  // "EVENING"→"EVENIN". Normalize for display.
  if (upper === 'MORNI') return 'MORNING';
  if (upper === 'EVENIN') return 'EVENING';
  if (upper === 'CONT') return 'CONTINUOUS';
  return upper;
}

function formatTime(hhmm: string): string {
  if (hhmm.length !== 4) return hhmm;
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2)}`;
}

const MONTH_TO_NUM: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/**
 * Convert "18 May, 2026" → "2026-05-18". Returns the original
 * string when parsing fails so the day still shows up in the list
 * even if the date can't be normalized.
 */
function toIsoDate(input: string): string {
  const m = input.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (!m) return input;
  const day = m[1].padStart(2, '0');
  const month = MONTH_TO_NUM[m[2].slice(0, 3).toLowerCase()];
  const year = m[3];
  if (!month) return input;
  return `${year}-${month}-${day}`;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PRODUCTION-SCHEDULE LAYOUT  (e.g. The Punishing)

   Pure regex / state machine for schedules built by the
   "production schedule" stationery many UK productions use:

     CAST MEMBERS
     1.PETER       11.JONAS       21.HULDUFOLK
     2.GWEN        12.EMIKO       22.GWEN STANDIN
     ...

     WEEK 1
     DAY 1 - Farmhouse
     HOURS: 0600 - 1600 --- (CWD)
     SR: 0827 / SS: 1554
     Load in / Set up - 2:00
     1/8 pgs   Scenes:   EXT   FARMHOUSE - DRIVEWAY   Est. Time
     4A
     Day       TAXI passes the road to the Farmhouse  :30
     ...
     End of Shooting Day 1 -- Monday, 24 November 2025 -- 4 5/8 Pages -- Time Estimate: 7:30

   Each scene is a "block" — the marker line ("<X> pgs Scenes:")
   plus the next 2-3 lines that pdf.js scatters across separate
   rows because they sit at slightly different baselines. We slice
   between consecutive markers and field-extract from the joined
   block instead of trying to bind precise line shapes.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const PROD_DAY_HEADER_RE = /^DAY\s+(\d+)(?:\s*[-–]\s*(.+))?$/i;
const PROD_DAY_END_RE = /End\s+of\s+Shooting\s+Day\s+(\d+)\s*[-–]+\s*([A-Za-z]+),?\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})\s*[-–]+\s*([\d\s\/]+)\s*Pages/i;
const PROD_SCENE_MARKER_RE = /^(?:\d+\s+)?(\d+(?:\s+\d+\/\d+)?|\d+\/\d+|\d+)\s*pgs?\b.*\bScenes:/i;
const PROD_HOURS_RE = /HOURS:\s*(\d{4})\s*-\s*(\d{4})/i;
const PROD_CAST_LIST_RE = /\b(\d{1,3})\.\s*([A-Z][A-Z'\-/.\s]{1,40}?)(?=\t|\n|\r|$|\s{2,})/g;

function extractDaysProductionSchedule(rawText: string): ScheduleDay[] {
  const days: ScheduleDay[] = [];
  const lines = rawText.split('\n');

  let currentDay: ScheduleDay | null = null;
  let pendingHours: string | null = null;
  let shootOrder = 0;
  // Indices of every "<X> pgs Scenes:" marker line so we can carve
  // each scene into a contiguous block.
  const sceneMarkers: { idx: number; dayIdx: number }[] = [];

  // Pass 1: locate day boundaries + scene markers.
  type Boundary =
    | { kind: 'day-start'; idx: number; dayNumber: number; location: string }
    | { kind: 'day-end'; idx: number; dayNumber: number; weekday: string; date: string; totalPages: string }
    | { kind: 'hours'; idx: number; hours: string }
    | { kind: 'scene-marker'; idx: number };
  const boundaries: Boundary[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].replace(/\s+/g, ' ').trim();

    const dh = trimmed.match(PROD_DAY_HEADER_RE);
    if (dh) {
      boundaries.push({ kind: 'day-start', idx: i, dayNumber: parseInt(dh[1], 10), location: (dh[2] || '').trim() });
      continue;
    }
    const de = trimmed.match(PROD_DAY_END_RE);
    if (de) {
      boundaries.push({ kind: 'day-end', idx: i, dayNumber: parseInt(de[1], 10), weekday: de[2], date: de[3].trim(), totalPages: de[4].trim() });
      continue;
    }
    const hr = trimmed.match(PROD_HOURS_RE);
    if (hr) {
      boundaries.push({ kind: 'hours', idx: i, hours: `${formatTime(hr[1])}–${formatTime(hr[2])}` });
      continue;
    }
    if (PROD_SCENE_MARKER_RE.test(trimmed)) {
      boundaries.push({ kind: 'scene-marker', idx: i });
    }
  }

  // Pass 2: walk the boundaries in order, opening / closing days
  // and folding each scene marker into the active day.
  for (let bi = 0; bi < boundaries.length; bi++) {
    const b = boundaries[bi];
    if (b.kind === 'day-start') {
      currentDay = {
        dayNumber: b.dayNumber,
        location: b.location,
        hours: pendingHours || undefined,
        scenes: [],
      };
      days.push(currentDay);
      shootOrder = 0;
      pendingHours = null;
      continue;
    }
    if (b.kind === 'day-end') {
      if (currentDay) {
        currentDay.dayOfWeek = b.weekday;
        currentDay.date = toIsoDate(b.date);
        currentDay.totalPages = b.totalPages;
      }
      currentDay = null;
      continue;
    }
    if (b.kind === 'hours') {
      if (currentDay) currentDay.hours = b.hours;
      else pendingHours = b.hours;
      continue;
    }
    if (b.kind === 'scene-marker' && currentDay) {
      // The block runs from this marker until the next marker /
      // boundary / day-end.
      const startIdx = b.idx;
      const next = boundaries[bi + 1];
      const endIdx = next ? next.idx : Math.min(startIdx + 6, lines.length);
      const blockLines = lines.slice(startIdx, endIdx);
      shootOrder++;
      const scene = parseProductionSceneBlock(blockLines, shootOrder);
      if (scene) currentDay.scenes.push(scene);
      sceneMarkers.push({ idx: startIdx, dayIdx: days.length - 1 });
    }
  }

  return days;
}

/**
 * Field-extract a single scene from a 2–6 line block. Each cell
 * in the source PDF row gets emitted as a separate column by
 * pdf.js — we keep the tab boundaries intact, classify each cell
 * by content pattern, and assemble the scene from those classified
 * cells. This is robust to the half-dozen layout permutations the
 * format uses (cast inline vs. on next line, location floating,
 * day/night before vs. after description, etc.).
 */
function parseProductionSceneBlock(blockLines: string[], shootOrder: number): ScheduleSceneEntry | null {
  // Drop empty lines + gutter notes (LOAD, MOVE, LUNCH, page
  // markers) but keep the original tab structure on each kept line.
  const usable = blockLines
    .map((l) => l.replace(/\r/g, '').trimEnd())
    .filter((l) => l.trim().length > 0)
    .filter((l) => !/^(Pack\s+down|Lighting\s+Change|Set\s+Move|Load\s+(in|out)|UNIT\s+MOVE|LUNCH|End\s+of\s+Shooting|===\s+PAGE)/i.test(l.trim()));
  if (usable.length === 0) return null;

  // Marker line — first usable line.
  const markerCells = usable[0].split(/\t+/).map((s) => s.trim()).filter(Boolean);
  const pagesMatch = markerCells[0]?.match(/^(\d+(?:\s+\d+\/\d+)?|\d+\/\d+|\d+)\s*pgs?$/i);
  if (!pagesMatch) return null;
  const pages = pagesMatch[1].trim();

  // Scan marker cells for INT/EXT, location, cast.
  let intExt: 'INT' | 'EXT' | null = null;
  let location = '';
  const castNumbers: number[] = [];
  for (let ci = 1; ci < markerCells.length; ci++) {
    const cell = markerCells[ci];
    if (/^Scenes:$/i.test(cell)) continue;
    if (/^Est\.?\s*Time$/i.test(cell)) continue;
    if (/^(INT|EXT|I\/E|INT\/EXT|EXT\/INT)$/i.test(cell)) {
      intExt = cell.toUpperCase().startsWith('EXT') ? 'EXT' : 'INT';
      continue;
    }
    if (/^(_?\d{1,3}[A-Za-z]?\s*,\s*)+_?\d{1,3}[A-Za-z]?$/.test(cell) || /^_?\d{1,3}[A-Za-z]?$/.test(cell)) {
      // Pure cast-number cell (single number or comma list).
      castNumbers.push(...parseCastNumberList(cell));
      continue;
    }
    // Anything else with letters → location text.
    if (/[A-Z]/.test(cell)) {
      location = location ? `${location} ${cell}` : cell;
    }
  }

  // Subsequent lines — fill in whatever the marker line missed.
  // Scene number is a line that's just <digits>[<letter>?]. Day/
  // Night + description live together on a "Day  ...  :30" line.
  let sceneNumber = '';
  let dayNight = '';
  let description = '';
  let estimatedTime: string | undefined;

  for (let li = 1; li < usable.length; li++) {
    const cells = usable[li].split(/\t+/).map((s) => s.trim()).filter(Boolean);

    for (const cell of cells) {
      // INT/EXT / location continuation
      if (!intExt && /^(INT|EXT|I\/E|INT\/EXT|EXT\/INT)$/i.test(cell)) {
        intExt = cell.toUpperCase().startsWith('EXT') ? 'EXT' : 'INT';
        continue;
      }
      // Standalone scene-number cell
      if (!sceneNumber && /^\d+[A-Za-z]?$/.test(cell)) {
        sceneNumber = cell;
        continue;
      }
      // Day / Night / Morning / Evening — sometimes alone, sometimes
      // glued to the description (e.g. "MorningGWEN sneaks out").
      const dnAlone = cell.match(/^(Day|Night|Morning|Evening|Dawn|Dusk)$/i);
      if (dnAlone && !dayNight) {
        dayNight = dnAlone[1];
        continue;
      }
      const dnPrefix = cell.match(/^(Day|Night|Morning|Evening|Dawn|Dusk)\s*(.*)$/i);
      if (dnPrefix) {
        if (!dayNight) dayNight = dnPrefix[1];
        const rest = dnPrefix[2].trim();
        if (rest && rest.length > description.length) description = rest;
        continue;
      }
      // "Morning" glued without separator, e.g. "MorningGWEN sneaks…"
      const dnGlued = cell.match(/^(Day|Night|Morning|Evening|Dawn|Dusk)([A-Z].*)$/);
      if (dnGlued) {
        if (!dayNight) dayNight = dnGlued[1];
        const rest = dnGlued[2].trim();
        if (rest && rest.length > description.length) description = rest;
        continue;
      }
      // Estimated-time cell (":30" or "1:00") — store but don't
      // include in description.
      if (/^(\d{1,2}:\d{2}|:\d{2})$/.test(cell)) {
        estimatedTime = cell;
        continue;
      }
      // Single-cell cast-number list (when the marker line was
      // location-only and this row carries cast).
      if (/^(_?\d{1,3}[A-Za-z]?\s*,\s*)+_?\d{1,3}[A-Za-z]?$/.test(cell)) {
        castNumbers.push(...parseCastNumberList(cell));
        continue;
      }
      // Standalone location continuation.
      if (!location && /^[A-Z][A-Z\s\-,/']{2,}$/.test(cell)) {
        location = cell;
        continue;
      }
      // Anything else with words → description fragment.
      if (/[a-z]/.test(cell) && cell.length > 3 && cell.length > description.length) {
        description = cell;
      }
    }
  }

  if (!intExt) return null;
  if (!sceneNumber) return null;

  return {
    sceneNumber,
    intExt,
    dayNight: normalizeDayNight(dayNight || 'Day'),
    setLocation: location,
    description: description || undefined,
    pages,
    castNumbers: Array.from(new Set(castNumbers)),
    estimatedTime,
    shootOrder,
  };
}

/**
 * Production-schedule cast list lives on the very first page,
 * formatted as "1.PETER\t11.JONAS\t21.HULDUFOLK" columns. The
 * generic explicit-roster scanner usually catches it but the
 * "no space after the dot" form trips up some patterns; this
 * helper handles it specifically.
 */
function scanProductionCastList(text: string): ScheduleCastMember[] {
  const out: ScheduleCastMember[] = [];
  const seen = new Set<number>();
  // Look at everything before the first "DAY 1" or "WEEK 1" marker.
  const headerEnd = text.search(/\b(DAY\s+1|WEEK\s+1)\b/);
  const head = headerEnd > 0 ? text.slice(0, headerEnd) : text.slice(0, 5000);
  for (const m of head.matchAll(PROD_CAST_LIST_RE)) {
    const num = parseInt(m[1], 10);
    if (!Number.isFinite(num) || num < 1 || num > 999) continue;
    if (seen.has(num)) continue;
    let name = m[2].trim().replace(/\s+/g, ' ').replace(/[.,;:]+$/, '').trim();
    if (name.length < 2 || name.length > 60) continue;
    if (/^(CAST|MEMBERS|HOURS|HOURS:|WEEK|DAY|EXT|INT|EST|TIME|MORNI|MEMBERS|END|WEEK|TOTAL)/i.test(name)) continue;
    seen.add(num);
    out.push({ number: num, name: name.toUpperCase() });
  }
  return out;
}
