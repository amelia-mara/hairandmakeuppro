import * as pdfjsLib from 'pdfjs-dist';
import type {
  ProductionSchedule,
  ScheduleCastMember,
  ScheduleDay,
  ScheduleSceneEntry,
  ScheduleStatus,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// ============================================
// STAGE 1: INSTANT PARSE (Blocking)
// ============================================
// Extracts only: cast list, total day count, production name
// Must be fast (< 2 seconds) - no scene parsing
// ============================================

/**
 * Stage 1 Result - minimal data for immediate use
 */
export interface Stage1Result {
  schedule: ProductionSchedule;
  rawText: string;
  dayTextBlocks: string[]; // Text blocks for each day (for Stage 2)
}

/**
 * STAGE 1: Fast instant parse - extracts cast list, day count, production name
 * This runs synchronously and blocks until complete (should be < 2 seconds)
 */
export async function parseScheduleStage1(file: File): Promise<Stage1Result> {
  console.time('scheduleParser:stage1');

  // Store PDF as data URI for later viewing
  const pdfUri = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

  // Extract text from PDF with tabular structure preservation
  const text = await extractTextFromPDF(file);
  console.log('Stage 1: Extracted text length:', text.length);

  // Fast extraction of cast list (regex-based)
  const castList = extractCastListFast(text);
  console.log('Stage 1: Found', castList.length, 'cast members');

  // Count total shooting days from "End of Shooting Day X" markers
  const { totalDays, dayTextBlocks } = extractDayCountAndBlocks(text);
  console.log('Stage 1: Found', totalDays, 'shooting days');

  // Extract production metadata
  const metadata = extractMetadata(text);
  console.log('Stage 1: Production name:', metadata.productionName);

  const schedule: ProductionSchedule = {
    id: uuidv4(),
    productionName: metadata.productionName,
    scriptVersion: metadata.scriptVersion,
    scheduleVersion: metadata.scheduleVersion,
    status: 'pending', // Scenes not yet parsed
    processingProgress: { current: 0, total: totalDays },
    castList,
    days: [], // Empty - will be populated in Stage 2
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
 * Used by Stage 1 (count) and Stage 2 (blocks for AI parsing)
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

    for (const item of textContent.items as any[]) {
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
 * Parse extracted text into a structured ProductionSchedule object
 * Uses fast regex-based parsing without AI dependency
 * NOTE: This is the legacy full-parse function. For two-stage parsing,
 * use parseScheduleStage1() followed by AI-powered Stage 2.
 */
function parseScheduleText(text: string, pdfUri?: string): ProductionSchedule {
  // First, extract cast list from the beginning of the text
  const castList = extractCastListFast(text);

  // Then parse all days and their scenes
  const days = parseAllDaysFast(text);

  // Extract production metadata
  const metadata = extractMetadata(text);

  // Determine status based on what was parsed
  const totalScenes = days.reduce((sum, d) => sum + d.scenes.length, 0);
  const status: ScheduleStatus = totalScenes > 0 ? 'complete' : 'pending';

  return {
    id: uuidv4(),
    productionName: metadata.productionName,
    scriptVersion: metadata.scriptVersion,
    scheduleVersion: metadata.scheduleVersion,
    status,
    processingProgress: { current: days.length, total: days.length },
    castList,
    days,
    totalDays: days.length,
    uploadedAt: new Date(),
    pdfUri,
    rawText: text,
  };
}

/**
 * Fast extraction of cast list from schedule text using multiple patterns
 */
function extractCastListFast(text: string): ScheduleCastMember[] {
  const castList: ScheduleCastMember[] = [];
  const castSection = text.slice(0, 8000); // Cast list typically on first pages

  // Pattern 1: "1.MARGOT" or "1. MARGOT" format (common in schedules)
  const pattern1 = /\b(\d{1,2})\s*[.\-]\s*([A-Z][A-Z'\-\s]{1,25}?)(?=\s+\d{1,2}\s*[.\-]|\s*\n|\s*$)/g;

  // Pattern 2: Tabular format "1\tMARGOT" or "1 MARGOT"
  const pattern2 = /(?:^|\n|\t)(\d{1,2})\s+([A-Z][A-Z'\-]{1,25})(?:\s|$)/gm;

  // Pattern 3: Cast section header followed by numbered list
  const castSectionMatch = castSection.match(/CAST[:\s]*\n([\s\S]*?)(?=\n\s*\n|\nDAY|\nSCENE|$)/i);
  if (castSectionMatch) {
    const castBlock = castSectionMatch[1];
    const castLinePattern = /(\d{1,2})\s*[.\-]?\s*([A-Z][A-Z'\-\s]{2,25})/g;
    let match;
    while ((match = castLinePattern.exec(castBlock)) !== null) {
      addCastMember(castList, match[1], match[2]);
    }
  }

  // Try pattern 1
  let match;
  while ((match = pattern1.exec(castSection)) !== null) {
    addCastMember(castList, match[1], match[2]);
  }

  // Try pattern 2 if we need more
  if (castList.length < 5) {
    while ((match = pattern2.exec(castSection)) !== null) {
      addCastMember(castList, match[1], match[2]);
    }
  }

  // Sort by number
  castList.sort((a, b) => a.number - b.number);

  return castList;
}

/**
 * Helper to add a cast member with validation
 */
function addCastMember(castList: ScheduleCastMember[], numStr: string, nameStr: string): void {
  const num = parseInt(numStr, 10);
  const name = nameStr.trim().replace(/\s+/g, ' ');

  // Validate
  if (num <= 0 || num > 99) return;
  if (name.length < 2 || name.length > 30) return;

  // Skip if it looks like a location, time, or scene marker
  if (/^(INT|EXT|DAY|NIGHT|MORNING|HOURS|PAGE|SCENE|EST|TIME|CALL|UNIT)/i.test(name)) return;

  // Skip if already exists
  if (castList.find(c => c.number === num)) return;

  castList.push({ number: num, name });
}

/**
 * Fast parsing of all shooting days and their scenes from the schedule text
 */
function parseAllDaysFast(text: string): ScheduleDay[] {
  const days: ScheduleDay[] = [];

  // Multiple patterns for day headers
  // Pattern 1: "End of Shooting Day 1 -- Tuesday, 21 May 2024"
  const endOfDayPattern = /End of Shooting Day\s+(\d+)\s*[-–]+\s*(\w+),?\s*(\d{1,2})\s+(\w+)\s+(\d{4})/gi;

  // Pattern 2: "DAY 1 - Location" or "DAY 1" headers
  const dayHeaderPattern = /(?:^|\n)(?:Shooting\s+)?Day\s+(\d+)\s*[-–]?\s*([A-Za-z\s\-\']*?)(?:\n|$)/gi;

  // Pattern 3: Location headers like "The Crown, Framlingham" or "Crow's Hall" followed by scenes
  // (available for future use in more complex schedule parsing)
  // const locationHeaderPattern = /(?:^|\n)([A-Z][A-Za-z\s\'\-,]+)(?:\n\s*Load\s+in|(?=\n\s*Scene))/gi;

  // Find all "End of Shooting Day" markers first (these are most reliable)
  const dayMarkers: { dayNum: number; date?: string; dayOfWeek?: string; endPos: number }[] = [];
  let match;

  while ((match = endOfDayPattern.exec(text)) !== null) {
    const dayNum = parseInt(match[1], 10);
    const dayOfWeek = match[2];
    const day = match[3].padStart(2, '0');
    const month = monthToNumber(match[4]);
    const year = match[5];
    const date = month ? `${year}-${month}-${day}` : undefined;

    if (!dayMarkers.find(d => d.dayNum === dayNum)) {
      dayMarkers.push({ dayNum, date, dayOfWeek, endPos: match.index });
    }
  }

  // Also find day header patterns
  const dayStarts: { dayNum: number; location: string; startPos: number }[] = [];
  while ((match = dayHeaderPattern.exec(text)) !== null) {
    const dayNum = parseInt(match[1], 10);
    const location = (match[2] || '').trim();
    if (!dayStarts.find(d => d.dayNum === dayNum)) {
      dayStarts.push({ dayNum, location, startPos: match.index });
    }
  }

  // Combine markers to define day sections
  // If we have end markers, use them to work backwards
  if (dayMarkers.length > 0) {
    dayMarkers.sort((a, b) => a.endPos - b.endPos);

    for (let i = 0; i < dayMarkers.length; i++) {
      const marker = dayMarkers[i];
      const prevEndPos = i > 0 ? dayMarkers[i - 1].endPos : 0;
      const dayText = text.slice(prevEndPos, marker.endPos + 200);

      const day = parseDaySectionFast(marker.dayNum, '', dayText, marker.date, marker.dayOfWeek);
      days.push(day);
    }
  } else if (dayStarts.length > 0) {
    // Fall back to day start markers
    dayStarts.sort((a, b) => a.startPos - b.startPos);

    for (let i = 0; i < dayStarts.length; i++) {
      const current = dayStarts[i];
      const nextPos = dayStarts[i + 1]?.startPos || text.length;
      const dayText = text.slice(current.startPos, nextPos);

      const day = parseDaySectionFast(current.dayNum, current.location, dayText);
      days.push(day);
    }
  } else {
    // No clear day markers - parse the whole text as scenes
    // and group by shooting day markers (D1, D2, N1, etc.)
    const scenes = parseSceneEntriesFast(text);
    if (scenes.length > 0) {
      // Group scenes by their day marker
      const scenesByDay = new Map<number, ScheduleSceneEntry[]>();
      for (const scene of scenes) {
        // Extract day number from dayNight (D5, N8, etc.)
        const dayMatch = scene.dayNight.match(/[DN](\d+)/i);
        const dayNum = dayMatch ? parseInt(dayMatch[1], 10) : 1;
        if (!scenesByDay.has(dayNum)) {
          scenesByDay.set(dayNum, []);
        }
        scenesByDay.get(dayNum)!.push(scene);
      }

      for (const [dayNum, dayScenes] of scenesByDay) {
        days.push({
          dayNumber: dayNum,
          location: '',
          scenes: dayScenes,
        });
      }
    }
  }

  // Sort days by day number
  days.sort((a, b) => a.dayNumber - b.dayNumber);

  return days;
}

/**
 * Fast parsing of a single day section to extract details and scenes
 */
function parseDaySectionFast(
  dayNum: number,
  location: string,
  dayText: string,
  date?: string,
  dayOfWeek?: string
): ScheduleDay {
  // Extract hours (format: "HOURS: 0600 - 1600" or "0700 - 1700")
  const hoursMatch = dayText.match(/HOURS?[:\s]*(\d{4})\s*[-–]\s*(\d{4})/i);
  const hours = hoursMatch ? `${hoursMatch[1]} - ${hoursMatch[2]}` : undefined;

  // Extract day type (CWD, SWD, etc.)
  const dayTypeMatch = dayText.match(/\b(CWD|SWD|SCWD)\b/i);
  const dayType = dayTypeMatch ? dayTypeMatch[1].toUpperCase() : undefined;

  // Extract sunrise/sunset from "SR: 04:51 SS: 20:53" format
  const srMatch = dayText.match(/SR[:\s]*(\d{2}):?(\d{2})/i);
  const ssMatch = dayText.match(/SS[:\s]*(\d{2}):?(\d{2})/i);
  const sunrise = srMatch ? `${srMatch[1]}:${srMatch[2]}` : undefined;
  const sunset = ssMatch ? `${ssMatch[1]}:${ssMatch[2]}` : undefined;

  // Extract date if not provided
  if (!date) {
    const dateMatch = dayText.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[,\s]+(\d{1,2})\s+(\w+)\s+(\d{4})/i);
    if (dateMatch) {
      dayOfWeek = dayText.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i)?.[1];
      const day = dateMatch[1].padStart(2, '0');
      const month = monthToNumber(dateMatch[2]);
      const year = dateMatch[3];
      if (month) {
        date = `${year}-${month}-${day}`;
      }
    }
  }

  // Extract location if not provided
  if (!location) {
    // Look for location patterns like "The Crown, Framlingham" or "Crow's Hall"
    const locMatch = dayText.match(/(?:^|\n)([A-Z][A-Za-z\s\'\-,]+?)(?:\n\s*Load|\n\s*Scene|\n\s*Est)/m);
    if (locMatch) {
      location = locMatch[1].trim();
    }
  }

  // Extract notes like "UNIT MOVE", "Drone Day", "Load in", "Load Out"
  const notes: string[] = [];
  if (/UNIT\s+MOVE/i.test(dayText)) notes.push('UNIT MOVE');
  if (/Drone\s+Day/i.test(dayText)) notes.push('Drone Day');
  if (/Load\s*in/i.test(dayText)) notes.push('Load In');
  if (/Load\s*Out/i.test(dayText)) notes.push('Load Out');
  if (/Lighting\s+Change/i.test(dayText)) notes.push('Lighting Change');

  // Extract total pages
  const totalPagesMatch = dayText.match(/(\d+\s*\d*\/?\d*)\s*Pages?/i);
  const totalPages = totalPagesMatch ? totalPagesMatch[1].trim() : undefined;

  // Parse scenes using fast pattern matching
  const scenes = parseSceneEntriesFast(dayText);

  return {
    dayNumber: dayNum,
    date,
    dayOfWeek,
    location,
    hours,
    dayType,
    sunrise,
    sunset,
    notes: notes.length > 0 ? notes : undefined,
    scenes,
    totalPages,
  };
}

/**
 * Fast scene parsing using multiple regex patterns for tabular schedule format
 * Handles formats like:
 * - "Scene 21 | 2 pgs | INT Day | MARGOT'S BEDROOM - PLUMHILL MANOR | 1 | Est. Time 3:00 | D5"
 * - Table rows with scene number, pages, INT/EXT, location, cast numbers, time, day marker
 * - Two-row table format where "Scene" and scene number are on separate lines (stacked cells)
 */
function parseSceneEntriesFast(dayText: string): ScheduleSceneEntry[] {
  const scenes: ScheduleSceneEntry[] = [];
  const lines = dayText.split('\n');

  // First, try to detect and handle two-row table format
  // In this format, "Scene" is on one line and the scene number is on the next line
  // Example:
  //   Line 1: Scene  2     INT   MARGOT'S BEDROOM...      1    Est. Time   Day:
  //   Line 2: 21     pgs   Day   Margot wakes to a call...     3:00        D5
  const twoRowScenes = parseTwoRowTableFormat(lines);
  if (twoRowScenes.length > 0) {
    return twoRowScenes;
  }

  // Fall back to single-line format parsing
  // Combine related lines (scene header + description often on separate lines)
  const combinedLines: string[] = [];
  let currentLine = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines, headers, and page markers
    if (!trimmed ||
        /^(DAY|HOURS|SR:|SS:|End of|UNIT MOVE|WRAP|Load|===|PAGE|Daylight|Est\.\s*Unit)/i.test(trimmed) ||
        /^Lighting\s+Change/i.test(trimmed) ||
        /^Set\s+Move/i.test(trimmed) ||
        /^#\d+\s+H\/MU/i.test(trimmed)) {
      if (currentLine) {
        combinedLines.push(currentLine);
        currentLine = '';
      }
      continue;
    }

    // Check if this is a new scene line (starts with "Scene" or has scene pattern)
    // IMPORTANT: Exclude cast number lists (comma-separated numbers like "1, 2, 4, 7")
    const isCastList = /^\d{1,2}\s*,\s*\d/.test(trimmed);
    const isSceneLine = !isCastList && (
                        /^Scene\s*\d+/i.test(trimmed) ||
                        /^\d+[A-Za-z]?\s+\d+\s*\/?8?\s*pgs?/i.test(trimmed) ||
                        /^\d+[A-Za-z]?(?:\s*p\d+)?(?:pt)?\s+(?:\d+\s*)?(?:\d\/\d)?\s*pgs?\s+(?:INT|EXT)/i.test(trimmed));

    if (isSceneLine && currentLine) {
      combinedLines.push(currentLine);
      currentLine = trimmed;
    } else if (isSceneLine) {
      currentLine = trimmed;
    } else if (currentLine) {
      // Append continuation line
      currentLine += ' ' + trimmed;
    }
  }
  if (currentLine) {
    combinedLines.push(currentLine);
  }

  // Parse each combined line
  for (const line of combinedLines) {
    const scene = parseSceneLine(line);
    if (scene && !scenes.find(s => s.sceneNumber === scene.sceneNumber)) {
      scene.shootOrder = scenes.length + 1;
      scenes.push(scene);
    }
  }

  return scenes;
}

/**
 * Parse two-row table format where scene data is split across two lines
 * Row 1: "Scene", page count top part, "INT/EXT", location, cast#, "Est. Time", "Day:", "Remarks:"
 * Row 2: scene number, "pgs", "Day/Night", description, time value, day marker, remarks text
 */
function parseTwoRowTableFormat(lines: string[]): ScheduleSceneEntry[] {
  const scenes: ScheduleSceneEntry[] = [];

  // Look for lines that start with "Scene" followed by tab/spaces but NO number immediately after
  // This indicates the two-row format where the scene number is on the next line
  for (let i = 0; i < lines.length - 1; i++) {
    const line1 = lines[i].trim();
    const line2 = lines[i + 1]?.trim() || '';

    // Detect "Scene" header row pattern:
    // - Starts with "Scene" (possibly followed by whitespace/tab)
    // - Does NOT have a digit immediately after "Scene"
    // - Contains INT or EXT somewhere in the line
    // - Next line starts with a scene number (digits, possibly with letter suffix)
    const isSceneHeaderRow = /^Scene(?:\s|\t|$)/i.test(line1) &&
                              !/^Scene\s*\d/i.test(line1) &&
                              /\b(INT|EXT)\b/i.test(line1);

    // Scene numbers can be "7", "4A", "18B", "106A p1" etc.
    // But NOT cast lists like "1, 2, 4, 7"
    const nextLineHasSceneNum = /^(\d+[A-Za-z]?(?:\s*p\d+)?)(?:\s|\t|$)/.test(line2) &&
                                 !/^\d+\s*,/.test(line2);

    if (isSceneHeaderRow && nextLineHasSceneNum) {
      // This is a two-row scene entry - combine the rows
      const combinedScene = combineSceneRows(line1, line2);
      if (combinedScene && !scenes.find(s => s.sceneNumber === combinedScene.sceneNumber)) {
        combinedScene.shootOrder = scenes.length + 1;
        scenes.push(combinedScene);
      }
      // Skip the next line since we've processed it
      i++;
    }
  }

  return scenes;
}

/**
 * Combine two rows of scene data into a single scene entry
 * Handles tab-separated columns where data is vertically stacked
 */
function combineSceneRows(headerRow: string, dataRow: string): ScheduleSceneEntry | null {
  // Split both rows by tabs (primary delimiter) and multiple spaces (secondary delimiter)
  const splitRow = (row: string): string[] => {
    // First split by tabs
    const tabSplit = row.split('\t');
    // If we got meaningful splits, use them
    if (tabSplit.length > 3) {
      return tabSplit.map(s => s.trim());
    }
    // Otherwise try splitting by 2+ spaces
    return row.split(/\s{2,}/).map(s => s.trim());
  };

  const headerCols = splitRow(headerRow);
  const dataCols = splitRow(dataRow);

  // Extract scene number from data row (first column)
  // Handle formats like "7", "4A", "18B", "106A p1", "106Apt"
  const sceneNumMatch = dataCols[0]?.match(/^(\d+[A-Za-z]?(?:\s*p\d+)?(?:pt)?)/i);
  if (!sceneNumMatch) return null;
  const sceneNumber = sceneNumMatch[1].replace(/pt$/i, '').trim();

  // Combine columns to extract data
  // Header: [Scene, pageTop, INT, LOCATION..., castNum, Est. Time, Day:, Remarks:]
  // Data:   [sceneNum, pgs, Day, description..., timeVal, dayMarker, remarks...]

  // Extract pages - look for "pgs" in data row and combine with number from header
  let pages: string | undefined;
  const pgsIndex = dataCols.findIndex(c => /pgs?$/i.test(c));
  if (pgsIndex > 0 && headerCols[pgsIndex]) {
    const pageNum = headerCols[pgsIndex].match(/(\d+\s*(?:\d\/\d)?)/);
    if (pageNum) {
      pages = pageNum[1].trim();
    }
  }
  // Also check if pages are in same cell like "2/8 pgs"
  if (!pages) {
    for (const col of [...headerCols, ...dataCols]) {
      const pagesMatch = col.match(/(\d+\s*(?:\d\/\d)?)\s*pgs?/i);
      if (pagesMatch) {
        pages = pagesMatch[1].trim();
        break;
      }
    }
  }

  // Extract INT/EXT from header row
  const intExtMatch = headerRow.match(/\b(INT|EXT)(?:\/(?:INT|EXT))?\b/i);
  const intExt = intExtMatch ? (intExtMatch[1].toUpperCase() as 'INT' | 'EXT') : 'INT';

  // Extract time of day from data row (Day, Night, Morning, etc.)
  const timeMatch = dataRow.match(/\b(Day|Night|Morning|Evening|Dawn|Dusk)\b/i);
  const timeOfDay = timeMatch ? timeMatch[1] : 'Day';

  // Extract day marker (D5, N8, etc.) from data row
  const dayMarkerMatch = dataRow.match(/\b([DN]\d+[DN]?)\b/i);
  const dayNight = dayMarkerMatch ? dayMarkerMatch[1].toUpperCase() : timeOfDay;

  // Extract location from header row - typically ALL CAPS after INT/EXT
  let setLocation = '';
  const locationMatch = headerRow.match(/\b(?:INT|EXT)(?:\/(?:INT|EXT))?\s+([A-Z][A-Z\s\-\'\/,\.]+?)(?:\t|\s{2,}|\d{1,2}(?:\s*,|\s+Est)|$)/);
  if (locationMatch) {
    setLocation = locationMatch[1].trim()
      .replace(/\s+/g, ' ')
      .replace(/[-–]\s*$/, '')
      .trim();
  }

  // Extract description from data row - mixed case text describing the scene action
  let description = '';
  // Find the description after Day/Night marker and before numbers/time
  const descMatch = dataRow.match(/\b(?:Day|Night|Morning)\s+([A-Z][a-z][^0-9\t]{5,}?)(?:\d|\t|$)/i);
  if (descMatch) {
    description = descMatch[1].trim().replace(/\s+/g, ' ');
  } else {
    // Try to find any mixed case text that looks like a description
    for (const col of dataCols) {
      if (/^[A-Z][a-z]/.test(col) && col.length > 10 && !/pgs?$/i.test(col)) {
        description = col.trim();
        break;
      }
    }
  }

  // Extract cast numbers - look for single digits or comma-separated numbers
  const castNumbers: number[] = [];

  // Check header row for cast numbers (typically after location)
  const headerCastMatch = headerRow.match(/(?:MANOR|HOUSE|ROOM|GARDEN|HALL|KITCHEN|BEDROOM|PARLOUR|HALLWAY|STREETS|BRIDGE|DOOR|FOYER)\s+(\d{1,2}(?:\s*,\s*\d{1,2})*)/i);
  if (headerCastMatch) {
    const nums = headerCastMatch[1].match(/\d{1,2}/g);
    if (nums) {
      for (const n of nums) {
        const num = parseInt(n, 10);
        if (num > 0 && num <= 50 && !castNumbers.includes(num)) {
          castNumbers.push(num);
        }
      }
    }
  }

  // Also look for cast numbers in both rows using column-based detection
  for (const col of [...headerCols, ...dataCols]) {
    // Skip if it looks like time, pages, or day marker
    if (/pgs?$/i.test(col) || /^\d+:\d+$/.test(col) || /^[DN]\d+/i.test(col) || /^:\d+$/.test(col)) continue;
    // Check for single cast number or comma-separated list
    if (/^\d{1,2}(?:\s*,\s*\d{1,2})*$/.test(col.trim())) {
      const nums = col.match(/\d{1,2}/g);
      if (nums) {
        for (const n of nums) {
          const num = parseInt(n, 10);
          if (num > 0 && num <= 50 && !castNumbers.includes(num)) {
            castNumbers.push(num);
          }
        }
      }
    }
  }

  // Extract estimated time from data row (format: "3:00", "1:30", ":30")
  const estTimeMatch = dataRow.match(/\b(\d{1,2}:\d{2}|:\d{2})\b/);
  const estimatedTime = estTimeMatch ? estTimeMatch[1] : undefined;

  return {
    sceneNumber,
    pages,
    intExt,
    dayNight,
    setLocation,
    description: description || undefined,
    castNumbers,
    estimatedTime,
    shootOrder: 0,
  };
}

/**
 * Parse a single scene line into a ScheduleSceneEntry
 */
function parseSceneLine(line: string): ScheduleSceneEntry | null {
  // Multiple patterns to match different schedule formats

  // Pattern 1: "Scene 21 | 2 pgs | INT | Day | LOCATION | description | 1, 2 | 3:00 | D5"
  // Pattern 2: "21 | 2 pgs | INT Day | LOCATION description | 1 | Est. Time 3:00 | Day: D5"
  // Pattern 3: "Scene 21 2 pgs INT Day LOCATION description 1, 2, 3 Est. Time 3:00 Day: D5"

  // IMPORTANT: Reject lines that look like cast number lists (comma-separated numbers only)
  // Cast lists look like: "1, 2, 4, 7" or "1,2,4,7" - just numbers with commas
  // Scene lines have additional data like "pgs", "INT/EXT", locations, etc.
  const trimmed = line.trim();

  // If line starts with a number followed by comma and more numbers, it's a cast list
  if (/^(\d{1,2}\s*,\s*)+\d{1,2}\s*$/.test(trimmed)) {
    return null; // This is a cast list, not a scene
  }

  // If line starts with number, comma, number - it's likely a cast list
  if (/^\d{1,2}\s*,\s*\d/.test(trimmed) && !/pgs?/i.test(trimmed) && !/\b(INT|EXT)\b/i.test(trimmed)) {
    return null; // Cast list without scene data
  }

  // Extract scene number (at start, with optional "Scene" prefix)
  const sceneNumMatch = line.match(/^(?:Scene\s*)?(\d+[A-Za-z]?(?:\s*p\d+)?(?:pt)?)/i);
  if (!sceneNumMatch) return null;

  const sceneNumber = sceneNumMatch[1].replace(/pt$/i, '').trim();

  // Extract pages (like "2 pgs", "1 4/8 pgs", "2/8 pgs")
  const pagesMatch = line.match(/(\d+\s*(?:\d\/\d)?)\s*pgs?/i);
  const pages = pagesMatch ? pagesMatch[1].trim() : undefined;

  // Extract INT/EXT
  const intExtMatch = line.match(/\b(INT|EXT)(?:\/(?:INT|EXT))?\b/i);
  const intExt = intExtMatch ? (intExtMatch[1].toUpperCase() as 'INT' | 'EXT') : 'INT';

  // Extract time of day (Day, Night, Morning, Evening)
  const timeMatch = line.match(/\b(Day|Night|Morning|Evening|Dawn|Dusk)\b/i);
  const timeOfDay = timeMatch ? timeMatch[1] : 'Day';

  // Extract day marker (D5, N8, D4N, etc.) - typically near the end
  const dayMarkerMatch = line.match(/\b([DN]\d+[DN]?)\b/i);
  const dayNight = dayMarkerMatch ? dayMarkerMatch[1].toUpperCase() : timeOfDay;

  // Extract location (ALL CAPS with spaces, dashes, apostrophes)
  // Location typically comes after INT/EXT Day/Night
  const afterIntExt = line.slice(line.search(/\b(INT|EXT)\b/i) || 0);
  const locationMatch = afterIntExt.match(/(?:Day|Night|Morning)\s+([A-Z][A-Z\s\-\'\/,]+?)(?:\s+[a-z]|\s+\d{1,2}(?:\s*,|\s+Est)|\s+Est\.?\s*Time|$)/);
  let setLocation = '';
  if (locationMatch) {
    setLocation = locationMatch[1].trim()
      .replace(/\s+/g, ' ')
      .replace(/[-–]\s*$/, '')
      .trim();
  }

  // Extract cast numbers (look for comma-separated numbers, typically after location)
  // Be careful not to match page numbers or time estimates
  const castMatches = line.match(/(?:^|[,\s])(\d{1,2}(?:\s*,\s*\d{1,2})+)(?:\s|$|,)/g);
  let castNumbers: number[] = [];

  if (castMatches) {
    for (const match of castMatches) {
      const nums = match.match(/\d{1,2}/g);
      if (nums) {
        for (const n of nums) {
          const num = parseInt(n, 10);
          // Filter: cast numbers are typically 1-20, and not part of time/page
          if (num > 0 && num <= 50 && !castNumbers.includes(num)) {
            castNumbers.push(num);
          }
        }
      }
    }
  }

  // Also look for single cast number pattern
  const singleCastMatch = line.match(/(?:^|\t|\s{2,})(\d{1,2})(?:\s+Est\.?\s*Time|\s+Day:|\s+[DN]\d|\t|$)/);
  if (singleCastMatch) {
    const num = parseInt(singleCastMatch[1], 10);
    if (num > 0 && num <= 50 && !castNumbers.includes(num)) {
      castNumbers.push(num);
    }
  }

  // Extract description (mixed case text, typically after location)
  let description = '';
  if (setLocation) {
    const locIndex = line.indexOf(setLocation);
    if (locIndex >= 0) {
      const afterLoc = line.slice(locIndex + setLocation.length);
      // Description is mixed case text between location and cast/time
      const descMatch = afterLoc.match(/^\s*[-–]?\s*([A-Z][a-z][^0-9\t]{10,}?)(?:\d{1,2}(?:\s*,|\s+Est)|\t|$)/);
      if (descMatch) {
        description = descMatch[1].trim().replace(/\s+/g, ' ');
      }
    }
  }

  // Extract estimated time (like "3:00", "1:30", ":30")
  const estTimeMatch = line.match(/(?:Est\.?\s*Time[:\s]*)?(\d*:?\d{2})(?:\s|$)/);
  const estimatedTime = estTimeMatch && estTimeMatch[1] !== sceneNumber
    ? estTimeMatch[1]
    : undefined;

  return {
    sceneNumber,
    pages,
    intExt,
    dayNight,
    setLocation,
    description: description || undefined,
    castNumbers,
    estimatedTime,
    shootOrder: 0,
  };
}

/**
 * Extract production metadata from text
 */
function extractMetadata(text: string): { productionName?: string; scriptVersion?: string; scheduleVersion?: string } {
  const firstPage = text.slice(0, 2000);

  // Try to find production name (often in caps at the top)
  const prodMatch = firstPage.match(/^[A-Z][A-Z\s\-\']+(?=\s*\n)/m);

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

// formatTime helper (available for future use)
// function formatTime(time: string): string {
//   if (time.length === 4) {
//     return `${time.slice(0, 2)}:${time.slice(2)}`;
//   }
//   return time;
// }

/**
 * Helper to convert month name to number
 */
function monthToNumber(month: string): string | null {
  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12',
  };
  return months[month.toLowerCase()] || null;
}

// ============================================
// STAGE 2: SINGLE DAY PARSING (For AI Service)
// ============================================

/**
 * Parse a single day's text block using regex (fallback for AI)
 * Exported for use by Stage 2 AI service as fallback
 */
export function parseSingleDayText(dayNum: number, dayText: string): ScheduleDay {
  return parseDaySectionFast(dayNum, '', dayText);
}

/**
 * Extract text from PDF - exported for Stage 2 re-processing
 */
export { extractTextFromPDF };

// ============================================
// LEGACY FULL PARSE (For backwards compatibility)
// ============================================

/**
 * Parse a schedule PDF file and return structured data
 * Uses fast regex-based parsing (no AI dependency)
 * NOTE: For new implementations, use parseScheduleStage1() + Stage 2 AI
 */
export async function parseSchedulePDF(file: File): Promise<ProductionSchedule> {
  console.time('scheduleParser:total');

  // Store PDF as data URI for later viewing
  console.time('scheduleParser:readFile');
  const pdfUri = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
  console.timeEnd('scheduleParser:readFile');

  // Extract text from PDF with tabular structure preservation
  console.time('scheduleParser:extractText');
  const text = await extractTextFromPDF(file);
  console.timeEnd('scheduleParser:extractText');

  console.log('Extracted schedule text length:', text.length);

  // Parse the text into structured data (fast, synchronous)
  console.time('scheduleParser:parseText');
  const schedule = parseScheduleText(text, pdfUri);
  console.timeEnd('scheduleParser:parseText');

  console.log(`Parsed ${schedule.castList.length} cast members, ${schedule.days.length} days, ${schedule.days.reduce((sum, d) => sum + d.scenes.length, 0)} scenes`);
  console.timeEnd('scheduleParser:total');

  return schedule;
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

/**
 * Match schedule scenes to script scenes and extract character information
 */
export function matchScheduleToScript(
  schedule: ProductionSchedule,
  scriptScenes: Array<{ sceneNumber: string; id: string }>
): Map<string, { sceneId: string; characterNames: string[]; shootingDay: number }> {
  const result = new Map<string, { sceneId: string; characterNames: string[]; shootingDay: number }>();

  for (const day of schedule.days) {
    for (const scheduleScene of day.scenes) {
      // Find matching script scene
      const scriptScene = scriptScenes.find(s =>
        normalizeSceneNumber(s.sceneNumber) === normalizeSceneNumber(scheduleScene.sceneNumber)
      );

      if (scriptScene) {
        const characterNames = getCharacterNamesForScene(schedule.castList, scheduleScene.castNumbers);
        result.set(scheduleScene.sceneNumber, {
          sceneId: scriptScene.id,
          characterNames,
          shootingDay: day.dayNumber,
        });
      }
    }
  }

  return result;
}

/**
 * Normalize scene number for matching (handle "4A", "4a", "4 A", etc.)
 */
function normalizeSceneNumber(sceneNumber: string): string {
  return sceneNumber.replace(/\s+/g, '').toUpperCase();
}
