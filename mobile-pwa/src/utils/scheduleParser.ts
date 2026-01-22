import * as pdfjsLib from 'pdfjs-dist';
import type {
  ProductionSchedule,
  ScheduleCastMember,
  ScheduleDay,
  ScheduleSceneEntry,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { callAI } from '@/services/aiService';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Extract text content from a PDF file, preserving some structure
 * by adding newlines between text items that are vertically separated
 */
async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Sort items by Y position (top to bottom) then X position (left to right)
    const items = textContent.items as any[];
    items.sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5]; // Y is inverted in PDF
      if (Math.abs(yDiff) > 5) return yDiff; // Different lines
      return a.transform[4] - b.transform[4]; // Same line, sort by X
    });

    let lastY = null;
    let pageText = '';

    for (const item of items) {
      const y = Math.round(item.transform[5]);
      const text = item.str;

      if (lastY !== null && Math.abs(y - lastY) > 5) {
        // New line detected
        pageText += '\n';
      } else if (pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
        // Same line, add space between items
        pageText += ' ';
      }

      pageText += text;
      lastY = y;
    }

    fullText += `\n\n=== PAGE ${i} ===\n\n` + pageText;
  }

  return fullText;
}

/**
 * Parse extracted text into a structured ProductionSchedule object using AI
 * For long schedules, process in chunks to avoid token limits
 */
