import * as pdfjsLib from 'pdfjs-dist';
import type { Scene, Character } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { parseScriptWithAI, checkAIAvailability } from '@/services/aiService';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ParsedScript {
  title: string;
  scenes: ParsedScene[];
  characters: ParsedCharacter[];
  rawText: string;
}

export interface ParsedScene {
  sceneNumber: string;
  slugline: string;
  intExt: 'INT' | 'EXT';
  location: string;
  timeOfDay: 'DAY' | 'NIGHT' | 'MORNING' | 'EVENING' | 'CONTINUOUS';
  characters: string[]; // Character names appearing in scene
  content: string;
  synopsis?: string;
}

export interface ParsedCharacter {
  name: string;
  normalizedName: string;
  sceneCount: number;
  dialogueCount: number;
  scenes: string[]; // Scene numbers where character appears
  variants: string[]; // Name variations found (e.g., "JOHN", "JOHN (V.O.)")
  description?: string;
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

/**
 * Extract text content from a PDF file with improved line structure preservation
 * Groups text items by Y position to reconstruct lines properly
 */
async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Group text items by Y position (line-by-line reconstruction)
    const lines: Map<number, Array<{ x: number; text: string; width: number }>> = new Map();

    for (const item of textContent.items as TextItem[]) {
      if (!item.str || item.str.trim() === '') continue;

      // Round Y position to group items on the same line (allow 2px tolerance)
      const y = Math.round(item.transform[5] / 2) * 2;
      const x = item.transform[4];

      if (!lines.has(y)) {
        lines.set(y, []);
      }
      lines.get(y)!.push({ x, text: item.str, width: item.width || 0 });
    }

    // Sort lines by Y position (top to bottom, so descending Y)
    const sortedYPositions = Array.from(lines.keys()).sort((a, b) => b - a);

    for (const y of sortedYPositions) {
      const lineItems = lines.get(y)!;
      // Sort items within line by X position (left to right)
      lineItems.sort((a, b) => a.x - b.x);

      // Reconstruct line with proper spacing
      let lineText = '';
      let lastX = 0;
      let lastWidth = 0;

      for (const item of lineItems) {
        // Calculate gap between items
        const gap = item.x - (lastX + lastWidth);

        // Add spaces for significant gaps (indicates word separation)
        if (lastX > 0 && gap > 3) {
          // Large gap might indicate tab/column separation
          if (gap > 20) {
            lineText += '    '; // Tab-like spacing
          } else {
            lineText += ' ';
          }
        }

        lineText += item.text;
        lastX = item.x;
        lastWidth = item.width;
      }

      fullText += lineText.trimEnd() + '\n';
    }

    fullText += '\n'; // Page break
  }

  // Normalize the text for better script parsing
  return normalizeScriptText(fullText);
}

/**
 * Normalize script text to fix common PDF extraction issues
 */
function normalizeScriptText(text: string): string {
  return text
    // Fix split INT/EXT headings (e.g., "INT" on one line, ". LOCATION" on next)
    .replace(/\b(INT|EXT)\s*\n\s*\./g, '$1.')
    .replace(/\b(INT|EXT)\s*\n\s*\/\s*(INT|EXT)/g, '$1/$2')
    // Fix split CONTINUOUS
    .replace(/CONTIN\s*\n\s*UED?/gi, 'CONTINUOUS')
    .replace(/CONT['']?D/gi, "CONT'D")
    // Fix split character names with (V.O.) or (O.S.)
    .replace(/\(\s*V\s*\.\s*O\s*\.\s*\)/gi, '(V.O.)')
    .replace(/\(\s*O\s*\.\s*S\s*\.\s*\)/gi, '(O.S.)')
    // Normalize multiple spaces
    .replace(/[ \t]+/g, ' ')
    // Normalize multiple newlines (but keep paragraph breaks)
    .replace(/\n{4,}/g, '\n\n\n')
    // Clean up scene number patterns like "1 ." -> "1."
    .replace(/(\d+[A-Z]?)\s+\./g, '$1.')
    .trim();
}

