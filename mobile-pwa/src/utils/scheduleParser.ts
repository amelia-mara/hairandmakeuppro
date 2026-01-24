import * as pdfjsLib from 'pdfjs-dist';
import type {
  ProductionSchedule,
  ScheduleCastMember,
  ScheduleDay,
  ScheduleSceneEntry,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
 */
function parseScheduleText(text: string, pdfUri?: string): ProductionSchedule {
  // First, extract cast list from the beginning of the text
  const castList = extractCastListFast(text);

  // Then parse all days and their scenes
  const days = parseAllDaysFast(text);

  // Extract production metadata
  const metadata = extractMetadata(text);

  return {
    id: uuidv4(),
    productionName: metadata.productionName,
    scriptVersion: metadata.scriptVersion,
    scheduleVersion: metadata.scheduleVersion,
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
 */
function parseSceneEntriesFast(dayText: string): ScheduleSceneEntry[] {
  const scenes: ScheduleSceneEntry[] = [];
  const lines = dayText.split('\n');

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
    const isSceneLine = /^Scene\s*\d+/i.test(trimmed) ||
                        /^\d+[A-Za-z]?\s+\d+\s*\/?8?\s*pgs?/i.test(trimmed) ||
                        /^\d+[A-Za-z]?(?:pt)?\s+(?:\d+\s*)?(?:\d\/\d)?\s*pgs?\s+(?:INT|EXT)/i.test(trimmed);

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
 * Parse a single scene line into a ScheduleSceneEntry
 */
function parseSceneLine(line: string): ScheduleSceneEntry | null {
  // Multiple patterns to match different schedule formats

  // Pattern 1: "Scene 21 | 2 pgs | INT | Day | LOCATION | description | 1, 2 | 3:00 | D5"
  // Pattern 2: "21 | 2 pgs | INT Day | LOCATION description | 1 | Est. Time 3:00 | Day: D5"
  // Pattern 3: "Scene 21 2 pgs INT Day LOCATION description 1, 2, 3 Est. Time 3:00 Day: D5"

  // Extract scene number (at start, with optional "Scene" prefix)
  const sceneNumMatch = line.match(/^(?:Scene\s*)?(\d+[A-Za-z]?(?:pt)?)/i);
  if (!sceneNumMatch) return null;

  const sceneNumber = sceneNumMatch[1].replace(/pt$/i, '');

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

/**
 * Parse a schedule PDF file and return structured data
 * Uses fast regex-based parsing (no AI dependency)
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
