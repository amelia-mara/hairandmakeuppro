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
 * Extract text content from a PDF file
 */
async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += `\n--- PAGE ${i} ---\n` + pageText;
  }

  return fullText;
}

/**
 * Parse extracted text into a structured ProductionSchedule object using AI
 * This handles varying schedule formats from different ADs/productions
 */
async function parseScheduleText(text: string, pdfUri?: string): Promise<ProductionSchedule> {
  const systemPrompt = `You are an expert at parsing film/TV production shooting schedules. Your job is to extract structured data from schedule text that has been extracted from a PDF.

IMPORTANT: Shooting schedules vary between productions. The text extraction may lose table structure, so look for patterns and context clues.

Key elements to extract:

1. CAST LIST (usually on first page):
   - Format like "1.PETER", "2.GWEN", "3.EINAR", etc.
   - Number is the cast reference number used throughout
   - Name may be actor name or character name

2. SHOOTING DAYS:
   - Headers like "DAY 1 - Farmhouse", "DAY 2 - Location Name"
   - Hours like "HOURS: 0600 - 1600 --- (CWD)"
   - Sunrise/Sunset like "SR: 0827 / SS: 1554"

3. SCENES PER DAY:
   - Table format with: Pages | Scene Number | INT/EXT | D/N | Location/Set | Description | Cast Numbers | Est. Time
   - Scene numbers can be alphanumeric: "4A", "18B", "162 p1", "162 p2"
   - Cast shown as numbers like "1, 2" or "1, 2, 4, 7"
   - Pages shown as fractions: "1/8", "3/8", "1 2/8", "1 6/8"

Return ONLY valid JSON with no additional text or markdown.`;

  const prompt = `Parse this production schedule and extract all available information.

SCHEDULE TEXT:
---
${text.slice(0, 30000)}
---

Return a JSON object with this structure:
{
  "productionName": "Name of production if found",
  "scriptVersion": "Script version date/color if found",
  "scheduleVersion": "Schedule version date if found",
  "castList": [
    {
      "number": 1,
      "name": "PETER",
      "character": "Character name if different from name"
    }
  ],
  "days": [
    {
      "dayNumber": 1,
      "date": "2025-11-24 or null",
      "dayOfWeek": "Monday",
      "location": "Main location for the day",
      "hours": "0600 - 1600",
      "dayType": "CWD or SWD",
      "sunrise": "08:27",
      "sunset": "15:54",
      "notes": ["Drone Day", "UNIT MOVE", etc.],
      "scenes": [
        {
          "sceneNumber": "4A",
          "pages": "1/8",
          "intExt": "INT" or "EXT",
          "dayNight": "Day" or "Night" or "Morning",
          "setLocation": "FARMHOUSE - DRIVEWAY",
          "description": "Brief action description",
          "castNumbers": [1, 2, 4, 7],
          "estimatedTime": ":30" or "1:30"
        }
      ],
      "totalPages": "4 5/8"
    }
  ],
  "totalDays": 20
}

IMPORTANT:
- Extract ALL cast members from the cast list with their numbers
- Scene numbers should be extracted EXACTLY as shown (may be "4A", "18B", "162 p1", etc.)
- Cast numbers in scenes are integers that reference the castList
- INT/EXT must be exactly "INT" or "EXT"
- Include all shooting days found
- Notes like "Drone Day", "UNIT MOVE" should be captured
- If dates are found (like "Monday, 24 November 2025"), include them`;

  try {
    const response = await callAI(prompt, { system: systemPrompt, maxTokens: 8000 });

    // Parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in AI response:', response);
      throw new Error('Failed to parse schedule - invalid AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Build the ProductionSchedule object
    const castList: ScheduleCastMember[] = (parsed.castList || []).map((c: any) => ({
      number: typeof c.number === 'number' ? c.number : parseInt(c.number, 10) || 0,
      name: c.name || '',
      character: c.character || undefined,
    }));

    const days: ScheduleDay[] = (parsed.days || []).map((d: any) => {
      const scenes: ScheduleSceneEntry[] = (d.scenes || []).map((s: any, idx: number) => ({
        sceneNumber: String(s.sceneNumber || ''),
        pages: s.pages || undefined,
        intExt: s.intExt === 'EXT' ? 'EXT' : 'INT',
        dayNight: s.dayNight || 'Day',
        setLocation: s.setLocation || '',
        description: s.description || undefined,
        castNumbers: Array.isArray(s.castNumbers)
          ? s.castNumbers.map((n: any) => typeof n === 'number' ? n : parseInt(n, 10) || 0)
          : [],
        estimatedTime: s.estimatedTime || undefined,
        shootOrder: idx + 1,
      }));

      return {
        dayNumber: typeof d.dayNumber === 'number' ? d.dayNumber : parseInt(d.dayNumber, 10) || 0,
        date: d.date || undefined,
        dayOfWeek: d.dayOfWeek || undefined,
        location: d.location || '',
        hours: d.hours || undefined,
        dayType: d.dayType || undefined,
        sunrise: d.sunrise || undefined,
        sunset: d.sunset || undefined,
        notes: Array.isArray(d.notes) ? d.notes : undefined,
        scenes,
        totalPages: d.totalPages || undefined,
      };
    });

    return {
      id: uuidv4(),
      productionName: parsed.productionName || undefined,
      scriptVersion: parsed.scriptVersion || undefined,
      scheduleVersion: parsed.scheduleVersion || undefined,
      castList,
      days,
      totalDays: parsed.totalDays || days.length,
      uploadedAt: new Date(),
      pdfUri,
      rawText: text,
    };
  } catch (error) {
    console.error('AI schedule parsing failed:', error);
    // Fall back to basic regex parsing
    return fallbackParseScheduleText(text, pdfUri);
  }
}

/**
 * Fallback regex-based parser for when AI parsing fails
 * Extracts basic information that we can reasonably parse with patterns
 */
function fallbackParseScheduleText(text: string, pdfUri?: string): ProductionSchedule {
  const castList: ScheduleCastMember[] = [];
  const days: ScheduleDay[] = [];

  // Try to extract cast list (format: "1.NAME" or "1. NAME")
  const castPattern = /(\d+)\s*\.\s*([A-Z][A-Z\s\/]+)/g;
  let castMatch;
  while ((castMatch = castPattern.exec(text)) !== null) {
    const num = parseInt(castMatch[1], 10);
    const name = castMatch[2].trim();
    if (num > 0 && num <= 100 && name.length > 1) {
      // Avoid duplicates
      if (!castList.find(c => c.number === num)) {
        castList.push({ number: num, name });
      }
    }
  }

  // Try to extract days (format: "DAY X" or "DAY X -")
  const dayPattern = /DAY\s*(\d+)\s*[-–]?\s*([A-Za-z\s]+)?/gi;
  let dayMatch;
  while ((dayMatch = dayPattern.exec(text)) !== null) {
    const dayNum = parseInt(dayMatch[1], 10);
    const location = dayMatch[2]?.trim() || '';

    // Avoid duplicates
    if (!days.find(d => d.dayNumber === dayNum)) {
      days.push({
        dayNumber: dayNum,
        location,
        scenes: [],
      });
    }
  }

  return {
    id: uuidv4(),
    castList,
    days,
    totalDays: days.length,
    uploadedAt: new Date(),
    pdfUri,
    rawText: text,
  };
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

  // Extract text from PDF
  const text = await extractTextFromPDF(file);

  // Parse the text into structured data using AI
  return parseScheduleText(text, pdfUri);
}
