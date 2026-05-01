// Worker setup centralised in @/utils/pdfjs.
import { pdfjsLib } from '@/utils/pdfjs';
import type {
  ProductionSchedule,
  ScheduleCastMember,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// STAGE 1: INSTANT PARSE (Cast List Only)
// ============================================
// Extracts: cast list, total day count, production name, and stores PDF for viewing
// ============================================

/**
 * Stage 1 Result - minimal data for immediate use
 */
export interface Stage1Result {
  schedule: ProductionSchedule;
  rawText: string;
  dayTextBlocks: string[]; // Kept for backwards compatibility
}

/**
 * STAGE 1: Fast instant parse - extracts cast list, day count, production name
 * Stores the PDF as data URI for viewing in the app
 */
export async function parseScheduleStage1(file: File): Promise<Stage1Result> {
  console.time('scheduleParser:stage1');

  // Store PDF as data URI for later viewing
  const pdfUri = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

  // Extract text from PDF for cast list parsing
  const text = await extractTextFromPDF(file);

  // Fast extraction of cast list (regex-based)
  const castList = extractCastListFast(text);

  // Count total shooting days from "End of Shooting Day X" markers
  const { totalDays, dayTextBlocks } = extractDayCountAndBlocks(text);

  // Extract production metadata
  const metadata = extractMetadata(text);

  const schedule: ProductionSchedule = {
    id: uuidv4(),
    productionName: metadata.productionName,
    scriptVersion: metadata.scriptVersion,
    scheduleVersion: metadata.scheduleVersion,
    status: 'pending', // Pending until Stage 2 processes scene breakdown
    processingProgress: { current: 0, total: totalDays },
    castList,
    days: [], // Empty - scene parsing removed
    totalDays,
    uploadedAt: new Date(),
    pdfUri,
    rawText: text,
  };

  console.timeEnd('scheduleParser:stage1');

  return { schedule, rawText: text, dayTextBlocks };
}

/**
 * Extract total day count and text blocks for each day
 */
function extractDayCountAndBlocks(text: string): { totalDays: number; dayTextBlocks: string[] } {
  const dayTextBlocks: string[] = [];

  // Find all "End of Shooting Day X" markers
  const endOfDayPattern = /End of Shooting Day\s+(\d+)/gi;
  const dayMarkers: { dayNum: number; endPos: number }[] = [];

  let match;
  while ((match = endOfDayPattern.exec(text)) !== null) {
    const dayNum = parseInt(match[1], 10);
    if (!dayMarkers.find(d => d.dayNum === dayNum)) {
      dayMarkers.push({ dayNum, endPos: match.index + match[0].length });
    }
  }

  // Sort by position in text
  dayMarkers.sort((a, b) => a.endPos - b.endPos);

  // Extract text blocks for each day
  let totalDays = 0;
  for (let i = 0; i < dayMarkers.length; i++) {
    const marker = dayMarkers[i];
    const prevEndPos = i > 0 ? dayMarkers[i - 1].endPos : 0;
    const dayText = text.slice(prevEndPos, marker.endPos + 200);
    dayTextBlocks.push(dayText);
    totalDays = Math.max(totalDays, marker.dayNum);
  }

  // If no markers found, try to detect days from "Day X" headers
  if (dayMarkers.length === 0) {
    const dayHeaderPattern = /(?:^|\n)(?:Shooting\s+)?Day\s+(\d+)/gi;
    while ((match = dayHeaderPattern.exec(text)) !== null) {
      const dayNum = parseInt(match[1], 10);
      totalDays = Math.max(totalDays, dayNum);
    }
  }

  return { totalDays, dayTextBlocks };
}

/**
 * Extract text content from a PDF file with tabular structure preservation
 * Groups text items by Y position to reconstruct rows properly
 */
async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Group text items by Y position (row-by-row reconstruction)
    const rows: Map<number, Array<{ x: number; text: string; width: number }>> = new Map();

    for (const item of textContent.items as Array<{ str: string; transform: number[]; width: number }>) {
      if (!item.str || item.str.trim() === '') continue;

      // Round Y position to group items on the same row (allow 3px tolerance)
      const y = Math.round(item.transform[5] / 3) * 3;
      const x = item.transform[4];

      if (!rows.has(y)) {
        rows.set(y, []);
      }
      rows.get(y)!.push({ x, text: item.str, width: item.width || 0 });
    }

    // Sort rows by Y position (top to bottom, so descending Y)
    const sortedYPositions = Array.from(rows.keys()).sort((a, b) => b - a);

    for (const y of sortedYPositions) {
      const rowItems = rows.get(y)!;
      // Sort items within row by X position (left to right)
      rowItems.sort((a, b) => a.x - b.x);

      // Reconstruct row with tab-separated columns
      let rowText = '';
      let lastX = 0;
      let lastWidth = 0;

      for (const item of rowItems) {
        // Calculate gap between items
        const gap = item.x - (lastX + lastWidth);

        // Add separator for significant gaps (indicates column separation)
        if (lastX > 0 && gap > 15) {
          rowText += '\t'; // Tab for column separation
        } else if (lastX > 0 && gap > 3) {
          rowText += ' ';
        }

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

/**
 * Fast extraction of cast list from schedule text using multiple patterns
 * Handles various schedule formats: Movie Magic, Gorilla, EP Scheduling, etc.
 */
function extractCastListFast(text: string): ScheduleCastMember[] {
  const castList: ScheduleCastMember[] = [];
  // Cast list is usually on the first 1-2 pages — extend search area for longer headers
  const castSection = text.slice(0, 15000);

  // Strategy 1: Find a dedicated cast section by header
  // Look for common section headers: "CAST", "CAST LIST", "CAST MEMBERS", "CHARACTER", "CHARACTERS", "CAST:"
  const castHeaderPatterns = [
    /(?:CAST\s*LIST|CAST\s*MEMBERS?|CAST|CHARACTERS?)[:\s]*\n([\s\S]*?)(?=\n\s*\n\s*\n|SHOOTING\s*DAY|END\s*OF|DAY\s+\d|=== PAGE)/i,
    /(?:CAST\s*LIST|CAST\s*MEMBERS?|CAST|CHARACTERS?)[:\s]*\n([\s\S]*?)(?=\n[A-Z]{3,}\s*\n|\nSCENE|\nDAY\b)/i,
  ];

  for (const headerPattern of castHeaderPatterns) {
    const castSectionMatch = castSection.match(headerPattern);
    if (castSectionMatch) {
      const castBlock = castSectionMatch[1];
      // Within a found cast section, be generous with matching: number followed by name
      const castLinePattern = /(\d{1,3})\s*[.\-)\]:]?\s*([A-Z][A-Za-z'\-.\s]{1,30})/g;
      let match;
      while ((match = castLinePattern.exec(castBlock)) !== null) {
        addCastMember(castList, match[1], match[2]);
      }
      // If we found characters in a clear cast section, trust it
      if (castList.length >= 2) break;
    }
  }

  // Strategy 2: Pattern-based extraction across the whole cast section area
  // These run regardless but addCastMember deduplicates by number

  // "1.MARGOT" or "1. MARGOT" or "1- MARGOT" or "1) MARGOT"
  const pattern1 = /(?:^|\n|\t)\s*(\d{1,3})\s*[.\-)\]:]\s*([A-Z][A-Za-z'\-.\s]{1,30}?)(?=\s*\n|\s*\t|\s{3,})/gm;
  let match;
  while ((match = pattern1.exec(castSection)) !== null) {
    addCastMember(castList, match[1], match[2]);
  }

  // Tabular format: "1\tMARGOT SMITH" or with multiple spaces/tabs between number and name
  const pattern2 = /(?:^|\n)\s*(\d{1,3})[\t\s]{2,}([A-Z][A-Za-z'\-.\s]{1,30}?)(?=\s*[\t\n]|\s{3,}|$)/gm;
  while ((match = pattern2.exec(castSection)) !== null) {
    addCastMember(castList, match[1], match[2]);
  }

  // Parenthesized numbers: "(1) MARGOT" — some schedules use this format
  const pattern3 = /\((\d{1,3})\)\s*([A-Z][A-Za-z'\-.\s]{1,30}?)(?=\s*\n|\s*\t|\s{3,})/gm;
  while ((match = pattern3.exec(castSection)) !== null) {
    addCastMember(castList, match[1], match[2]);
  }

  // Strategy 3: Look for cast numbers embedded in scene strips
  // Schedules often list cast as "Cast: 1,2,4,7" or "1. 2. 4. 7." in scene entries
  // If we found no cast from headers, try to build the cast list from scene references
  if (castList.length < 3) {
    // Look for lines where a number is followed by a name that appears multiple times in the text
    const candidatePattern = /(?:^|\n|\t)\s*(\d{1,2})\s*[.\-)\]:]\s*([A-Z][A-Za-z'\-.\s]{2,25})/gm;
    const candidates: Array<{ num: string; name: string; count: number }> = [];

    while ((match = candidatePattern.exec(text.slice(0, 20000))) !== null) {
      const name = match[2].trim();
      // Count how many times this name appears in the full text (indicates it's a real character)
      const nameRegex = new RegExp(`\\b${escapeRegExpSchedule(name.split(' ')[0])}\\b`, 'gi');
      const occurrences = (text.match(nameRegex) || []).length;
      if (occurrences >= 2) {
        candidates.push({ num: match[1], name, count: occurrences });
      }
    }

    // Sort by frequency and add the most likely cast members
    candidates.sort((a, b) => b.count - a.count);
    for (const candidate of candidates) {
      addCastMember(castList, candidate.num, candidate.name);
    }
  }

  // Sort by number
  castList.sort((a, b) => a.number - b.number);


  return castList;
}

/**
 * Escape special regex characters in a string (for schedule parser)
 */
function escapeRegExpSchedule(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Helper to add a cast member with validation
 */
function addCastMember(castList: ScheduleCastMember[], numStr: string, nameStr: string): void {
  const num = parseInt(numStr, 10);
  // Clean up: trim, collapse whitespace, remove trailing punctuation
  let name = nameStr.trim().replace(/\s+/g, ' ').replace(/[.,;:]+$/, '').trim();

  // Validate
  if (num <= 0 || num > 200) return;
  if (name.length < 2 || name.length > 30) return;

  // Skip if it looks like a location, time, scene marker, or schedule metadata
  if (/^(INT|EXT|DAY|NIGHT|MORNING|HOURS|PAGE|SCENE|EST|TIME|CALL|UNIT|SET|LOC|END|TOTAL|SHOOT)/i.test(name)) return;

  // Skip if name is all numbers or looks like a date/time
  if (/^\d+$/.test(name) || /^\d{1,2}[:/]\d{2}/.test(name)) return;

  // Skip if already exists (by number)
  if (castList.find(c => c.number === num)) return;

  // Normalize to uppercase for consistency
  name = name.toUpperCase();

  castList.push({ number: num, name });
}

/**
 * Extract production metadata from text
 */
function extractMetadata(text: string): { productionName?: string; scriptVersion?: string; scheduleVersion?: string } {
  const firstPage = text.slice(0, 2000);

  // Try to find production name (often in caps at the top)
  const prodMatch = firstPage.match(/^[A-Z][A-Z\s\-']+(?=\s*\n)/m);

  // Try to find script version
  const scriptMatch = firstPage.match(/(?:Script|Draft)[:\s]*([A-Za-z]+\s*\d*)/i);

  // Try to find schedule version/date
  const scheduleMatch = firstPage.match(/(?:Schedule|Version)[:\s]*([A-Za-z0-9\s\-\/]+)/i);

  return {
    productionName: prodMatch ? prodMatch[0].trim() : undefined,
    scriptVersion: scriptMatch ? scriptMatch[1].trim() : undefined,
    scheduleVersion: scheduleMatch ? scheduleMatch[1].trim() : undefined,
  };
}

/**
 * Get character name from cast list by number
 */
export function getCharacterNameByNumber(
  castList: ScheduleCastMember[],
  number: number
): string | undefined {
  const member = castList.find(c => c.number === number);
  return member?.name;
}

/**
 * Get character names for a scene from cast numbers
 */
export function getCharacterNamesForScene(
  castList: ScheduleCastMember[],
  castNumbers: number[]
): string[] {
  return castNumbers
    .map(num => getCharacterNameByNumber(castList, num))
    .filter((name): name is string => !!name);
}

// ============================================
// STAGE 2: REGEX-BASED SCENE EXTRACTION (no AI)
// ============================================
// Walks the raw text line-by-line and produces ScheduleDay[] with
// per-day scene rows + cast numbers. Mirrors the prep app's
// scheduleParser.extractDays() so both apps interpret the same
// PDF identically. Handles both the multi-line "Full Fat" layout
// and the compact "One-Line" layout, and supports the two common
// day-marker conventions:
//   - "Shoot Day #N <weekday>, <date>" / "End of Day #N"   (Movie Magic)
//   - "Shooting Day N"                  / "End of Shooting Day N"
// ============================================

import type { ScheduleDay, ScheduleSceneEntry } from '@/types';

const DAY_HEADER_RE =
  /(?:Shoot|Shooting)\s+Day\s+#?(\d+)(?:\s+([A-Za-z]+),?\s+(\d{1,2}\s+[A-Za-z]+,?\s+\d{4}))?/i;
const DAY_END_RE = /End\s+of\s+(?:Shooting\s+)?Day\s+#?(\d+)/i;
const HOURS_RE = /(\d{4})-(\d{4})\s+SCWD/i;
const LOCATION_HEADER_RE = /^[\s\t]*([A-Z][^\n]*\([A-Za-z][^)]*\))\s*$/;

const SCENE_HEADER_RE =
  /^[\s\t]*(?:Scn|SCN)\s+(INT|EXT|I\/E|INT\/EXT|EXT\/INT)\s+(.+?)\s+(DAY|NIGHT|DAWN|DUSK|EVENING|EVENIN|MORNING|MORNI|AFTERNOON|CONT|CONTINUOUS|MAGIC\s+HOUR)\b/i;

const FULL_FAT_DATA_RE =
  /^[\s\t]*(\d+(?:[A-Za-z]{1,3})?)[\s\t]+(.+?)[\s\t]+([DNFP][A-Z]?\d+(?:[A-Za-z]{0,3})?|FB\d+|DAWN\d*|DUSK\d*)\s+(\d+(?:\s+\d+\/\d+)?|\d+\/\d+|\d+)(?:[\s\t]+(.*))?$/;

const ONE_LINE_DATA_RE =
  /^[\s\t]*(\d+(?:[A-Za-z]{1,3})?)[\s]+([^\t]+?)\t+(\d.*)$/;

const STORYDAY_TAIL_RE =
  /^[\s\t]*([DNFP][A-Z]?\d+(?:[A-Za-z]{0,3})?|FB\d+|DAWN\d*|DUSK\d*)[\s\t]*AVs\b/i;

const CAST_ROW_RE = /^[\s\t]*(_?\d+[A-Za-z]?)\.\s*(.+?)\s*$/;
const CAST_INLINE_RE = /(_?\d{1,3}[A-Za-z]?)\.\s+([A-Z][A-Za-z'\-/.\s]+?)(?=\s{2,}|\t|$)/g;

const MONTH_TO_NUM: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function toIsoDate(input: string): string | undefined {
  if (!input) return undefined;
  const m = input.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (!m) return input;
  const day = m[1].padStart(2, '0');
  const month = MONTH_TO_NUM[m[2].slice(0, 3).toLowerCase()];
  if (!month) return input;
  return `${m[3]}-${month}-${day}`;
}

function formatTime(hhmm: string): string {
  return hhmm.length === 4 ? `${hhmm.slice(0, 2)}:${hhmm.slice(2)}` : hhmm;
}

function normalizeDayNight(raw: string): string {
  const upper = raw.toUpperCase().replace(/\s+/g, ' ');
  if (upper === 'MORNI') return 'MORNING';
  if (upper === 'EVENIN') return 'EVENING';
  if (upper === 'CONT') return 'CONTINUOUS';
  return upper;
}

function parseCastNumberList(input: string): number[] {
  return input
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !t.startsWith('_'))
    .map((t) => parseInt(t.replace(/[^\d]/g, ''), 10))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 999);
}

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

/**
 * Walk the schedule's raw text and produce ScheduleDay[] with
 * fully-populated scenes per day. Pure regex / state machine — no
 * network calls. Tries the Movie-Magic layout (Scn / End of Day)
 * first; falls back to the production-schedule layout (DAY N /
 * "<X> pgs Scenes:" markers) if no days are detected.
 */
export function extractDays(rawText: string): ScheduleDay[] {
  const movieMagic = extractDaysMovieMagic(rawText);
  if (movieMagic.length > 0) return movieMagic;
  return extractDaysProductionSchedule(rawText);
}

function extractDaysMovieMagic(rawText: string): ScheduleDay[] {
  const days: ScheduleDay[] = [];
  const lines = rawText.split('\n');

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
        dayNight: pendingScene.dayNight ? normalizeDayNight(pendingScene.dayNight) : 'Day',
        setLocation: pendingScene.setLocation,
        description: pendingScene.description,
        pages: pendingScene.pages,
        castNumbers: Array.from(new Set(pendingScene.castNumbers)),
        shootOrder: pendingScene.shootOrder,
      };
      // Story day — surfaced via description prefix when set so
      // mobile UIs that look for it (e.g. day filters) can still
      // see it without a schema change.
      if (pendingScene.storyDay) {
        (entry as ScheduleSceneEntry & { storyDay?: string }).storyDay = pendingScene.storyDay;
      }
      currentDay.scenes.push(entry);
    }
    pendingScene = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();

    const dayHeader = line.match(DAY_HEADER_RE);
    if (dayHeader) {
      finalizeScene();
      currentDay = {
        dayNumber: parseInt(dayHeader[1], 10),
        date: dayHeader[3] ? toIsoDate(dayHeader[3]) : undefined,
        dayOfWeek: dayHeader[2] || undefined,
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

    if (DAY_END_RE.test(line)) {
      finalizeScene();
      const totalPagesMatch = line.match(/Total\s+Pages?:?\s+(.+?)(?:\s|$)/i);
      if (currentDay && totalPagesMatch) currentDay.totalPages = totalPagesMatch[1].trim();
      currentDay = null;
      continue;
    }

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

    if (pendingScene && !pendingScene.sceneNumber) {
      const ff = rawLine.match(FULL_FAT_DATA_RE);
      if (ff) {
        pendingScene.sceneNumber = ff[1];
        pendingScene.description = ff[2].trim();
        pendingScene.storyDay = ff[3].trim();
        pendingScene.pages = ff[4].trim();
        continue;
      }
      const ol = rawLine.match(ONE_LINE_DATA_RE);
      if (ol) {
        pendingScene.sceneNumber = ol[1];
        pendingScene.description = ol[2].trim();
        const tail = ol[3];
        const pagesM = tail.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+)\s*(.*)$/);
        if (pagesM) {
          pendingScene.pages = pagesM[1].trim();
          if (pagesM[2]) pendingScene.castNumbers.push(...parseCastNumberList(pagesM[2]));
        }
        continue;
      }
    }

    if (pendingScene && pendingScene.sceneNumber && !pendingScene.storyDay) {
      const sd = rawLine.match(STORYDAY_TAIL_RE);
      if (sd) {
        pendingScene.storyDay = sd[1].trim();
        continue;
      }
    }

    if (pendingScene && CAST_ROW_RE.test(rawLine)) {
      for (const m of rawLine.matchAll(CAST_INLINE_RE)) {
        const numToken = m[1];
        if (numToken.startsWith('_')) continue;
        const num = parseInt(numToken, 10);
        if (Number.isFinite(num) && num > 0 && num < 1000) {
          pendingScene.castNumbers.push(num);
        }
      }
      continue;
    }

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

// ============================================
// PRODUCTION-SCHEDULE LAYOUT (e.g. The Punishing)
// ============================================
// "DAY N - Location" headers + "<X> pgs Scenes:" markers per scene.
// Scene cells are scattered across multiple pdf.js rows so we
// slice between consecutive markers and field-extract each block.
// ============================================

const PROD_DAY_HEADER_RE = /^DAY\s+(\d+)(?:\s*[-–]\s*(.+))?$/i;
const PROD_DAY_END_RE = /End\s+of\s+Shooting\s+Day\s+(\d+)\s*[-–]+\s*([A-Za-z]+),?\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})\s*[-–]+\s*([\d\s\/]+)\s*Pages/i;
const PROD_SCENE_MARKER_RE = /^(?:\d+\s+)?(\d+(?:\s+\d+\/\d+)?|\d+\/\d+|\d+)\s*pgs?\b.*\bScenes:/i;
const PROD_HOURS_RE = /HOURS:\s*(\d{4})\s*-\s*(\d{4})/i;

function extractDaysProductionSchedule(rawText: string): ScheduleDay[] {
  const days: ScheduleDay[] = [];
  const lines = rawText.split('\n');

  type Boundary =
    | { kind: 'day-start'; idx: number; dayNumber: number; location: string }
    | { kind: 'day-end'; idx: number; weekday: string; date: string; totalPages: string }
    | { kind: 'hours'; idx: number; hours: string }
    | { kind: 'scene-marker'; idx: number };
  const boundaries: Boundary[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].replace(/\s+/g, ' ').trim();
    let m;
    if ((m = trimmed.match(PROD_DAY_HEADER_RE))) {
      boundaries.push({ kind: 'day-start', idx: i, dayNumber: parseInt(m[1], 10), location: (m[2] || '').trim() });
      continue;
    }
    if ((m = trimmed.match(PROD_DAY_END_RE))) {
      boundaries.push({ kind: 'day-end', idx: i, weekday: m[2], date: m[3].trim(), totalPages: m[4].trim() });
      continue;
    }
    if ((m = trimmed.match(PROD_HOURS_RE))) {
      boundaries.push({ kind: 'hours', idx: i, hours: `${formatTime(m[1])}–${formatTime(m[2])}` });
      continue;
    }
    if (PROD_SCENE_MARKER_RE.test(trimmed)) {
      boundaries.push({ kind: 'scene-marker', idx: i });
    }
  }

  let currentDay: ScheduleDay | null = null;
  let pendingHours: string | null = null;
  let shootOrder = 0;

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
      const startIdx = b.idx;
      const next = boundaries[bi + 1];
      const endIdx = next ? next.idx : Math.min(startIdx + 6, lines.length);
      shootOrder++;
      const scene = parseProductionSceneBlock(lines.slice(startIdx, endIdx), shootOrder);
      if (scene) currentDay.scenes.push(scene);
    }
  }

  return days;
}

function parseProductionSceneBlock(blockLines: string[], shootOrder: number): ScheduleSceneEntry | null {
  const usable = blockLines
    .map((l) => l.replace(/\r/g, '').trimEnd())
    .filter((l) => l.trim().length > 0)
    .filter((l) => !/^(Pack\s+down|Lighting\s+Change|Set\s+Move|Load\s+(in|out)|UNIT\s+MOVE|LUNCH|End\s+of\s+Shooting|===\s+PAGE)/i.test(l.trim()));
  if (usable.length === 0) return null;

  const markerCells = usable[0].split(/\t+/).map((s) => s.trim()).filter(Boolean);
  const pagesMatch = markerCells[0]?.match(/^(\d+(?:\s+\d+\/\d+)?|\d+\/\d+|\d+)\s*pgs?$/i);
  if (!pagesMatch) return null;
  const pages = pagesMatch[1].trim();

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
      castNumbers.push(...parseCastNumberList(cell));
      continue;
    }
    if (/[A-Z]/.test(cell)) {
      location = location ? `${location} ${cell}` : cell;
    }
  }

  let sceneNumber = '';
  let dayNight = '';
  let description = '';
  let estimatedTime: string | undefined;

  for (let li = 1; li < usable.length; li++) {
    const cells = usable[li].split(/\t+/).map((s) => s.trim()).filter(Boolean);
    for (const cell of cells) {
      if (!intExt && /^(INT|EXT|I\/E|INT\/EXT|EXT\/INT)$/i.test(cell)) {
        intExt = cell.toUpperCase().startsWith('EXT') ? 'EXT' : 'INT';
        continue;
      }
      if (!sceneNumber && /^\d+[A-Za-z]?$/.test(cell)) {
        sceneNumber = cell;
        continue;
      }
      const dnAlone = cell.match(/^(Day|Night|Morning|Evening|Dawn|Dusk)$/i);
      if (dnAlone && !dayNight) { dayNight = dnAlone[1]; continue; }
      const dnPrefix = cell.match(/^(Day|Night|Morning|Evening|Dawn|Dusk)\s*(.*)$/i);
      if (dnPrefix) {
        if (!dayNight) dayNight = dnPrefix[1];
        const rest = dnPrefix[2].trim();
        if (rest && rest.length > description.length) description = rest;
        continue;
      }
      const dnGlued = cell.match(/^(Day|Night|Morning|Evening|Dawn|Dusk)([A-Z].*)$/);
      if (dnGlued) {
        if (!dayNight) dayNight = dnGlued[1];
        const rest = dnGlued[2].trim();
        if (rest && rest.length > description.length) description = rest;
        continue;
      }
      if (/^(\d{1,2}:\d{2}|:\d{2})$/.test(cell)) { estimatedTime = cell; continue; }
      if (/^(_?\d{1,3}[A-Za-z]?\s*,\s*)+_?\d{1,3}[A-Za-z]?$/.test(cell)) {
        castNumbers.push(...parseCastNumberList(cell));
        continue;
      }
      if (!location && /^[A-Z][A-Z\s\-,/']{2,}$/.test(cell)) { location = cell; continue; }
      if (/[a-z]/.test(cell) && cell.length > 3 && cell.length > description.length) description = cell;
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