/**
 * Extract text from Final Draft XML (FDX) format
 */
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

      textElements.forEach((textEl) => {
        paraText += textEl.textContent || '';
      });

      // Format based on type
      if (type === 'Scene Heading') {
        text += '\n' + paraText.trim() + '\n';
      } else if (type === 'Character') {
        text += '\n' + paraText.trim().toUpperCase() + '\n';
      } else if (type === 'Dialogue') {
        text += paraText.trim() + '\n';
      } else if (type === 'Action') {
        text += '\n' + paraText.trim() + '\n';
      } else {
        text += paraText.trim() + '\n';
      }
    });

    return text;
  } catch (e) {
    console.error('Error parsing FDX:', e);
    return xmlContent;
  }
}

/**
 * Parse time of day from scene heading
 */
function parseTimeOfDay(text: string): 'DAY' | 'NIGHT' | 'MORNING' | 'EVENING' | 'CONTINUOUS' {
  const upper = text.toUpperCase();
  if (upper.includes('NIGHT')) return 'NIGHT';
  if (upper.includes('MORNING')) return 'MORNING';
  if (upper.includes('EVENING') || upper.includes('DUSK') || upper.includes('SUNSET')) return 'EVENING';
  if (upper.includes('CONTINUOUS') || upper.includes('CONT')) return 'CONTINUOUS';
  return 'DAY';
}

/**
 * Parse INT/EXT from scene heading
 */
function parseIntExt(text: string): 'INT' | 'EXT' {
  const upper = text.toUpperCase().trim();
  if (upper.startsWith('EXT')) return 'EXT';
  return 'INT';
}

/**
 * Extract location from scene heading
 */
function parseLocation(slugline: string): string {
  // Remove INT./EXT. prefix
  let location = slugline.replace(/^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|INT\.?|EXT\.?)\s*/i, '');

  // Remove time of day suffix
  location = location.replace(/\s*[-–—]\s*(DAY|NIGHT|MORNING|EVENING|DUSK|DAWN|SUNSET|SUNRISE|CONTINUOUS|CONT|LATER|SAME|MOMENTS LATER).*$/i, '');

  return location.trim();
}

/**
 * Normalize character name for comparison
 */
