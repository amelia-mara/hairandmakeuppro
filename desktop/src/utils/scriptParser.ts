/**
 * Desktop Script Parser
 * Adapted from mobile-pwa/packages/shared - simplified for desktop use.
 * Handles PDF, FDX, Fountain, and plain text scripts.
 */
import * as pdfjsLib from 'pdfjs-dist';
import type { ParsedScene, DetectedCharacter } from '../types/breakdown';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

// ── PDF Text Extraction ─────────────────────────────────────────────

async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const lines: Map<number, Array<{ x: number; text: string; width: number }>> = new Map();

    for (const item of textContent.items as TextItem[]) {
      if (!item.str || item.str.trim() === '') continue;
      const y = Math.round(item.transform[5] / 2) * 2;
      const x = item.transform[4];
      if (!lines.has(y)) lines.set(y, []);
      lines.get(y)!.push({ x, text: item.str, width: item.width || 0 });
    }

    const sortedY = Array.from(lines.keys()).sort((a, b) => b - a);

    for (const y of sortedY) {
      const lineItems = lines.get(y)!;
      lineItems.sort((a, b) => a.x - b.x);

      let lineText = '';
      let lastX = 0;
      let lastWidth = 0;

      for (const item of lineItems) {
        const gap = item.x - (lastX + lastWidth);
        if (lastX > 0 && gap > 3) {
          lineText += gap > 20 ? '    ' : ' ';
        }
        lineText += item.text;
        lastX = item.x;
        lastWidth = item.width;
      }

      fullText += lineText.trimEnd() + '\n';
    }

    fullText += '\n';
  }

  return normalizeScriptText(fullText);
}

// ── FDX (Final Draft) Extraction ────────────────────────────────────

function extractTextFromFDX(xmlContent: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');
    const paragraphs = doc.querySelectorAll('Paragraph');
    let text = '';

    paragraphs.forEach((para) => {
      const type = para.getAttribute('Type');
      const textElements = para.querySelectorAll('Text');
      let paraText = '';
      textElements.forEach((el) => { paraText += el.textContent || ''; });

      if (type === 'Scene Heading') text += '\n' + paraText.trim() + '\n';
      else if (type === 'Character') text += '\n' + paraText.trim().toUpperCase() + '\n';
      else if (type === 'Dialogue') text += paraText.trim() + '\n';
      else if (type === 'Action') text += '\n' + paraText.trim() + '\n';
      else text += paraText.trim() + '\n';
    });

    return text;
  } catch {
    return xmlContent;
  }
}

// ── Text Normalization ──────────────────────────────────────────────

function normalizeScriptText(text: string): string {
  return text
    .replace(/\b(INT|EXT)\s*\n\s*\./g, '$1.')
    .replace(/\b(INT|EXT)\s*\n\s*\/\s*(INT|EXT)/g, '$1/$2')
    .replace(/CONTIN\s*\n\s*UED?/gi, 'CONTINUOUS')
    .replace(/CONT['']?D/gi, "CONT'D")
    .replace(/\(\s*V\s*\.\s*O\s*\.\s*\)/gi, '(V.O.)')
    .replace(/\(\s*O\s*\.\s*S\s*\.\s*\)/gi, '(O.S.)')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/(\d+[A-Z]?)\s+\./g, '$1.')
    .trim();
}

// ── Scene Heading Parser ────────────────────────────────────────────

interface ParsedHeading {
  sceneNumber: string | null;
  intExt: 'INT' | 'EXT' | 'INT/EXT';
  location: string;
  timeOfDay: string;
  rawSlugline: string;
  isValid: boolean;
}

