import * as pdfjsLib from 'pdfjs-dist';
import type { CallSheet, CallSheetScene, CastCall, SupportingArtistCall } from '@/types';
import { v4 as uuidv4 } from 'uuid';

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
 * Parse extracted text into a structured CallSheet object
 */
export function parseCallSheetText(text: string, pdfUri?: string): CallSheet {
  // Extract production day and date
  const dayMatch = text.match(/DAY\s*(\d+)\s*(?:OF\s*(\d+))?\s*\|\s*(\w+)\s+(\d+)(?:ST|ND|RD|TH)?\s+(\w+)\s+(\d{4})/i);
  let productionDay = 1;
  let totalProductionDays: number | undefined;
  let date = new Date().toISOString().split('T')[0];

  if (dayMatch) {
    productionDay = parseInt(dayMatch[1], 10);
    totalProductionDays = dayMatch[2] ? parseInt(dayMatch[2], 10) : undefined;
    // Parse date - format: "MONDAY 24TH NOVEMBER 2025"
    const months: Record<string, string> = {
      'JANUARY': '01', 'FEBRUARY': '02', 'MARCH': '03', 'APRIL': '04',
      'MAY': '05', 'JUNE': '06', 'JULY': '07', 'AUGUST': '08',
      'SEPTEMBER': '09', 'OCTOBER': '10', 'NOVEMBER': '11', 'DECEMBER': '12'
    };
    const day = dayMatch[4].padStart(2, '0');
    const month = months[dayMatch[5].toUpperCase()] || '01';
    const year = dayMatch[6];
    date = `${year}-${month}-${day}`;
  }

  // Extract day type (e.g., "10 HRS CONTINUOUS WORKING DAY")
  const dayTypeMatch = text.match(/SHOOT DAY\s*\|\s*(.+?)(?:\n|$)/i);
  const dayType = dayTypeMatch ? dayTypeMatch[1].trim() : undefined;

  // Extract unit call time
  const unitCallMatch = text.match(/UNIT CALL TIME[:\s]*(\d{1,2}:\d{2})\s*(AM|PM)?/i);
  const unitCallTime = unitCallMatch
    ? formatTime(unitCallMatch[1], unitCallMatch[2])
    : '06:00';

  // Extract rehearsals and first shot times
  const rehearsalsMatch = text.match(/REHEARSALS\s*(?:ON SET)?\s*(?:FOR)?[:\s]*(\d{1,2}:\d{2})/i);
  const firstShotMatch = text.match(/TO SHOOT FOR[:\s]*(\d{1,2}:\d{2})/i);

  // Extract pre-calls
  const preCallsMatch = text.match(/PRE-CALLS.*?ADs?[:\s]*(\d{1,2}:\d{2}).*?HMU[:\s]*(\d{1,2}:\d{2}).*?COSTUME[:\s]*(\d{1,2}:\d{2}).*?PRODUCTION[:\s]*(\d{1,2}:\d{2})/i);
  const preCalls = preCallsMatch ? {
    ads: preCallsMatch[1],
    hmu: preCallsMatch[2],
    costume: preCallsMatch[3],
    production: preCallsMatch[4],
  } : undefined;

  // Extract meal times
  const breakfastMatch = text.match(/BREAKFAST[:\s]*(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})/i);
  const lunchMatch = text.match(/LUNCH.*?(\d{1,2}:\d{2}(?:\s*(?:ONWARDS|-))?)/i);
  const lunchLocationMatch = text.match(/LUNCH\s*\(([^)]+)\)/i);

  // Extract wrap estimates
  const cameraWrapMatch = text.match(/(?:EST\.?\s*)?CAMERA\s*WRAP[:\s]*(\d{1,2}:\d{2})/i);
  const wrapMatch = text.match(/(?:EST\.?\s*)?WRAP[:\s]*(\d{1,2}:\d{2})/i);

  // Extract weather
  const weatherConditionsMatch = text.match(/WEATHER[:\s]*([A-Za-z\s]+?)(?:\n|High)/i);
  const tempHighMatch = text.match(/High[:\s]*(\d+)[°]?c/i);
  const tempLowMatch = text.match(/Low[:\s]*(\d+)[°]?c/i);
  const sunriseMatch = text.match(/Sunrise[:\s]*(\d{1,2}:\d{2})/i);
  const sunsetMatch = text.match(/Sunset[:\s]*(\d{1,2}:\d{2})/i);

  const weather = (weatherConditionsMatch || tempHighMatch || tempLowMatch) ? {
    conditions: weatherConditionsMatch ? weatherConditionsMatch[1].trim() : undefined,
    tempHigh: tempHighMatch ? parseInt(tempHighMatch[1], 10) : undefined,
    tempLow: tempLowMatch ? parseInt(tempLowMatch[1], 10) : undefined,
    sunrise: sunriseMatch ? sunriseMatch[1] : undefined,
    sunset: sunsetMatch ? sunsetMatch[1] : undefined,
  } : undefined;

  // Extract unit notes
  const unitNotesMatch = text.match(/UNIT NOTES([\s\S]*?)(?=LOCATION|SCENE|$)/i);
  const unitNotes = unitNotesMatch
    ? unitNotesMatch[1]
        .split(/\n/)
        .map(n => n.trim())
        .filter(n => n.length > 5)
    : undefined;

  // Extract scenes from schedule table
  const scenes = parseSceneSchedule(text);

  // Extract cast calls
  const castCalls = parseCastCalls(text);

  // Extract supporting artists
  const supportingArtists = parseSupportingArtists(text);

  return {
    id: uuidv4(),
    date,
    productionDay,
    totalProductionDays,
    dayType,
    unitCallTime,
    rehearsalsTime: rehearsalsMatch ? rehearsalsMatch[1] : undefined,
    firstShotTime: firstShotMatch ? firstShotMatch[1] : undefined,
    preCalls,
    breakfastTime: breakfastMatch ? breakfastMatch[1] : undefined,
    lunchTime: lunchMatch ? lunchMatch[1] : undefined,
    lunchLocation: lunchLocationMatch ? lunchLocationMatch[1] : undefined,
    cameraWrapEstimate: cameraWrapMatch ? cameraWrapMatch[1] : undefined,
    wrapEstimate: wrapMatch ? wrapMatch[1] : undefined,
    weather,
    unitNotes,
    scenes,
    castCalls,
    supportingArtists,
    uploadedAt: new Date(),
    pdfUri,
    rawText: text,
  };
}

