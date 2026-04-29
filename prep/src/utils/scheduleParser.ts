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

// Scene data line: "<num>  <description>  <storyDay code> <pages>  [<castNums> AVs | <address>]"
// Story day codes seen in the wild: D10, N29, FB1..FB4, DUSK1, DAWN1, FB3
const SCENE_DATA_RE =
  /^[\s\t]*(\d+(?:[A-Za-z]{1,3})?)\s+(.+?)\s+([DNFP][A-Z]?\d+(?:[A-Za-z]{0,3})?|FB\d+|DAWN\d*|DUSK\d*)\s+(\d+(?:\s+\d+\/\d+)?|\d+\/\d+|\d+)(?:\s+(.*))?$/;

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
      const date = dayHeader[3];
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

    // Scene data line (the line right after the SCN header)
    if (pendingScene && !pendingScene.sceneNumber) {
      const data = rawLine.match(SCENE_DATA_RE);
      if (data) {
        pendingScene.sceneNumber = data[1];
        pendingScene.description = data[2].trim();
        pendingScene.storyDay = data[3].trim();
        pendingScene.pages = data[4].trim();
        // Trailing bit (data[5]) is one of:
        //   - One-line:  "1, 2, 5, 6 AVs"  or  "1, 2, _5A, _6A AVs"
        //   - One-line wrap-corrupted: "st 2, 5 AVs"  (description
        //     truncation bled "stairs." into the cast column)
        //   - Full-fat:  street address like "58 Bassett Crescent…"
        // Strategy: only treat the trailing as cast numbers if it
        // contains "AVs" (the one-line column terminator). Strip
        // anything before the first digit, then parse number tokens.
        const trailing = data[5]?.trim();
        if (trailing && /\bAVs\b/i.test(trailing)) {
          // Cut everything before the first digit (drops noise like
          // "st" left over from a truncated description column).
          const firstDigit = trailing.search(/\d/);
          if (firstDigit >= 0) {
            const castSection = trailing.slice(firstDigit).split(/\bAVs\b/i)[0];
            pendingScene.castNumbers.push(...parseCastNumberList(castSection));
          }
        }
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
 * Build the cast number → name map by aggregating every "N. NAME"
 * row across the whole schedule. Full-Fat layouts spell out the
 * names inline; One-line layouts only show numbers, but they're
 * usually accompanied by a Full-Fat companion in the same release.
 *
 * We also keep counts so the most-common form of a name wins (some
 * scenes show "5. HARPER", others "5. HARPER / JESSICA" — pick the
 * longer / more common variant).
 */
function buildCastList(text: string, days: ScheduleDay[]): ScheduleCastMember[] {
  const occurrences = new Map<number, Map<string, number>>();

  // Pass 1: scan every "N. NAME" pattern in the raw text. CAST_ROW_RE
  // matches a line that's just a number followed by a name, which
  // catches the Full-Fat blocks reliably.
  for (const line of text.split('\n')) {
    const m = line.match(CAST_ROW_RE);
    if (!m) continue;
    if (m[1].startsWith('_')) continue; // stunt double, skip
    const num = parseInt(m[1], 10);
    if (!Number.isFinite(num) || num <= 0 || num > 999) continue;
    let name = m[2].trim().replace(/\s+/g, ' ').replace(/[.,;:]+$/, '').trim();
    // Filter false positives
    if (name.length < 2 || name.length > 60) continue;
    if (/^(INT|EXT|DAY|NIGHT|MORNING|HOURS|PAGE|SCENE|EST|TIME|CALL|UNIT|SET|LOC|END|TOTAL|SHOOT|MEMBERS|ADDITIONAL|LABOUR|STUNT|VEHICLES|MAKEUP|HAIR|COSTUME|VISUAL|EFFECTS|SPECIAL|EQUIPMENT|BACKGROUND|SOUND|NOTES|SCN)/i.test(name)) continue;
    if (/^\d/.test(name)) continue;
    name = name.toUpperCase();

    if (!occurrences.has(num)) occurrences.set(num, new Map());
    const variants = occurrences.get(num)!;
    variants.set(name, (variants.get(name) || 0) + 1);
  }

  const list: ScheduleCastMember[] = [];
  // Sort numerically by cast number
  const numbers = Array.from(occurrences.keys()).sort((a, b) => a - b);
  for (const num of numbers) {
    const variants = occurrences.get(num)!;
    // Pick the most-frequent variant; tiebreak on length (longer wins).
    let bestName = '';
    let bestCount = -1;
    for (const [name, count] of variants) {
      if (count > bestCount || (count === bestCount && name.length > bestName.length)) {
        bestName = name;
        bestCount = count;
      }
    }
    list.push({ number: num, name: bestName });
  }

  // Fallback: if Pass 1 found nothing, try a generic header-section
  // scan (covers schedules with a dedicated cast-list page).
  if (list.length === 0) {
    return scanLegacyCastList(text);
  }

  // Backfill: ensure every cast number referenced in any scene
  // appears in the list, even if we never resolved a name.
  const referenced = new Set<number>();
  for (const day of days) {
    for (const scene of day.scenes) {
      for (const n of scene.castNumbers) referenced.add(n);
    }
  }
  for (const n of referenced) {
    if (!list.find((c) => c.number === n)) {
      list.push({ number: n, name: `Cast ${n}` });
    }
  }
  list.sort((a, b) => a.number - b.number);
  return list;
}

function scanLegacyCastList(text: string): ScheduleCastMember[] {
  const out: ScheduleCastMember[] = [];
  const head = text.slice(0, 15000);
  const m = head.match(/(?:CAST\s*LIST|CAST\s*MEMBERS?|CAST|CHARACTERS?)[:\s]*\n([\s\S]*?)(?=\n\s*\n\s*\n|=== PAGE|END\s*OF|SHOOTING\s*DAY|\nDAY\b|Shoot\s+Day)/i);
  if (!m) return out;
  const block = m[1];
  const re = /(\d{1,3})\s*[.\-)\]:]\s*([A-Z][A-Za-z'\-.\s]{1,30})/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(block)) !== null) {
    const num = parseInt(mm[1], 10);
    if (!Number.isFinite(num) || num < 1 || num > 999) continue;
    const name = mm[2].trim().replace(/\s+/g, ' ').toUpperCase();
    if (out.find((c) => c.number === num)) continue;
    out.push({ number: num, name });
  }
  out.sort((a, b) => a.number - b.number);
  return out;
}

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
