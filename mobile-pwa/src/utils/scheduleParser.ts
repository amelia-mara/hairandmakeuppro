import * as pdfjsLib from 'pdfjs-dist';
import type {
  ProductionSchedule,
  ScheduleCastMember,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
