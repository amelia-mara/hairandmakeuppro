import * as pdfjsLib from 'pdfjs-dist';
import type { CallSheet, CallSheetScene, CastCall, SupportingArtistCall } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { callAI } from '@/services/aiService';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Enable debug logging for call sheet parsing
const DEBUG_CALLSHEET_PARSER = false;

function debugLog(...args: any[]) {
  if (DEBUG_CALLSHEET_PARSER) {
    console.log('[CallSheetParser]', ...args);
  }
}

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
    fullText += pageText + '\n';
  }

  return fullText;
}

/**
 * Parse extracted text into a structured CallSheet object using AI
 * This handles varying call sheet formats from different ADs/productions
 */
async function parseCallSheetText(text: string, pdfUri?: string): Promise<CallSheet> {
  const systemPrompt = `You are an expert at parsing film/TV production call sheets. Your job is to extract structured data from call sheet text that has been extracted from a PDF.

IMPORTANT: Call sheets vary significantly between productions and ADs. The text extraction may lose table structure, so look for patterns and context clues.

Common patterns to look for:
- Production day: "DAY X" or "DAY X OF Y" or "SHOOT DAY X" or "CALL SHEET X OF Y"
- Dates: Various formats like "MONDAY 24TH NOVEMBER 2025" or "24/11/25"
- Unit call time: "UNIT CALL" or "UNIT CALL TIME" followed by time
- Pre-calls: HMU, COSTUME, ADs, LIGHTING, CAMERA times (often earlier than unit call)
  - May include location like "07:45 @ UB" (at Unit Base)
- Meal times: BREAKFAST, LUNCH with times and possibly locations (HOTBOX, IN HAND, etc.)
- Wrap estimates: "EST. WRAP", "CAMERA WRAP", "WRAP"
- Weather: Temperature (High/Low), conditions, sunrise/sunset times
- Locations: UNIT BASE, LOCATION, LOC 1, LOC 2, CREW PARKING with addresses and What3Words (///word.word.word)
- Scene schedules: Usually in table format with scene numbers, INT/EXT, location, D/N, pages, cast numbers, timings
- Cast information: Actor names, characters, call times, H&MU times, costume times, travel, on-set times

Time formats vary: "0730", "07:30", "7:30 AM", "7.30", "08:00 AM"

Return ONLY valid JSON with no additional text or markdown.`;

  const prompt = `Parse this call sheet text and extract ALL available information including locations, weather, and timing details.

CALL SHEET TEXT:
---
${text.slice(0, 15000)}
---

Return a JSON object with this structure (include only fields that have data in the call sheet):
{
  "date": "YYYY-MM-DD format",
  "productionDay": number,
  "totalProductionDays": number or null,
  "dayType": "e.g., 10 HRS CONTINUOUS WORKING DAY, STANDARD WORKING DAY, SEMI-CONTINUOUS",
  "unitCallTime": "HH:MM 24-hour format",
  "rehearsalsTime": "HH:MM or null (REHEARSALS ON SET FOR)",
  "firstShotTime": "HH:MM or null (TO SHOOT FOR)",
  "preCalls": {
    "ads": "HH:MM or null",
    "hmu": "HH:MM or null",
    "costume": "HH:MM or null",
    "production": "HH:MM or null",
    "lighting": "HH:MM or null",
    "camera": "HH:MM or null",
    "location": "where pre-calls happen e.g., 'Unit Base', 'UB', 'On Set'"
  },
  "breakfastTime": "HH:MM or HH:MM - HH:MM",
  "breakfastLocation": "location description or null",
  "lunchTime": "HH:MM or HH:MM - HH:MM",
  "lunchLocation": "HOTBOX, IN HAND, location name, etc.",
  "cameraWrapEstimate": "HH:MM",
  "wrapEstimate": "HH:MM",
  "weather": {
    "conditions": "Overcast, Sunny, Showers, Mostly Cloudy, Scattered Showers, etc.",
    "tempHigh": number in Celsius,
    "tempLow": number in Celsius,
    "sunrise": "HH:MM",
    "sunset": "HH:MM"
  },
  "unitBase": {
    "name": "Location name",
    "address": "Full street address",
    "what3words": "///word.word.word format if present"
  },
  "shootLocations": [
    {
      "id": "LOC 1 or LOC1 or main",
      "name": "Location name",
      "address": "Full street address",
      "what3words": "///word.word.word format if present"
    }
  ],
  "crewParking": {
    "name": "Parking location name",
    "address": "Address if different from unit base",
    "notes": "Any parking instructions"
  },
  "unitNotes": ["array of important notes from UNIT NOTES section"],
  "scenes": [
    {
      "sceneNumber": "1" or "1A" (string, exactly as shown),
      "locationId": "LOC 1, LOC 2, etc. if shown",
      "setDescription": "The INT/EXT location line ONLY, e.g. 'EXT. FARMHOUSE' or 'INT. FARMHOUSE - KITCHEN'. Do NOT include the scene description here.",
      "action": "REQUIRED: The scene description/log line that describes WHAT HAPPENS in the scene. Examples: 'PETER and GWEN meet the AOKI's', 'PETER tells GWEN to go', 'PETER & GWEN watch the helicopter take off'. This is usually below the location or after a separator. Extract this for EVERY scene.",
      "dayNight": "D" or "N" or "D/N" or "D1" or "D2" or "D11" etc (from D/N column)",
      "pages": "1/8" or "2" or "1 5/8" or "1 2/8" etc (from PAGES column)",
      "cast": ["1", "2", "4"] (cast ID numbers from CAST column, as strings),
      "estimatedTime": "08:20 - 09:00 or 09:20 - 10:30 (from TIMINGS column)",
      "notes": "CRITICAL: Extract ALL notes from the NOTES column, especially HMU (hair/makeup), VFX, SFX, STUNTS notes. Format as 'HMU: description, VFX: description, SFX: description'. These are essential for continuity tracking."
    }
  ],
  "castCalls": [
    {
      "id": "1" (cast number from ID column),
      "name": "ACTOR NAME",
      "character": "CHARACTER NAME or ROLE",
      "status": "SW" or "SWF" or "W" or "WF" etc,
      "pickup": "HH:MM or null",
      "driver": "RW, LW, MINIBUS, etc. or null",
      "callTime": "HH:MM (CALL column)",
      "breakfastTime": "HH:MM (B/FAST column) or null",
      "costumeCall": "HH:MM (COSTUME column) or null",
      "hmuCall": "HH:MM (H&MU column) or null",
      "travelTime": "HH:MM (TRAVEL column) or null",
      "onSetTime": "HH:MM (ON SET column) or null",
      "notes": "any notes for this cast member"
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
- All times should be in 24-hour HH:MM format (convert "0730" to "07:30", "8:00 AM" to "08:00")
- Scene numbers should be extracted exactly as shown (may be numeric or alphanumeric like "4A", "18B")
- Extract What3Words addresses - they look like "///word.word.word" or "W3W - ///word.word.word"
- Look for LOCATION: and UNIT BASE: lines for address information
- Camera wrap and estimated wrap are often separate times
- Pre-calls may be listed as "PRE-CALLS" or "PRE CALLS" with department times
- Extract weather including conditions like "Overcast with Scattered Showers"
- If a field has no data, omit it or use null
- CRITICAL: Only extract scenes for the CURRENT shooting day. Do NOT include scenes from "ADVANCE SCHEDULE", "ADVANCE", "NEXT DAYS", or any section showing future production days. These appear at the end of call sheets and show upcoming days - ignore them completely.

SCENE DATA EXTRACTION (VERY IMPORTANT):
- The "SET & DESCRIPTION" column typically has TWO parts per scene:
  1. setDescription = The INT/EXT location line ONLY (e.g., "EXT. FARMHOUSE", "INT. FARMHOUSE - KITCHEN")
  2. action = The scene description/log line that describes WHAT HAPPENS (e.g., "PETER and GWEN meet the AOKI's", "PETER tells GWEN to go")
- CRITICAL: The "action" field MUST contain the description of what happens in the scene, NOT the location
- If the description appears on a separate line below the location, that is the "action"
- If the description appears after a dash or colon after the location, extract it as the "action"
- Examples of action: "PETER and GWEN watch the helicopter take off", "PETER tells GWEN to go", "PETER & GWEN make the poison, the house rocks"
- ALWAYS extract cast numbers from the CAST column (e.g., "1, 2, 9, 10, 14")
- ALWAYS extract notes from NOTES column, especially HMU (hair/makeup), VFX, SFX notes
- ALWAYS extract page counts and timings when available`;

  try {
    debugLog('Starting AI call sheet parsing...');
    debugLog('Text length:', text.length, 'characters');

    const response = await callAI(prompt, { system: systemPrompt, maxTokens: 8000 });
    debugLog('AI response received, length:', response.length);

    // Parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in AI response:', response);
      debugLog('ERROR: No JSON found in AI response');
      throw new Error('Failed to parse call sheet - invalid AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    debugLog('JSON parsed successfully');
    debugLog('Scenes extracted:', parsed.scenes?.length || 0);
    debugLog('Cast calls extracted:', parsed.castCalls?.length || 0);

    // Log sample scene to verify extraction
    if (parsed.scenes?.length > 0) {
      const sampleScene = parsed.scenes[0];
      debugLog('Sample scene:', {
        sceneNumber: sampleScene.sceneNumber,
        setDescription: sampleScene.setDescription,
        action: sampleScene.action,
        cast: sampleScene.cast,
        estimatedTime: sampleScene.estimatedTime,
        pages: sampleScene.pages
      });
    }

    // Build the CallSheet object with defaults for missing fields
    // Filter out any "Advance Schedule" scenes that may have been extracted
    const filteredScenes = (parsed.scenes || []).filter((s: any) => {
      // Check if this scene is from an advance schedule section
      const notes = (s.notes || '').toLowerCase();

      // Skip scenes that appear to be from advance schedule sections
      if (notes.includes('advance schedule') || notes.includes('advance day')) {
        return false;
      }

      // Check if scene has a different production day marker (e.g., "DAY 12" when we're on DAY 6)
      if (s.productionDay && parsed.productionDay && s.productionDay !== parsed.productionDay) {
        return false;
      }

      return true;
    });

    const scenes: CallSheetScene[] = filteredScenes.map((s: any, index: number) => ({
      sceneNumber: String(s.sceneNumber || index + 1),
      location: s.locationId || s.location || undefined,
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
      makeupCall: c.makeupCall || c.breakfastTime || undefined,
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

    // Build preCalls if present (including lighting and camera)
    const preCalls = parsed.preCalls ? {
      ads: parsed.preCalls.ads || undefined,
      hmu: parsed.preCalls.hmu || undefined,
      costume: parsed.preCalls.costume || undefined,
      production: parsed.preCalls.production || undefined,
      lighting: parsed.preCalls.lighting || undefined,
      camera: parsed.preCalls.camera || undefined,
      location: parsed.preCalls.location || undefined,
    } : undefined;

    // Build unitBase location if present
    const unitBase = parsed.unitBase ? {
      name: parsed.unitBase.name || '',
      address: parsed.unitBase.address || undefined,
      what3words: parsed.unitBase.what3words || undefined,
      notes: parsed.unitBase.notes || undefined,
    } : undefined;

    // Build shootLocation from first shoot location or dedicated field
    // Handle both single shootLocation and array of shootLocations
    let shootLocation;
    if (parsed.shootLocation) {
      shootLocation = {
        name: parsed.shootLocation.name || '',
        address: parsed.shootLocation.address || undefined,
        what3words: parsed.shootLocation.what3words || undefined,
        notes: parsed.shootLocation.notes || undefined,
      };
    } else if (parsed.shootLocations && parsed.shootLocations.length > 0) {
      // Use first shoot location, combine others into notes
      const firstLoc = parsed.shootLocations[0];
      const otherLocs = parsed.shootLocations.slice(1);
      const otherLocsNotes = otherLocs.length > 0
        ? otherLocs.map((l: any) => `${l.id || ''}: ${l.name || ''} ${l.address || ''}`).join('; ')
        : undefined;
      shootLocation = {
        name: firstLoc.name || firstLoc.id || '',
        address: firstLoc.address || undefined,
        what3words: firstLoc.what3words || undefined,
        notes: otherLocsNotes || firstLoc.notes || undefined,
      };
    }

    // Build crewParking location if present
    const crewParking = parsed.crewParking ? {
      name: parsed.crewParking.name || 'Crew Parking',
      address: parsed.crewParking.address || undefined,
      what3words: parsed.crewParking.what3words || undefined,
      notes: parsed.crewParking.notes || undefined,
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
      lunchLocation: parsed.lunchLocation || parsed.breakfastLocation || undefined,
      cameraWrapEstimate: parsed.cameraWrapEstimate || undefined,
      wrapEstimate: parsed.wrapEstimate || undefined,
      weather,
      unitBase,
      shootLocation,
      crewParking,
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
    debugLog('ERROR: AI parsing failed, falling back to regex parser');
    debugLog('Error details:', error);
    // Fall back to basic regex parsing as a last resort
    return fallbackParseCallSheetText(text, pdfUri);
  }
}

/**
 * Fallback regex-based parser for when AI parsing fails
 * Extracts basic information that we can reasonably parse with patterns
 */
function fallbackParseCallSheetText(text: string, pdfUri?: string): CallSheet {
  debugLog('Using FALLBACK regex parser (AI parsing failed)');
  debugLog('NOTE: Fallback parser has limited extraction - cast, timing, action fields may be missing');
  // Helper to extract time in HH:MM format
  const extractTime = (match: RegExpMatchArray | null): string | undefined => {
    if (!match) return undefined;
    const hours = match[1].padStart(2, '0');
    const minutes = match[2] || '00';
    return `${hours}:${minutes}`;
  };

  // Extract production day and date
  const dayMatch = text.match(/DAY\s*(\d+)\s*(?:OF\s*(\d+))?/i);
  let productionDay = 1;
  let totalProductionDays: number | undefined;

  if (dayMatch) {
    productionDay = parseInt(dayMatch[1], 10);
    totalProductionDays = dayMatch[2] ? parseInt(dayMatch[2], 10) : undefined;
  }

  // Also try "CALL SHEET X OF Y" pattern
  const callSheetMatch = text.match(/CALL\s*SHEET\s*(\d+)\s*OF\s*(\d+)/i);
  if (callSheetMatch && !dayMatch) {
    productionDay = parseInt(callSheetMatch[1], 10);
    totalProductionDays = parseInt(callSheetMatch[2], 10);
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
  const unitCallMatch = text.match(/UNIT\s*CALL[:\s]*TIME?[:\s]*(\d{1,2})[:\.]?(\d{2})/i);
  const unitCallTime = extractTime(unitCallMatch) || '06:00';

  // Extract wrap estimates
  const wrapMatch = text.match(/(?:EST\.?\s*)?WRAP[:\s]*(\d{1,2})[:\.]?(\d{2})/i);
  const wrapEstimate = extractTime(wrapMatch);

  const cameraWrapMatch = text.match(/CAMERA\s*WRAP[:\s]*(\d{1,2})[:\.]?(\d{2})/i);
  const cameraWrapEstimate = extractTime(cameraWrapMatch);

  // Extract breakfast time
  const breakfastMatch = text.match(/BREAKFAST[:\s]*(\d{1,2})[:\.]?(\d{2})/i);
  const breakfastTime = extractTime(breakfastMatch);

  // Extract lunch time
  const lunchMatch = text.match(/(?:EST\.?\s*)?LUNCH[:\s]*(\d{1,2})[:\.]?(\d{2})/i);
  const lunchTime = extractTime(lunchMatch);

  // Extract weather info
  let weather;
  const tempHighMatch = text.match(/(?:HIGH|TEMP)[:\s]*(\d+)\s*[°]?/i);
  const tempLowMatch = text.match(/LOW[:\s]*(\d+)\s*[°]?/i);
  const sunriseMatch = text.match(/(?:SUN\s*)?RISE[S]?[:\s]*(\d{1,2})[:\.]?(\d{2})/i);
  const sunsetMatch = text.match(/(?:SUN\s*)?SET[S]?[:\s]*(\d{1,2})[:\.]?(\d{2})/i);
  const conditionsMatch = text.match(/WEATHER[:\s]*([A-Za-z\s,]+?)(?:\s*(?:TEMP|HIGH|LOW|\d))/i);

  if (tempHighMatch || tempLowMatch || sunriseMatch || sunsetMatch) {
    weather = {
      conditions: conditionsMatch ? conditionsMatch[1].trim() : undefined,
      tempHigh: tempHighMatch ? parseInt(tempHighMatch[1], 10) : undefined,
      tempLow: tempLowMatch ? parseInt(tempLowMatch[1], 10) : undefined,
      sunrise: extractTime(sunriseMatch),
      sunset: extractTime(sunsetMatch),
    };
  }

  // Extract pre-calls
  let preCalls;
  const hmuPreCallMatch = text.match(/HMU[:\s]*(\d{1,2})[:\.]?(\d{2})/i);
  const costumePreCallMatch = text.match(/COSTUME[:\s]*(\d{1,2})[:\.]?(\d{2})/i);
  const adsPreCallMatch = text.match(/ADs?[:\s]*(\d{1,2})[:\.]?(\d{2})/i);

  if (hmuPreCallMatch || costumePreCallMatch || adsPreCallMatch) {
    preCalls = {
      hmu: extractTime(hmuPreCallMatch),
      costume: extractTime(costumePreCallMatch),
      ads: extractTime(adsPreCallMatch),
    };
  }

  // Extract location info
  let unitBase;
  const locationMatch = text.match(/(?:LOCATION|UNIT\s*BASE)[:\s]*([^,\n]+(?:,[^,\n]+)*)/i);
  const what3wordsMatch = text.match(/(?:W3W|what3words)[:\s-]*\/\/\/([a-z]+\.[a-z]+\.[a-z]+)/i);

  if (locationMatch) {
    unitBase = {
      name: locationMatch[1].trim().split(',')[0],
      address: locationMatch[1].trim(),
      what3words: what3wordsMatch ? `///${what3wordsMatch[1]}` : undefined,
    };
  }

  // Extract scenes with a simple pattern
  // First, remove any "ADVANCE SCHEDULE" sections from the text to avoid extracting future days
  const advanceScheduleIndex = text.search(/ADVANCE\s*SCHEDULE/i);
  const textWithoutAdvance = advanceScheduleIndex > 0 ? text.slice(0, advanceScheduleIndex) : text;

  const scenes: CallSheetScene[] = [];
  const scenePattern = /(?:SC|SCENE)?\s*(\d+[A-Z]?)\s+((?:INT|EXT)[.\s/][^D\d]*?)\s*(D\d*|N\d*|D\/N)/gi;
  let sceneMatch;
  let shootOrder = 1;

  while ((sceneMatch = scenePattern.exec(textWithoutAdvance)) !== null) {
    scenes.push({
      sceneNumber: sceneMatch[1],
      setDescription: sceneMatch[2].trim(),
      dayNight: sceneMatch[3],
      shootOrder: shootOrder++,
      status: 'upcoming' as const,
    });
  }

  // Try to extract cast calls from CAST INFORMATION section
  // Look for patterns like: ID NAME CHARACTER STATUS ... with times
  const castCalls: CastCall[] = [];

  // Find the cast information section
  const castSectionMatch = text.match(/CAST\s*INFORMATION[^]*?(?=MINIBUS|TRANSPORT|DEPARTURE|ADVANCE|$)/i);
  if (castSectionMatch) {
    const castSection = castSectionMatch[0];
    debugLog('Found CAST INFORMATION section, length:', castSection.length);

    // Pattern to match cast rows: ID (number), NAME, CHARACTER/ROLE, STATUS, then times
    // Example: "1 JOHN BOYEGA PETER W 06:55 LW 07:20 07:30 07:20 07:40 08:30 08:40"
    const castRowPattern = /\b(\d{1,2})\s+([A-Z][A-Z\s.'-]+?)\s+([A-Z][A-Z\s'-]+?)\s+(SW?F?|W|WF|H|T|R|SWF?)\s+/gi;
    let castMatch;

    while ((castMatch = castRowPattern.exec(castSection)) !== null) {
      const id = castMatch[1];
      const name = castMatch[2].trim();
      const character = castMatch[3].trim();
      const status = castMatch[4];

      // Skip if name looks like a header or invalid
      if (name === 'NAME' || name === 'ID' || character === 'ROLE' || character === 'CHARACTER') {
        continue;
      }

      // Try to extract times from the rest of the line
      const restOfLine = castSection.slice(castMatch.index + castMatch[0].length, castMatch.index + 200);
      const timePattern = /(\d{1,2}:\d{2})/g;
      const times = restOfLine.match(timePattern) || [];

      castCalls.push({
        id,
        name,
        character,
        status,
        callTime: times[0] || '',
        makeupCall: times[1] || undefined,
        costumeCall: times[2] || undefined,
        hmuCall: times[3] || undefined,
        onSetTime: times[4] || undefined,
      });
    }

    debugLog('Extracted cast calls:', castCalls.length);
    if (castCalls.length > 0) {
      debugLog('Sample cast call:', castCalls[0]);
    }
  }

  // Try to match cast numbers to scenes based on common patterns
  // Look for cast numbers after scene info (e.g., "1, 2, 9, 10, 14")
  scenes.forEach((scene, index) => {
    // Search for cast numbers near this scene in the raw text
    const sceneIndex = textWithoutAdvance.indexOf(scene.sceneNumber);
    if (sceneIndex >= 0) {
      const nearbyText = textWithoutAdvance.slice(sceneIndex, sceneIndex + 500);
      // Look for a list of numbers that could be cast IDs
      const castListMatch = nearbyText.match(/(?:CAST|cast)?[:\s]*(\d+(?:\s*,\s*\d+)+)/);
      if (castListMatch) {
        const castIds = castListMatch[1].split(/\s*,\s*/).map(id => id.trim());
        scenes[index] = { ...scene, cast: castIds };
        debugLog(`Scene ${scene.sceneNumber} cast:`, castIds);
      }
    }
  });

  return {
    id: uuidv4(),
    date,
    productionDay,
    totalProductionDays,
    unitCallTime,
    breakfastTime,
    lunchTime,
    cameraWrapEstimate,
    wrapEstimate,
    weather,
    preCalls,
    unitBase,
    scenes,
    castCalls,
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