/**
 * Parse scene schedule from call sheet text
 */
function parseSceneSchedule(text: string): CallSheetScene[] {
  const scenes: CallSheetScene[] = [];
  let shootOrder = 1;

  // Try a more structured approach - look for the scene table section
  const scheduleSection = text.match(/LOCATION\s*SCENE\s*SET\s*&\s*DESCRIPTION([\s\S]*?)(?:LUNCH|CAST INFORMATION|$)/i);

  if (scheduleSection) {
    const tableText = scheduleSection[1];

    // Split by common row indicators
    const rows = tableText.split(/(?=LOC\d|SC\s*\d)/i);

    for (const row of rows) {
      // Parse each row
      const locMatch = row.match(/LOC(\d*)/i);
      const sceneMatch = row.match(/(?:LOC\d*|SC)\s*(\d+[A-Z]?)/i);
      const setMatch = row.match(/((?:INT|EXT)\.?\s*[A-Z\s\-\.]+?)(?=\s*D\d|\s*N\d|\s*D\/N)/i);
      const dayNightMatch = row.match(/\s(D\d*|N\d*|D\/N)\s/i);
      const pagesMatch = row.match(/\s(\d+\s*\/?\s*8|\d+)\s/);
      const castMatch = row.match(/(\d+(?:\s*,\s*\d+)*)/);
      const timeMatch = row.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);

      // Look for HMU notes
      const hmuMatch = row.match(/HMU[:\s]*([^|]+?)(?=\d{1,2}:\d{2}|$)/i);
      const avMatch = row.match(/AV[:\s]*([^|]+?)(?=Notes|HMU|\d{1,2}:\d{2}|$)/i);

      if (sceneMatch && setMatch) {
        const notes = [
          avMatch ? `AV: ${avMatch[1].trim()}` : '',
          hmuMatch ? `HMU: ${hmuMatch[1].trim()}` : '',
        ].filter(Boolean).join(' | ');

        scenes.push({
          sceneNumber: sceneMatch[1],
          location: locMatch ? `LOC${locMatch[1]}` : undefined,
          setDescription: setMatch[1].trim(),
          dayNight: dayNightMatch ? dayNightMatch[1] : 'D',
          pages: pagesMatch ? pagesMatch[1].replace(/\s/g, '') : undefined,
          cast: castMatch
            ? castMatch[1].split(/\s*,\s*/).filter(Boolean)
            : [],
          notes: notes || undefined,
          startTime: timeMatch ? timeMatch[1] : undefined,
          endTime: timeMatch ? timeMatch[2] : undefined,
          estimatedTime: timeMatch ? `${timeMatch[1]} - ${timeMatch[2]}` : undefined,
          shootOrder: shootOrder++,
          status: 'upcoming' as const,
        });
      }
    }
  }

  // If no scenes found, try a simpler pattern
  if (scenes.length === 0) {
    const simplePattern = /(\d+[A-Z]?)\s+((?:INT|EXT)\.?\s*[A-Z\s\-]+)/gi;
    let simpleMatch;
    while ((simpleMatch = simplePattern.exec(text)) !== null) {
      scenes.push({
        sceneNumber: simpleMatch[1],
        setDescription: simpleMatch[2].trim(),
        dayNight: 'D',
        shootOrder: shootOrder++,
        status: 'upcoming' as const,
      });
    }
  }

  return scenes;
}