function parseSceneHeadingLine(line: string): ParsedHeading {
  const trimmed = line.trim();
  const invalid: ParsedHeading = {
    sceneNumber: null, intExt: 'INT', location: '', timeOfDay: 'DAY',
    rawSlugline: trimmed, isValid: false,
  };

  if (!trimmed || trimmed.length < 5) return invalid;

  let cleanLine = trimmed.replace(/\s*\*+\s*$/, '').trim();
  let sceneNumber: string | null = null;
  let workingLine = cleanLine;

  // Extract leading scene number
  const leadingMatch = workingLine.match(/^(\d+[A-Z]{0,4})\s+/i);
  if (leadingMatch) {
    sceneNumber = leadingMatch[1].toUpperCase();
    workingLine = workingLine.slice(leadingMatch[0].length).trim();
  }

  // Extract trailing scene number
  const trailingMatch = workingLine.match(/\s+(\d+[A-Z]{0,4})\s*$/i);
  if (trailingMatch) {
    if (!sceneNumber) sceneNumber = trailingMatch[1].toUpperCase();
    workingLine = workingLine.slice(0, -trailingMatch[0].length).trim();
  }

  // Check INT/EXT pattern
  const intExtMatch = workingLine.match(/^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|INT\.?|EXT\.?)\s*/i);
  if (!intExtMatch) return invalid;

  const intExtRaw = intExtMatch[1].toUpperCase().replace(/\.$/, '');
  let intExt: 'INT' | 'EXT' | 'INT/EXT';
  if (intExtRaw.includes('/')) intExt = 'INT/EXT';
  else if (intExtRaw.startsWith('EXT')) intExt = 'EXT';
  else intExt = 'INT';

  workingLine = workingLine.slice(intExtMatch[0].length).trim();
  workingLine = workingLine.replace(/^[\.\-–—]\s*/, '').trim();

  // Extract time of day
  const timePat = /(?:\s*[-–—\.]+\s*|\s+)(DAY|NIGHT|MORNING|EVENING|AFTERNOON|DAWN|DUSK|SUNSET|SUNRISE|CONTINUOUS|CONT|LATER|SAME|SAME TIME|MOMENTS LATER)(?:\s*[-–—]?\s*(?:FLASHBACK|PRESENT|CONT(?:'D)?)?)?$/i;
  let timeOfDay = 'DAY';
  let location = workingLine;

  const timeMatch = workingLine.match(timePat);
  if (timeMatch) {
    timeOfDay = timeMatch[1].toUpperCase();
    if (timeOfDay === 'CONT') timeOfDay = 'CONTINUOUS';
    location = workingLine.slice(0, timeMatch.index).trim();
    location = location.replace(/[\s\-–—\.,]+$/, '').trim();
  } else if (workingLine.length > 0) {
    location = workingLine.replace(/[\s\-–—\.,]+$/, '').trim();
  }

  if (!location || location.length < 2) return invalid;

  return { sceneNumber, intExt, location, timeOfDay, rawSlugline: trimmed, isValid: true };
}

// ── Character Cue Detection ─────────────────────────────────────────

function isCharacterCue(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed !== trimmed.toUpperCase()) return false;
  if (trimmed.length > 50 || trimmed.length < 2) return false;

  const nonCharPatterns = [
    /^(INT\.|EXT\.|INT\/EXT|EXT\/INT|I\/E\.)/i,
    /^(CUT TO|FADE|DISSOLVE|SMASH|MATCH|WIPE)/i,
    /^(THE END|CONTINUED|MORE|\(MORE\))/i,
    /^\d+\s*$/,
    /^\s*$/,
    /^(TITLE:|SUPER:|CHYRON:|CARD:|INSERT:|INTERCUT)/i,
    /^(FLASHBACK|END FLASHBACK|DREAM SEQUENCE)/i,
    /^(BACK TO|RESUME|ANGLE ON|CLOSE ON|WIDE ON|POV)/i,
    /^(LATER|CONTINUOUS|MOMENTS LATER|SAME TIME)/i,
  ];

  for (const pat of nonCharPatterns) {
    if (pat.test(trimmed)) return false;
  }

  if (!/[A-Z]/.test(trimmed)) return false;

  const actionPatterns = [
    /^(A |AN |THE |HE |SHE |THEY |WE |IT |HIS |HER |THEIR )/,
    /^(IN THE |AT THE |ON THE |FROM THE |TO THE |INTO THE )/,
    / (IS |ARE |WAS |WERE |HAS |HAVE |THE |A |AN )/,
    /^[A-Z]+ [A-Z]+ [A-Z]+ [A-Z]+ [A-Z]+/,
    /\.$/,
    /^\d+[A-Z]?\s+/,
  ];

  for (const pat of actionPatterns) {
    if (pat.test(trimmed)) return false;
  }

  const nameWithoutParen = trimmed.replace(/\s*\(.*?\)\s*/g, '').trim();
  const wordCount = nameWithoutParen.split(/\s+/).length;
  if (wordCount > 4) return false;

  const nonCharWords = new Set([
    'HE', 'SHE', 'IT', 'WE', 'ME', 'US', 'HIM', 'HER', 'HIS', 'ITS',
    'THEY', 'THEM', 'THEIR', 'BUT', 'FOR', 'NOT', 'ALL', 'WITH', 'FROM',
    'INT', 'EXT', 'DAY', 'NIGHT', 'MORNING', 'EVENING', 'DAWN', 'DUSK',
    'CONTINUOUS', 'LATER', 'FADE', 'CUT', 'DISSOLVE', 'CONTINUED',
    'SILENCE', 'DARKNESS', 'NOTHING', 'EVERYTHING', 'SOMETHING',
    'TITLE', 'CREDIT', 'SUPER', 'CARD', 'INSERT', 'MONTAGE',
    'INTERCUT', 'FLASHBACK', 'DREAM', 'PRESENT', 'UNKNOWN',
  ]);

  if (wordCount === 1 && nonCharWords.has(nameWithoutParen)) return false;

  return nameWithoutParen.length >= 2 && nameWithoutParen.length <= 35;
}

function normalizeCharacterName(name: string): string {
  let normalized = name.toUpperCase();
  normalized = normalized.replace(/\s*\(.*?\)\s*/g, '');
  if (normalized.includes('/') && !normalized.startsWith('INT') && !normalized.startsWith('EXT')) {
    const parts = normalized.split('/');
    if (parts[0].length >= 2 && parts[0].length <= 20) {
      normalized = parts[0].trim();
    }
  }
  return normalized.replace(/\s+/g, ' ').trim();
}

// ── Main Parse Function ─────────────────────────────────────────────

export interface ParseResult {
  title: string;
  scenes: ParsedScene[];
  characters: DetectedCharacter[];
  rawText: string;
}

let idCounter = 0;
function genId(): string {
  return `scene-${Date.now()}-${++idCounter}`;
}
function genCharId(): string {
  return `char-${Date.now()}-${++idCounter}`;
}

/**
 * Fast parse: extracts scenes using regex. No AI. < 5 seconds.
 */
export function parseScriptText(text: string): ParseResult {
  const lines = text.split('\n');
  const scenes: ParsedScene[] = [];
  const characterMap = new Map<string, { name: string; sceneIds: Set<string>; sceneNumbers: string[] }>();

  let currentScene: ParsedScene | null = null;
  let fallbackNum = 0;
  let currentContent = '';
  let lastLineWasChar = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const heading = parseSceneHeadingLine(trimmed);

    if (heading.isValid) {
      // Save previous scene
      if (currentScene) {
        currentScene.scriptContent = currentContent.trim();
        scenes.push(currentScene);
      }

      fallbackNum++;
      const sceneNum = heading.sceneNumber || String(fallbackNum);
      const id = genId();

      currentScene = {
        id,
        sceneNumber: sceneNum,
        intExt: heading.intExt,
        location: heading.location,
        timeOfDay: heading.timeOfDay,
        scriptContent: '',
      };
      currentContent = trimmed + '\n';
      lastLineWasChar = false;
      continue;
    }

    if (currentScene) {
      currentContent += line + '\n';
    }

    // Detect character dialogue cues
    if (isCharacterCue(trimmed)) {
      const normalized = normalizeCharacterName(trimmed);
      if (normalized.length >= 2 && currentScene) {
        if (!characterMap.has(normalized)) {
          characterMap.set(normalized, { name: normalized, sceneIds: new Set(), sceneNumbers: [] });
        }
        const entry = characterMap.get(normalized)!;
        if (!entry.sceneIds.has(currentScene.id)) {
          entry.sceneIds.add(currentScene.id);
          entry.sceneNumbers.push(currentScene.sceneNumber);
        }
        lastLineWasChar = true;
      }
    } else {
      lastLineWasChar = false;
    }
  }

  // Save last scene
  if (currentScene) {
    currentScene.scriptContent = currentContent.trim();
    scenes.push(currentScene);
  }

  // Build characters array
  const characters: DetectedCharacter[] = Array.from(characterMap.values())
    .filter((c) => c.sceneIds.size >= 1)
    .sort((a, b) => b.sceneIds.size - a.sceneIds.size)
    .map((c) => {
      const sceneCount = c.sceneIds.size;
      let roleType: DetectedCharacter['roleType'];
      if (sceneCount >= 10) roleType = 'lead';
      else if (sceneCount >= 4) roleType = 'supporting';
      else if (sceneCount >= 2) roleType = 'day_player';
      else roleType = 'extra';

      return {
        id: genCharId(),
        name: c.name,
        sceneCount,
        roleType,
        scenes: Array.from(c.sceneIds),
      };
    });

  // Extract title
  const titleMatch = text.slice(0, 1000).match(/^(?:title[:\s]*)?([A-Z][A-Z\s\d\-'"]+)(?:\n|by)/im);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Script';

  return { title, scenes, characters, rawText: text };
}

// ── File Reading ────────────────────────────────────────────────────

/**
 * Read a script file (PDF, FDX, Fountain, TXT) and extract text.
 */
export async function readScriptFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.pdf')) {
    return extractTextFromPDF(file);
  } else if (name.endsWith('.fdx')) {
    const xml = await file.text();
    return extractTextFromFDX(xml);
  } else {
    return file.text();
  }
}

/**
 * Full parse pipeline: read file → extract text → parse scenes + characters.
 */
export async function parseScriptFile(
  file: File,
  onProgress?: (msg: string) => void,
): Promise<ParseResult> {
  onProgress?.('Reading document...');
  const text = await readScriptFile(file);

  onProgress?.('Extracting scenes...');
  const result = parseScriptText(text);

  onProgress?.(`Found ${result.scenes.length} scenes and ${result.characters.length} characters`);
  return result;
}
