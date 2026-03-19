/**
 * Schedule PDF parser — ported from mobile-pwa
 * Stage 1: extracts cast list, day count, production metadata, and stores PDF
 */
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import type { ProductionSchedule, ScheduleCastMember } from '@/stores/scheduleStore';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface ParseResult {
  schedule: ProductionSchedule;
  rawText: string;
}

/**
 * Parse a schedule PDF — extracts cast list, day count, metadata, thumbnail
 */
export async function parseSchedulePDF(file: File): Promise<ParseResult> {
  // Read PDF as data URI
  const pdfUri = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });

  const text = await extractTextFromPDF(file);
  const castList = extractCastListFast(text);
  const { totalDays } = extractDayCountAndBlocks(text);
  const metadata = extractMetadata(text);

  const schedule: ProductionSchedule = {
    id: crypto.randomUUID(),
    productionName: metadata.productionName,
    scriptVersion: metadata.scriptVersion,
    scheduleVersion: metadata.scheduleVersion,
    status: 'pending',
    castList,
    days: [],
    totalDays,
    uploadedAt: new Date().toISOString(),
    pdfUri,
    rawText: text,
  };

  return { schedule, rawText: text };
}

/**
 * Generate a thumbnail image (PNG data URI) from the first page of a PDF data URI
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

/* ━━━ Day count ━━━ */

function extractDayCountAndBlocks(text: string): { totalDays: number; dayTextBlocks: string[] } {
  const dayTextBlocks: string[] = [];
  const endOfDayPattern = /End of Shooting Day\s+(\d+)/gi;
  const dayMarkers: { dayNum: number; endPos: number }[] = [];
  let match;

  while ((match = endOfDayPattern.exec(text)) !== null) {
    const dayNum = parseInt(match[1], 10);
    if (!dayMarkers.find((d) => d.dayNum === dayNum)) {
      dayMarkers.push({ dayNum, endPos: match.index + match[0].length });
    }
  }

  dayMarkers.sort((a, b) => a.endPos - b.endPos);
  let totalDays = 0;
  for (let i = 0; i < dayMarkers.length; i++) {
    const marker = dayMarkers[i];
    const prevEndPos = i > 0 ? dayMarkers[i - 1].endPos : 0;
    dayTextBlocks.push(text.slice(prevEndPos, marker.endPos + 200));
    totalDays = Math.max(totalDays, marker.dayNum);
  }

  if (dayMarkers.length === 0) {
    const dayHeaderPattern = /(?:^|\n)(?:Shooting\s+)?Day\s+(\d+)/gi;
    while ((match = dayHeaderPattern.exec(text)) !== null) {
      totalDays = Math.max(totalDays, parseInt(match[1], 10));
    }
  }

  return { totalDays, dayTextBlocks };
}

/* ━━━ Metadata ━━━ */

function extractMetadata(text: string): { productionName?: string; scriptVersion?: string; scheduleVersion?: string } {
  const firstPage = text.slice(0, 2000);
  const prodMatch = firstPage.match(/^[A-Z][A-Z\s\-']+(?=\s*\n)/m);
  const scriptMatch = firstPage.match(/(?:Script|Draft)[:\s]*([A-Za-z]+\s*\d*)/i);
  const scheduleMatch = firstPage.match(/(?:Schedule|Version)[:\s]*([A-Za-z0-9\s\-/]+)/i);

  return {
    productionName: prodMatch ? prodMatch[0].trim() : undefined,
    scriptVersion: scriptMatch ? scriptMatch[1].trim() : undefined,
    scheduleVersion: scheduleMatch ? scheduleMatch[1].trim() : undefined,
  };
}

/* ━━━ Cast list extraction ━━━ */

function extractCastListFast(text: string): ScheduleCastMember[] {
  const castList: ScheduleCastMember[] = [];
  const castSection = text.slice(0, 15000);

  const castHeaderPatterns = [
    /(?:CAST\s*LIST|CAST\s*MEMBERS?|CAST|CHARACTERS?)[:\s]*\n([\s\S]*?)(?=\n\s*\n\s*\n|SHOOTING\s*DAY|END\s*OF|DAY\s+\d|=== PAGE)/i,
    /(?:CAST\s*LIST|CAST\s*MEMBERS?|CAST|CHARACTERS?)[:\s]*\n([\s\S]*?)(?=\n[A-Z]{3,}\s*\n|\nSCENE|\nDAY\b)/i,
  ];

  for (const headerPattern of castHeaderPatterns) {
    const castSectionMatch = castSection.match(headerPattern);
    if (castSectionMatch) {
      const castBlock = castSectionMatch[1];
      const castLinePattern = /(\d{1,3})\s*[.\-)\]:]?\s*([A-Z][A-Za-z'\-.\s]{1,30})/g;
      let m;
      while ((m = castLinePattern.exec(castBlock)) !== null) {
        addCastMember(castList, m[1], m[2]);
      }
      if (castList.length >= 2) break;
    }
  }

  const pattern1 = /(?:^|\n|\t)\s*(\d{1,3})\s*[.\-)\]:]\s*([A-Z][A-Za-z'\-.\s]{1,30}?)(?=\s*\n|\s*\t|\s{3,})/gm;
  let match;
  while ((match = pattern1.exec(castSection)) !== null) addCastMember(castList, match[1], match[2]);

  const pattern2 = /(?:^|\n)\s*(\d{1,3})[\t\s]{2,}([A-Z][A-Za-z'\-.\s]{1,30}?)(?=\s*[\t\n]|\s{3,}|$)/gm;
  while ((match = pattern2.exec(castSection)) !== null) addCastMember(castList, match[1], match[2]);

  const pattern3 = /\((\d{1,3})\)\s*([A-Z][A-Za-z'\-.\s]{1,30}?)(?=\s*\n|\s*\t|\s{3,})/gm;
  while ((match = pattern3.exec(castSection)) !== null) addCastMember(castList, match[1], match[2]);

  if (castList.length < 3) {
    const candidatePattern = /(?:^|\n|\t)\s*(\d{1,2})\s*[.\-)\]:]\s*([A-Z][A-Za-z'\-.\s]{2,25})/gm;
    const candidates: Array<{ num: string; name: string; count: number }> = [];
    while ((match = candidatePattern.exec(text.slice(0, 20000))) !== null) {
      const name = match[2].trim();
      const nameRegex = new RegExp(`\\b${escapeRe(name.split(' ')[0])}\\b`, 'gi');
      const occurrences = (text.match(nameRegex) || []).length;
      if (occurrences >= 2) candidates.push({ num: match[1], name, count: occurrences });
    }
    candidates.sort((a, b) => b.count - a.count);
    for (const c of candidates) addCastMember(castList, c.num, c.name);
  }

  castList.sort((a, b) => a.number - b.number);
  return castList;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addCastMember(list: ScheduleCastMember[], numStr: string, nameStr: string) {
  const num = parseInt(numStr, 10);
  let name = nameStr.trim().replace(/\s+/g, ' ').replace(/[.,;:]+$/, '').trim();
  if (num <= 0 || num > 200) return;
  if (name.length < 2 || name.length > 30) return;
  if (/^(INT|EXT|DAY|NIGHT|MORNING|HOURS|PAGE|SCENE|EST|TIME|CALL|UNIT|SET|LOC|END|TOTAL|SHOOT)/i.test(name)) return;
  if (/^\d+$/.test(name) || /^\d{1,2}[:/]\d{2}/.test(name)) return;
  if (list.find((c) => c.number === num)) return;
  name = name.toUpperCase();
  list.push({ number: num, name });
}