function normalizeCharacterName(name: string): string {
  return name
    .toUpperCase()
    .replace(/\s*\(.*?\)\s*/g, '') // Remove parentheticals (V.O.), (O.S.), (CONT'D)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a line is a character cue (character name before dialogue)
 */
function isCharacterCue(line: string): boolean {
  const trimmed = line.trim();

  // Character cues are typically uppercase
  if (trimmed !== trimmed.toUpperCase()) return false;

  // Should be short (character names aren't long sentences)
  if (trimmed.length > 50) return false;

  // Should not start with common non-character patterns
  const nonCharPatterns = [
    /^(INT\.|EXT\.|INT\/EXT|EXT\/INT)/i,
    /^(CUT TO|FADE|DISSOLVE|SMASH|MATCH)/i,
    /^(THE END|CONTINUED|MORE)/i,
    /^\d+\s*$/,
    /^\s*$/,
  ];

  for (const pattern of nonCharPatterns) {
    if (pattern.test(trimmed)) return false;
  }

  // Should contain at least one letter
  if (!/[A-Z]/.test(trimmed)) return false;

  // Allow parentheticals like (V.O.), (O.S.), (CONT'D)
  const nameWithoutParen = trimmed.replace(/\s*\(.*?\)\s*/g, '').trim();

  // Character names should be reasonably short
  return nameWithoutParen.length >= 2 && nameWithoutParen.length <= 30;
}

/**
 * Check if a line is a scene heading
 */
function isSceneHeading(line: string): boolean {
  const trimmed = line.trim().toUpperCase();
  return /^(INT\.?|EXT\.?|INT\.?\/EXT\.?|EXT\.?\/INT\.?)(\s|$)/.test(trimmed);
}

/**
 * Parse script text to extract scenes and characters
 */
export function parseScriptText(text: string): ParsedScript {
  const lines = text.split('\n');
  const scenes: ParsedScene[] = [];
  const characterMap = new Map<string, ParsedCharacter>();

  let currentScene: ParsedScene | null = null;
  let sceneNumber = 0;
  let currentSceneContent = '';
  let lastLineWasCharacter = false;
  let dialogueCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for scene heading
    if (isSceneHeading(trimmed)) {
      // Save previous scene
      if (currentScene) {
        currentScene.content = currentSceneContent.trim();
        scenes.push(currentScene);
      }

      sceneNumber++;
      const sceneNum = String(sceneNumber);

      currentScene = {
        sceneNumber: sceneNum,
        slugline: trimmed,
        intExt: parseIntExt(trimmed),
        location: parseLocation(trimmed),
        timeOfDay: parseTimeOfDay(trimmed),
        characters: [],
        content: '',
      };
      currentSceneContent = trimmed + '\n';
      lastLineWasCharacter = false;
      continue;
    }

    // Add to current scene content
    if (currentScene) {
      currentSceneContent += line + '\n';
    }

    // Check for character cue
    if (isCharacterCue(trimmed)) {
      const charName = trimmed;
      const normalized = normalizeCharacterName(charName);

      if (normalized.length >= 2) {
        // Add to scene's characters
        if (currentScene && !currentScene.characters.includes(normalized)) {
          currentScene.characters.push(normalized);
        }

        // Add to character map
        if (!characterMap.has(normalized)) {
          characterMap.set(normalized, {
            name: normalized,
            normalizedName: normalized,
            sceneCount: 0,
            dialogueCount: 0,
            scenes: [],
            variants: [],
          });
        }

        const char = characterMap.get(normalized)!;

        // Track variant names
        if (!char.variants.includes(charName)) {
          char.variants.push(charName);
        }

        // Track scenes
        if (currentScene && !char.scenes.includes(currentScene.sceneNumber)) {
          char.scenes.push(currentScene.sceneNumber);
          char.sceneCount++;
        }

        lastLineWasCharacter = true;
        dialogueCount = 0;
      }
    } else if (lastLineWasCharacter && trimmed.length > 0) {
      // This is dialogue following a character cue
      dialogueCount++;
      if (dialogueCount <= 3) {
        // Count dialogue for the character
        // We already tracked them, just confirming they have dialogue
      }
      if (dialogueCount > 3 || trimmed.length === 0) {
        lastLineWasCharacter = false;
      }
    } else {
      lastLineWasCharacter = false;
    }
  }

  // Save last scene
  if (currentScene) {
    currentScene.content = currentSceneContent.trim();
    scenes.push(currentScene);
  }

  // Convert character map to array and update dialogue counts
  const characters = Array.from(characterMap.values())
    .filter(c => c.sceneCount >= 1) // Only include characters that appear in scenes
    .sort((a, b) => b.sceneCount - a.sceneCount); // Sort by appearance count

  // Update dialogue counts based on variants
  characters.forEach(char => {
    char.dialogueCount = char.variants.length;
  });

  // Try to extract title from the beginning of the script
  const titleMatch = text.slice(0, 1000).match(/^(?:title[:\s]*)?([A-Z][A-Z\s\d\-\'\"]+)(?:\n|by)/im);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Script';

  return {
    title,
    scenes,
    characters,
    rawText: text,
  };
}

/**
 * Parse a script file (PDF, FDX, or plain text/fountain)
 * @param file - The script file to parse
 * @param options - Parsing options
 * @param options.useAI - Whether to use AI for parsing (recommended for better accuracy)
 * @param options.onProgress - Progress callback for status updates
 */
export async function parseScriptFile(
  file: File,
  options: {
    useAI?: boolean;
    onProgress?: (status: string) => void;
  } = {}
): Promise<ParsedScript> {
  const { useAI = true, onProgress } = options;
  const fileName = file.name.toLowerCase();
  let text: string;

  onProgress?.('Reading document...');

  if (fileName.endsWith('.pdf')) {
    text = await extractTextFromPDF(file);
  } else if (fileName.endsWith('.fdx')) {
    const xmlContent = await file.text();
    text = extractTextFromFDX(xmlContent);
  } else {
    // Assume plain text or fountain format
    text = await file.text();
  }

  // Try AI parsing first if enabled
  if (useAI) {
    onProgress?.('Checking AI availability...');
    const aiAvailable = await checkAIAvailability();

    if (aiAvailable) {
      try {
        onProgress?.('Analyzing script with AI...');
        return await parseScriptWithAIFallback(text, onProgress);
      } catch (error) {
        console.warn('AI parsing failed, falling back to regex parsing:', error);
        onProgress?.('AI unavailable, using standard parsing...');
      }
    } else {
      onProgress?.('AI service unavailable, using standard parsing...');
    }
  }

  onProgress?.('Parsing script format...');
  return parseScriptText(text);
}

/**
 * Parse script using AI with fallback to regex parsing
 */
async function parseScriptWithAIFallback(
  text: string,
  onProgress?: (status: string) => void
): Promise<ParsedScript> {
  const aiResult = await parseScriptWithAI(text, onProgress);

  // Convert AI results to ParsedScript format
  const scenes: ParsedScene[] = aiResult.scenes.map(s => ({
    sceneNumber: s.sceneNumber,
    slugline: s.slugline,
    intExt: s.intExt,
    location: s.location,
    timeOfDay: normalizeTimeOfDay(s.timeOfDay),
    characters: s.characters,
    content: s.content || '',
    synopsis: s.synopsis,
  }));

  const characters: ParsedCharacter[] = aiResult.characters.map(c => ({
    name: c.name,
    normalizedName: c.normalizedName,
    sceneCount: c.sceneCount,
    dialogueCount: c.dialogueCount,
    scenes: c.scenes,
    variants: c.variants,
    description: c.description,
  }));

  // Extract title
  const titleMatch = text.slice(0, 1000).match(/^(?:title[:\s]*)?([A-Z][A-Z\s\d\-\'\"]+)(?:\n|by)/im);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Script';

  return {
    title,
    scenes,
    characters,
    rawText: text,
  };
}

/**
 * Normalize time of day string to standard format
 */
function normalizeTimeOfDay(tod: string): 'DAY' | 'NIGHT' | 'MORNING' | 'EVENING' | 'CONTINUOUS' {
  const upper = (tod || 'DAY').toUpperCase();
  if (upper.includes('NIGHT')) return 'NIGHT';
  if (upper.includes('MORNING') || upper.includes('DAWN')) return 'MORNING';
  if (upper.includes('EVENING') || upper.includes('DUSK') || upper.includes('SUNSET')) return 'EVENING';
  if (upper.includes('CONTINUOUS') || upper.includes('CONT')) return 'CONTINUOUS';
  return 'DAY';
}

/**
 * Convert parsed script to project scenes and characters
 */
export function convertParsedScriptToProject(
  parsed: ParsedScript,
  selectedCharacters: string[] // Characters the user selected to track
): { scenes: Scene[]; characters: Character[] } {
  // Create character ID mapping
  const charIdMap = new Map<string, string>();
  const characters: Character[] = selectedCharacters.map((name, index) => {
    const id = `char-${uuidv4().slice(0, 8)}`;
    charIdMap.set(name, id);

    // Generate initials
    const initials = name
      .split(' ')
      .map(w => w[0])
      .join('')
      .slice(0, 2);

    // Generate color
    const colors = ['#C9A961', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#6366F1'];
    const avatarColour = colors[index % colors.length];

    return {
      id,
      name,
      initials,
      avatarColour,
    };
  });

  // Convert scenes
  const scenes: Scene[] = parsed.scenes.map((ps) => {
    // Map character names to IDs for this scene
    const sceneCharIds = ps.characters
      .filter(charName => charIdMap.has(charName))
      .map(charName => charIdMap.get(charName)!);

    return {
      id: `scene-${ps.sceneNumber}`,
      sceneNumber: ps.sceneNumber,
      slugline: `${ps.intExt}. ${ps.location} - ${ps.timeOfDay}`,
      intExt: ps.intExt,
      timeOfDay: ps.timeOfDay,
      synopsis: undefined,
      scriptContent: ps.content,
      characters: sceneCharIds,
      isComplete: false,
    };
  });

  return { scenes, characters };
}

/**
 * Suggest character merges based on name similarity
 */
export function suggestCharacterMerges(characters: ParsedCharacter[]): Array<{
  primary: string;
  similar: string[];
}> {
  const suggestions: Array<{ primary: string; similar: string[] }> = [];
  const processed = new Set<string>();

  for (const char of characters) {
    if (processed.has(char.name)) continue;

    const similar: string[] = [];

    for (const other of characters) {
      if (other.name === char.name) continue;
      if (processed.has(other.name)) continue;

      // Check if names are similar
      const name1 = char.name.toLowerCase();
      const name2 = other.name.toLowerCase();

      // Check if one contains the other
      if (name1.includes(name2) || name2.includes(name1)) {
        similar.push(other.name);
      }
      // Check if first names match
      else if (name1.split(' ')[0] === name2.split(' ')[0] && name1.split(' ')[0].length > 2) {
        similar.push(other.name);
      }
    }

    if (similar.length > 0) {
      suggestions.push({
        primary: char.name,
        similar,
      });
      similar.forEach(s => processed.add(s));
    }

    processed.add(char.name);
  }

  return suggestions;
}