async function parseScheduleText(text: string, pdfUri?: string): Promise<ProductionSchedule> {
  // First, try to extract cast list from the beginning of the text
  const castList = await extractCastList(text);

  // Then parse all days and their scenes
  const days = await parseAllDays(text);

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
 * Extract cast list from schedule text
 */
async function extractCastList(text: string): Promise<ScheduleCastMember[]> {
  // Look for cast list section - usually at the start
  const castSection = text.slice(0, 5000); // Cast list is typically on first page

  const castList: ScheduleCastMember[] = [];

  // Pattern: "1.PETER" or "1. PETER" or "1 PETER" with the number being 1-99
  const castPattern = /\b(\d{1,2})\s*\.?\s*([A-Z][A-Z'\-\s]{1,30}?)(?=\s*\d{1,2}\s*\.?\s*[A-Z]|\s*$|\n)/g;
  let match;

  while ((match = castPattern.exec(castSection)) !== null) {
    const num = parseInt(match[1], 10);
    const name = match[2].trim();

    // Validate: number should be reasonable, name should be a name not a location
    if (num > 0 && num <= 50 && name.length >= 2 && name.length <= 25) {
      // Skip if it looks like a location or time
      if (!/^(INT|EXT|DAY|NIGHT|MORNING|HOURS|PAGE|SCENE)/i.test(name)) {
        if (!castList.find(c => c.number === num)) {
          castList.push({ number: num, name });
        }
      }
    }
  }

  // If we didn't find enough cast, try AI extraction
  if (castList.length < 3) {
    try {
      const aiCast = await extractCastWithAI(castSection);
      if (aiCast.length > castList.length) {
        return aiCast;
      }
    } catch (e) {
      console.warn('AI cast extraction failed:', e);
    }
  }

  return castList;
}

/**
 * Extract cast list using AI
 */
async function extractCastWithAI(text: string): Promise<ScheduleCastMember[]> {
  const prompt = `Extract the cast list from this production schedule. The cast list shows numbered cast members like "1.PETER", "2.GWEN", etc.

TEXT:
${text.slice(0, 3000)}

Return ONLY a JSON array of cast members:
[{"number": 1, "name": "PETER"}, {"number": 2, "name": "GWEN"}]`;

  const response = await callAI(prompt, { maxTokens: 1000 });
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.map((c: any) => ({
      number: parseInt(c.number, 10) || 0,
      name: String(c.name || '').trim(),
    })).filter((c: ScheduleCastMember) => c.number > 0 && c.name.length > 0);
  }
  return [];
}

/**
 * Parse all shooting days and their scenes from the schedule text
 */
async function parseAllDays(text: string): Promise<ScheduleDay[]> {
  const days: ScheduleDay[] = [];

  // Find all day headers: "DAY 1 - Location" or "DAY 1" patterns
  const dayHeaderPattern = /DAY\s+(\d+)\s*[-–]?\s*([A-Za-z\s\-\']+)?(?:\n|$)/gi;

  // Find all day start positions
  const dayPositions: { dayNum: number; location: string; startPos: number }[] = [];
  let match;

  while ((match = dayHeaderPattern.exec(text)) !== null) {
    const dayNum = parseInt(match[1], 10);
    const location = (match[2] || '').trim();

    // Avoid duplicates at similar positions
    const existing = dayPositions.find(d => d.dayNum === dayNum);
    if (!existing) {
      dayPositions.push({ dayNum, location, startPos: match.index });
    }
  }

  // Sort by position in text
  dayPositions.sort((a, b) => a.startPos - b.startPos);

  // Extract each day's content and parse scenes
  for (let i = 0; i < dayPositions.length; i++) {
    const current = dayPositions[i];
    const nextPos = dayPositions[i + 1]?.startPos || text.length;
    const dayText = text.slice(current.startPos, nextPos);

    // Parse this day's details and scenes
    const day = await parseDaySection(current.dayNum, current.location, dayText);
    days.push(day);
  }

  // Sort days by day number
  days.sort((a, b) => a.dayNumber - b.dayNumber);

  return days;
}

/**
 * Parse a single day section to extract details and scenes
 */
async function parseDaySection(dayNum: number, location: string, dayText: string): Promise<ScheduleDay> {
  // Extract hours (format: "HOURS: 0600 - 1600" or "0700 - 1700")
  const hoursMatch = dayText.match(/HOURS?[:\s]*(\d{4})\s*[-–]\s*(\d{4})/i);
  const hours = hoursMatch ? `${hoursMatch[1]} - ${hoursMatch[2]}` : undefined;

  // Extract day type (CWD, SWD, etc.)
  const dayTypeMatch = dayText.match(/\(([A-Z]{2,4})\)/);
  const dayType = dayTypeMatch ? dayTypeMatch[1] : undefined;

  // Extract sunrise/sunset
  const srssMatch = dayText.match(/SR[:\s]*(\d{4})\s*[\/]\s*SS[:\s]*(\d{4})/i);
  const sunrise = srssMatch ? formatTime(srssMatch[1]) : undefined;
  const sunset = srssMatch ? formatTime(srssMatch[2]) : undefined;

  // Extract date if present
  const dateMatch = dayText.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[,\s]+(\d{1,2})\s+(\w+)\s+(\d{4})/i);
  let date: string | undefined;
  let dayOfWeek: string | undefined;
  if (dateMatch) {
    dayOfWeek = dayText.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i)?.[1];
    const day = dateMatch[1].padStart(2, '0');
    const month = monthToNumber(dateMatch[2]);
    const year = dateMatch[3];
    if (month) {
      date = `${year}-${month}-${day}`;
    }
  }

  // Extract notes like "UNIT MOVE", "Drone Day"
  const notes: string[] = [];
  if (/UNIT\s+MOVE/i.test(dayText)) notes.push('UNIT MOVE');
  if (/Drone\s+Day/i.test(dayText)) notes.push('Drone Day');
  if (/WRAP/i.test(dayText)) notes.push('WRAP');

  // Extract total pages
  const totalPagesMatch = dayText.match(/(\d+\s*\d*\/?\d*)\s*Pages?/i);
  const totalPages = totalPagesMatch ? totalPagesMatch[1].trim() : undefined;

  // Parse scenes using pattern matching first
  let scenes = parseSceneEntries(dayText);

  // If pattern matching found few scenes, try AI
  if (scenes.length < 2 && dayText.length > 200) {
    try {
      const aiScenes = await parseScenesWithAI(dayText, dayNum);
      if (aiScenes.length > scenes.length) {
        scenes = aiScenes;
      }
    } catch (e) {
      console.warn(`AI scene parsing failed for day ${dayNum}:`, e);
    }
  }

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
 * Parse scene entries using regex patterns
 * Handles formats like:
 * - "1/8 pgs Scenes: 154A EXT Day SHORELINE Description 2 Est. Time"
 * - "2/8 pgs | Scenes: 3 | EXT | Day | ROAD | Description | 1, 2 | Est. Time"
 */
function parseSceneEntries(dayText: string): ScheduleSceneEntry[] {
  const scenes: ScheduleSceneEntry[] = [];

  // Split by lines for easier parsing
  const lines = dayText.split('\n');

  for (const line of lines) {
    // Skip headers, notes, and empty lines
    if (!line.trim() || /^(DAY|HOURS|SR:|End of|UNIT MOVE|WRAP|===)/i.test(line.trim())) {
      continue;
    }

    // Look for scene patterns
    // Pattern 1: "X/8 pgs" followed by "Scenes:" or scene number
    const sceneMatch = line.match(
      /(\d+\s*\d*\/\d+)\s*pgs?\s*(?:Scenes?:?)?\s*(\d+[A-Za-z]?\d*(?:\s*p\d+)?)\s+(INT|EXT)\s+(Day|Night|Morning|D\/N|D\d*|N\d*)/i
    );

    if (sceneMatch) {
      const pages = sceneMatch[1].trim();
      const sceneNumber = sceneMatch[2].trim();
      const intExt = sceneMatch[3].toUpperCase() as 'INT' | 'EXT';
      const dayNight = sceneMatch[4];

      // Extract location and description (after D/N marker)
      const afterDN = line.slice(line.indexOf(sceneMatch[4]) + sceneMatch[4].length);
      const locationMatch = afterDN.match(/^\s*([A-Z][A-Z\s\-\/]+?)(?:\s+[a-z]|\s+\d|$)/);
      const setLocation = locationMatch ? locationMatch[1].trim() : '';

      // Extract cast numbers (look for patterns like "1, 2" or "1, 2, 3")
      const castMatch = line.match(/\b(\d{1,2}(?:\s*,\s*\d{1,2})*)\s*(?:Est\.?\s*Time|$)/i);
      const castNumbers = castMatch
        ? castMatch[1].split(',').map(n => parseInt(n.trim(), 10)).filter(n => n > 0 && n < 50)
        : [];

      // Extract description (between location and cast)
      let description = '';
      if (setLocation) {
        const locEnd = afterDN.indexOf(setLocation) + setLocation.length;
        const descPart = afterDN.slice(locEnd);
        const descMatch = descPart.match(/^\s*(.+?)(?=\s+\d{1,2}\s*,|\s+\d{1,2}\s+Est|\s+Est\.?\s*Time|$)/);
        if (descMatch) {
          description = descMatch[1].trim();
        }
      }

      // Avoid duplicates
      if (!scenes.find(s => s.sceneNumber === sceneNumber)) {
        scenes.push({
          sceneNumber,
          pages,
          intExt,
          dayNight,
          setLocation,
          description: description || undefined,
          castNumbers,
          shootOrder: scenes.length + 1,
        });
      }
    }
  }

  return scenes;
}

/**
 * Parse scenes using AI for complex formats
 */
async function parseScenesWithAI(dayText: string, dayNum: number): Promise<ScheduleSceneEntry[]> {
  const prompt = `Extract ALL scenes from this Day ${dayNum} shooting schedule section.

TEXT:
${dayText.slice(0, 6000)}

Each scene entry typically has:
- Pages (like "1/8 pgs", "2/8 pgs")
- Scene number (like "154A", "3", "162 p1")
- INT or EXT
- Day/Night/Morning
- Location (like "ROAD", "DOCK", "TAXI - ISLAND")
- Description of the action
- Cast numbers (like "1, 2" or "1, 2, 8")

Return ONLY a JSON array of scenes found:
[{
  "sceneNumber": "154A",
  "pages": "1/8",
  "intExt": "EXT",
  "dayNight": "Day",
  "setLocation": "SHORELINE",
  "description": "PETER stands at the waters edge",
  "castNumbers": [2]
}]

IMPORTANT: Extract EVERY scene entry you can find. Do not skip any.`;

  const response = await callAI(prompt, { maxTokens: 4000 });
  const jsonMatch = response.match(/\[[\s\S]*\]/);

  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.map((s: any, idx: number) => ({
      sceneNumber: String(s.sceneNumber || ''),
      pages: s.pages || undefined,
      intExt: s.intExt === 'EXT' ? 'EXT' : 'INT',
      dayNight: s.dayNight || 'Day',
      setLocation: s.setLocation || '',
      description: s.description || undefined,
      castNumbers: Array.isArray(s.castNumbers)
        ? s.castNumbers.map((n: any) => parseInt(n, 10) || 0).filter((n: number) => n > 0)
        : [],
      shootOrder: idx + 1,
    })).filter((s: ScheduleSceneEntry) => s.sceneNumber.length > 0);
  }

  return [];
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

/**
 * Helper to format time from "0827" to "08:27"
 */
function formatTime(time: string): string {
  if (time.length === 4) {
    return `${time.slice(0, 2)}:${time.slice(2)}`;
  }
  return time;
}

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
 */
export async function parseSchedulePDF(file: File): Promise<ProductionSchedule> {
  // Store PDF as data URI for later viewing
  const pdfUri = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

  // Extract text from PDF with better structure preservation
  const text = await extractTextFromPDF(file);

  console.log('Extracted schedule text length:', text.length);
  console.log('First 1000 chars:', text.slice(0, 1000));

  // Parse the text into structured data
  return parseScheduleText(text, pdfUri);
}
