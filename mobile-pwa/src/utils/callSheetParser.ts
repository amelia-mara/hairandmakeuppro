import * as pdfjsLib from 'pdfjs-dist';
import type { CallSheet, CallSheetScene, CastCall, SupportingArtistCall } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { callAI } from '@/services/aiService';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Extract text content from a PDF file
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

/**
 * Parse extracted text into a structured CallSheet object using AI
 * This handles varying call sheet formats from different ADs/productions
 */
export async function parseCallSheetText(text: string, pdfUri?: string): Promise<CallSheet> {
  const systemPrompt = `You are an expert at parsing film/TV production call sheets. Your job is to extract structured data from call sheet text that has been extracted from a PDF.

IMPORTANT: Call sheets vary significantly between productions and ADs. The text extraction may lose table structure, so look for patterns and context clues.

Common patterns to look for:
- Production day: "DAY X" or "DAY X OF Y" or "SHOOT DAY X"
- Dates: Various formats like "MONDAY 24TH NOVEMBER 2025" or "24/11/25"
- Unit call time: "UNIT CALL" followed by time
- Pre-calls: HMU, COSTUME, ADs times (often earlier than unit call)
- Meal times: BREAKFAST, LUNCH with times
- Wrap estimates: "EST. WRAP" or "CAMERA WRAP"
- Weather: Temperature, conditions, sunrise/sunset
- Scene schedules: Usually in table format with scene numbers, INT/EXT, location, D/N, pages, cast numbers
- Cast information: Actor names, characters, call times, H&MU times, on-set times

Time formats vary: "0730", "07:30", "7:30 AM", "7.30"

Return ONLY valid JSON with no additional text or markdown.`;

  const prompt = `Parse this call sheet text and extract all available information.

CALL SHEET TEXT:
---
${text.slice(0, 15000)}
---

Return a JSON object with this structure (include only fields that have data in the call sheet):
{
  "date": "YYYY-MM-DD format",
  "productionDay": number,
  "totalProductionDays": number or null,
  "dayType": "e.g., 10 HRS CONTINUOUS WORKING DAY",
  "unitCallTime": "HH:MM 24-hour format",
  "rehearsalsTime": "HH:MM or null",
  "firstShotTime": "HH:MM or null",
  "preCalls": {
    "ads": "HH:MM or null",
    "hmu": "HH:MM or null",
    "costume": "HH:MM or null",
    "production": "HH:MM or null"
  },
  "breakfastTime": "HH:MM - HH:MM or null",
  "lunchTime": "HH:MM or description",
  "lunchLocation": "location or null",
  "cameraWrapEstimate": "HH:MM or null",
  "wrapEstimate": "HH:MM or null",
  "weather": {
    "conditions": "Sunny, Cloudy, Rain, etc.",
    "tempHigh": number in Celsius,
    "tempLow": number in Celsius,
    "sunrise": "HH:MM",
    "sunset": "HH:MM"
  },
  "unitNotes": ["array of important notes"],
  "scenes": [
    {
      "sceneNumber": "1" or "1A" (string, exactly as shown),
      "setDescription": "INT. LOCATION - DESCRIPTION or EXT. etc",
      "dayNight": "D" or "N" or "D/N" or "D1" etc,
      "pages": "1/8" or "2" etc,
      "cast": ["1", "2", "4"] (cast numbers as strings),
      "estimatedTime": "08:20 - 09:00 or null",
      "notes": "any HMU, AV, or other notes for this scene"
    }
  ],
  "castCalls": [
    {
      "id": "1" (cast number),
      "name": "ACTOR NAME",
      "character": "CHARACTER NAME",
      "status": "SW" or "SWF" or "W" or "WF" etc,
      "pickup": "HH:MM or null",
      "callTime": "HH:MM",
      "hmuCall": "HH:MM or null",
      "costumeCall": "HH:MM or null",
      "onSetTime": "HH:MM or null"
    }
  ],
  "supportingArtists": [
    {
      "id": "SA1 or number",
      "name": "NAME",
      "designation": "Role description",
      "callTime": "HH:MM"
    }
  ]
}

IMPORTANT:
- All times should be in 24-hour HH:MM format (convert AM/PM or other formats)
- Scene numbers should be extracted exactly as shown (may be numeric or alphanumeric like "4A")
- Cast numbers in scenes should match the IDs in castCalls
- Include weather data if present
- Extract pre-call times especially for HMU (Hair & Makeup) department
- If a field has no data, omit it or use null`;

  try {
    const response = await callAI(prompt, { system: systemPrompt, maxTokens: 4000 });

    // Parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in AI response:', response);
      throw new Error('Failed to parse call sheet - invalid AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Build the CallSheet object with defaults for missing fields
    const scenes: CallSheetScene[] = (parsed.scenes || []).map((s: any, index: number) => ({
      sceneNumber: String(s.sceneNumber || index + 1),
      location: s.location || undefined,
      setDescription: s.setDescription || 'Unknown Scene',
      action: s.action || undefined,
      dayNight: s.dayNight || 'D',
      pages: s.pages || undefined,
      cast: Array.isArray(s.cast) ? s.cast.map(String) : [],
      notes: s.notes || undefined,
      estimatedTime: s.estimatedTime || undefined,
      startTime: s.startTime || undefined,
      endTime: s.endTime || undefined,
      shootOrder: index + 1,
      status: 'upcoming' as const,
    }));

    const castCalls: CastCall[] = (parsed.castCalls || []).map((c: any) => ({
      id: String(c.id || ''),
      name: c.name || '',
      character: c.character || '',
      status: c.status || 'W',
      pickup: c.pickup || undefined,
      driver: c.driver || undefined,
      callTime: c.callTime || '',
      makeupCall: c.makeupCall || undefined,
      costumeCall: c.costumeCall || undefined,
      hmuCall: c.hmuCall || undefined,
      travelTime: c.travelTime || undefined,
      onSetTime: c.onSetTime || undefined,
      notes: c.notes || undefined,
    }));

    const supportingArtists: SupportingArtistCall[] = (parsed.supportingArtists || []).map((sa: any) => ({
      id: String(sa.id || ''),
      name: sa.name || '',
      designation: sa.designation || '',
      status: sa.status || '-',
      callTime: sa.callTime || '',
      makeupCall: sa.makeupCall || undefined,
      costumeCall: sa.costumeCall || undefined,
      hmuCall: sa.hmuCall || undefined,
      travelTime: sa.travelTime || undefined,
      onSetTime: sa.onSetTime || undefined,
      notes: sa.notes || undefined,
    }));

    // Build weather object if present
    const weather = parsed.weather ? {
      conditions: parsed.weather.conditions || undefined,
      tempHigh: parsed.weather.tempHigh || undefined,
      tempLow: parsed.weather.tempLow || undefined,
      sunrise: parsed.weather.sunrise || undefined,
      sunset: parsed.weather.sunset || undefined,
    } : undefined;

    // Build preCalls if present
    const preCalls = parsed.preCalls ? {
      ads: parsed.preCalls.ads || undefined,
      hmu: parsed.preCalls.hmu || undefined,
      costume: parsed.preCalls.costume || undefined,
      production: parsed.preCalls.production || undefined,
      location: parsed.preCalls.location || undefined,
    } : undefined;

    return {
      id: uuidv4(),
      date: parsed.date || new Date().toISOString().split('T')[0],
      productionDay: parsed.productionDay || 1,
      totalProductionDays: parsed.totalProductionDays || undefined,
      dayType: parsed.dayType || undefined,
      unitCallTime: parsed.unitCallTime || '06:00',
      rehearsalsTime: parsed.rehearsalsTime || undefined,
      firstShotTime: parsed.firstShotTime || undefined,
      preCalls,
      breakfastTime: parsed.breakfastTime || undefined,
      lunchTime: parsed.lunchTime || undefined,
      lunchLocation: parsed.lunchLocation || undefined,
      cameraWrapEstimate: parsed.cameraWrapEstimate || undefined,
      wrapEstimate: parsed.wrapEstimate || undefined,
      weather,
      unitNotes: Array.isArray(parsed.unitNotes) ? parsed.unitNotes : undefined,
      scenes,
      castCalls,
      supportingArtists,
      uploadedAt: new Date(),
      pdfUri,
      rawText: text,
    };
  } catch (error) {
    console.error('AI call sheet parsing failed:', error);
    // Fall back to basic regex parsing as a last resort
    return fallbackParseCallSheetText(text, pdfUri);
  }
}

/**
 * Fallback regex-based parser for when AI parsing fails
 * Extracts basic information that we can reasonably parse with patterns
 */
function fallbackParseCallSheetText(text: string, pdfUri?: string): CallSheet {
  // Extract production day and date
  const dayMatch = text.match(/DAY\s*(\d+)\s*(?:OF\s*(\d+))?/i);
  let productionDay = 1;
  let totalProductionDays: number | undefined;

  if (dayMatch) {
    productionDay = parseInt(dayMatch[1], 10);
    totalProductionDays = dayMatch[2] ? parseInt(dayMatch[2], 10) : undefined;
  }

  // Try to extract date
  let date = new Date().toISOString().split('T')[0];
  const dateMatch = text.match(/(\d{1,2})(?:ST|ND|RD|TH)?\s*(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s*(\d{4})/i);
  if (dateMatch) {
    const months: Record<string, string> = {
      'JANUARY': '01', 'FEBRUARY': '02', 'MARCH': '03', 'APRIL': '04',
      'MAY': '05', 'JUNE': '06', 'JULY': '07', 'AUGUST': '08',
      'SEPTEMBER': '09', 'OCTOBER': '10', 'NOVEMBER': '11', 'DECEMBER': '12'
    };
    const day = dateMatch[1].padStart(2, '0');
    const month = months[dateMatch[2].toUpperCase()] || '01';
    const year = dateMatch[3];
    date = `${year}-${month}-${day}`;
  }

  // Extract unit call time
  const unitCallMatch = text.match(/UNIT\s*CALL[:\s]*(\d{1,2})[:\.]?(\d{2})/i);
  const unitCallTime = unitCallMatch
    ? `${unitCallMatch[1].padStart(2, '0')}:${unitCallMatch[2]}`
    : '06:00';

  // Extract scenes with a simple pattern
  const scenes: CallSheetScene[] = [];
  const scenePattern = /(?:SC|SCENE)?\s*(\d+[A-Z]?)\s+((?:INT|EXT)[.\s][^D\d]*?)\s*(D\d?|N\d?|D\/N)/gi;
  let sceneMatch;
  let shootOrder = 1;

  while ((sceneMatch = scenePattern.exec(text)) !== null) {
    scenes.push({
      sceneNumber: sceneMatch[1],
      setDescription: sceneMatch[2].trim(),
      dayNight: sceneMatch[3],
      shootOrder: shootOrder++,
      status: 'upcoming' as const,
    });
  }

  return {
    id: uuidv4(),
    date,
    productionDay,
    totalProductionDays,
    unitCallTime,
    scenes,
    castCalls: [],
    supportingArtists: [],
    uploadedAt: new Date(),
    pdfUri,
    rawText: text,
  };
}

/**
 * Parse a call sheet PDF file and return structured data
 */
export async function parseCallSheetPDF(file: File): Promise<CallSheet> {
  // Store PDF as data URI for later viewing
  const pdfUri = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

  // Extract text from PDF
  const text = await extractTextFromPDF(file);

  // Parse the text into structured data using AI
  return parseCallSheetText(text, pdfUri);
}