/**
 * Parse cast call information
 */
function parseCastCalls(text: string): CastCall[] {
  const castCalls: CastCall[] = [];

  // Look for cast information section
  const castSection = text.match(/CAST INFORMATION.*?TO REPORT TO UNIT BASE([\s\S]*?)(?:OTHER CAST|SA INFORMATION|SUPPORTING|MINIBUS|$)/i);

  if (castSection) {
    const rows = castSection[1].split(/\n/).filter(l => l.trim());

    for (const row of rows) {
      // Pattern: ID  NAME  CHARACTER  STATUS  PICKUP  DRIVER  CALL  B/FAST  COSTUME  H&MU  TRAVEL  ON SET  NOTES
      const match = row.match(/(\d+)\s+([A-Z\s]+?)\s+([A-Z\s]+?)\s+(SW|SWF|W|WF|H|T|R)\s+(\d{1,2}:\d{2})?\s*(\w+)?\s*(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})?\s*(\d{1,2}:\d{2}\s*[A-Z]?)?\s*(\d{1,2}:\d{2}\s*[A-Z]?)?\s*(\d{1,2}:\d{2})?\s*(\d{1,2}:\d{2})?/i);

      if (match) {
        castCalls.push({
          id: match[1],
          name: match[2].trim(),
          character: match[3].trim(),
          status: match[4] as CastCall['status'],
          pickup: match[5],
          driver: match[6],
          callTime: match[7],
          makeupCall: match[8],
          costumeCall: match[9],
          hmuCall: match[10],
          travelTime: match[11],
          onSetTime: match[12],
        });
      }
    }
  }

  return castCalls;
}

/**
 * Parse supporting artist calls
 */
function parseSupportingArtists(text: string): SupportingArtistCall[] {
  const saList: SupportingArtistCall[] = [];

  // Look for SA information section
  const saSection = text.match(/SA INFORMATION.*?TO REPORT([\s\S]*?)(?:MINIBUS|DEPARTURE|$)/i);

  if (saSection) {
    const rows = saSection[1].split(/\n/).filter(l => l.trim());

    for (const row of rows) {
      const match = row.match(/(\d+)\s+([A-Z\s]+?)\s+([A-Z\s]+?)\s+(SW|SWF|W|WF|H|T|R|-)?\s*(\d{1,2}:\d{2})/i);

      if (match) {
        saList.push({
          id: match[1],
          name: match[2].trim(),
          designation: match[3].trim(),
          status: match[4] || '-',
          callTime: match[5],
        });
      }
    }
  }

  return saList;
}

/**
 * Format time to 24-hour format
 */
function formatTime(time: string, ampm?: string): string {
  if (!ampm) return time;

  const [hours, minutes] = time.split(':').map(Number);
  let hour24 = hours;

  if (ampm.toUpperCase() === 'PM' && hours !== 12) {
    hour24 = hours + 12;
  } else if (ampm.toUpperCase() === 'AM' && hours === 12) {
    hour24 = 0;
  }

  return `${hour24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
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

  // Parse the text into structured data
  return parseCallSheetText(text, pdfUri);
}
