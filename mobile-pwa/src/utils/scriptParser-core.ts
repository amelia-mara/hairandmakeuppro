import type { Scene, Character } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { parseScriptWithAI, checkAIAvailability } from '@/services/aiService';
import { extractTextFromPDF, extractTextFromFDX } from './scriptParser-pdf';
import {
  normalizeCharacterName,
  extractCharactersFromActionLine,
  isCharacterCue,
} from './scriptParser-character';
import {
  normalizeTimeOfDayForScene,
  normalizeTimeOfDay,
  parseSceneHeadingLine,
} from './scriptParser-helpers';

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

// Fast-parsed scene interface (no characters, just scene structure)
export interface FastParsedScene {
  sceneNumber: string;
  slugline: string;
  intExt: 'INT' | 'EXT';
  location: string;
  timeOfDay: 'DAY' | 'NIGHT' | 'MORNING' | 'EVENING' | 'CONTINUOUS';
  scriptContent: string;
  // Characters NOT included - detected later
}

// Result of fast scene parsing
export interface FastParsedScript {
  title: string;
  scenes: FastParsedScene[];
  rawText: string;
}

/**
 * Parse script text to extract scenes and characters
 */
export function parseScriptText(text: string): ParsedScript {
  const lines = text.split('\n');
  const scenes: ParsedScene[] = [];
  const characterMap = new Map<string, ParsedCharacter>();

  let currentScene: ParsedScene | null = null;
  let fallbackSceneNumber = 0; // Used only if script doesn't have scene numbers
  let currentSceneContent = '';
  let lastLineWasCharacter = false;
  let dialogueCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for scene heading using the new robust parser
    const parsedHeading = parseSceneHeadingLine(trimmed);

    if (parsedHeading.isValid) {
      // Save previous scene
      if (currentScene) {
        currentScene.content = currentSceneContent.trim();
        scenes.push(currentScene);
      }

      // Use scene number from script, or fall back to sequential
      fallbackSceneNumber++;
      const sceneNum = parsedHeading.sceneNumber || String(fallbackSceneNumber);

      // Normalize time of day to our expected types
      const normalizedTime = normalizeTimeOfDayForScene(parsedHeading.timeOfDay);

      currentScene = {
        sceneNumber: sceneNum,
        slugline: trimmed, // Keep original for display
        intExt: parsedHeading.intExt,
        location: parsedHeading.location,
        timeOfDay: normalizedTime,
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

      // Also check for characters mentioned in action/description lines
      // This catches characters who are physically present but not speaking
      if (currentScene && trimmed.length > 10) {
        const actionCharacters = extractCharactersFromActionLine(trimmed);
        for (const charName of actionCharacters) {
          const normalized = normalizeCharacterName(charName);

          if (normalized.length >= 2) {
            // Add to scene's characters
            if (!currentScene.characters.includes(normalized)) {
              currentScene.characters.push(normalized);
            }

            // Add to character map (mark as non-speaking/action appearance)
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

            // Track scenes
            if (!char.scenes.includes(currentScene.sceneNumber)) {
              char.scenes.push(currentScene.sceneNumber);
              char.sceneCount++;
            }
          }
        }
      }
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
    onProgress?.('Checking smart parsing availability...');
    const aiAvailable = await checkAIAvailability();

    if (aiAvailable) {
      try {
        onProgress?.('Analyzing script...');
        return await parseScriptWithAIFallback(text, onProgress);
      } catch (error) {
        onProgress?.('Smart parsing unavailable, using standard parsing...');
      }
    } else {
      onProgress?.('Smart parsing unavailable, using standard parsing...');
    }
  }

  onProgress?.('Parsing script format...');
  return parseScriptText(text);
}

/**
 * Extract scene content from raw script text using slugline matching
 * Handles various script formats including scene numbers before/after INT/EXT
 */
function extractSceneContent(slugline: string, text: string): string {
  // Normalize dashes in both slugline and text for matching
  // Convert en-dash and em-dash to regular hyphen for comparison
  const normalizedSlugline = slugline.replace(/[–—]/g, '-');
  const normalizedText = text.replace(/[–—]/g, '-');

  // Extract the key parts from the slugline
  const intExtMatch = normalizedSlugline.match(/^(INT|EXT)\.?\/?(?:INT|EXT)?\.?\s*/i);
  const intExt = intExtMatch ? intExtMatch[1].toUpperCase() : 'INT';

  // Get the location and time part (everything after INT./EXT.)
  const locationPart = normalizedSlugline.replace(/^(?:INT|EXT)\.?\/?(?:INT|EXT)?\.?\s*/i, '').trim();

  // Escape special regex characters in location part
  const escapedLocation = locationPart
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+')
    .replace(/-/g, '[-–—]'); // Match any dash type

  // Strategy 1: Try exact slugline match (with flexible whitespace)
  const escapedSlugline = normalizedSlugline
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+')
    .replace(/-/g, '[-–—]');
  const exactPattern = new RegExp(escapedSlugline, 'im');
  let match = normalizedText.match(exactPattern);

  if (match && match.index !== undefined) {
    return extractContentFromPosition(text, match.index);
  }

  // Strategy 2: Match with optional scene numbers before INT/EXT
  // Pattern handles: "4 INT. LOCATION", "4A INT. LOCATION", "INT. LOCATION"
  const sceneNumPattern = new RegExp(
    `(?:\\d+[A-Z]?\\s+)?(?:${intExt}|INT|EXT)[\\.\\s/]*(?:INT|EXT)?[\\./]?\\s*${escapedLocation}`,
    'im'
  );
  match = normalizedText.match(sceneNumPattern);

  if (match && match.index !== undefined) {
    return extractContentFromPosition(text, match.index);
  }

  // Strategy 3: Just match INT/EXT followed by the location name (most flexible)
  // Extract just the location name without time of day for fuzzy matching
  const locationOnly = locationPart.replace(/\s*[-–—]\s*(DAY|NIGHT|MORNING|EVENING|CONTINUOUS|CONT|LATER|SAME|DAWN|DUSK|SUNSET|SUNRISE).*$/i, '').trim();
  if (locationOnly.length > 3) {
    const escapedLocationOnly = locationOnly
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+');
    const locationOnlyPattern = new RegExp(
      `(?:\\d+[A-Z]?\\s+)?(?:INT|EXT)[\\./\\s]*(?:INT|EXT)?[\\./]?\\s*${escapedLocationOnly}`,
      'im'
    );
    match = normalizedText.match(locationOnlyPattern);

    if (match && match.index !== undefined) {
      return extractContentFromPosition(text, match.index);
    }
  }

  // Strategy 4: Search for any line starting with the INT/EXT and containing keywords from location
  // Split location into words and search for a line containing most of them
  const locationWords = locationOnly.split(/\s+/).filter(w => w.length > 2);
  if (locationWords.length > 0) {
    const lines = normalizedText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Check if line looks like a scene heading with INT/EXT
      if (/^(?:\d+[A-Z]?\s+)?(?:INT|EXT)/i.test(line)) {
        // Count how many location words are in this line
        const matchingWords = locationWords.filter(word =>
          line.toUpperCase().includes(word.toUpperCase())
        );
        // If at least half the words match, this is likely our scene
        if (matchingWords.length >= Math.ceil(locationWords.length / 2)) {
          // Find the position of this line in the original text
          const lineIndex = text.indexOf(lines[i]);
          if (lineIndex !== -1) {
            return extractContentFromPosition(text, lineIndex);
          }
        }
      }
    }
  }

  return '';
}

/**
 * Extract content from a position until the next scene heading
 * Handles various scene heading formats with or without periods
 */
function extractContentFromPosition(text: string, startIndex: number): string {
  // Find the next scene heading pattern
  // More flexible pattern: handles INT., INT, INT/, EXT., EXT, EXT/, etc.
  // Also handles scene numbers before INT/EXT like "4 INT." or "12A EXT."
  const nextScenePattern = /\n\s*(?:\d+[A-Z]?\s+)?(?:INT|EXT)[\s./]/gi;
  nextScenePattern.lastIndex = startIndex + 1;

  // Skip past the current scene heading line to avoid matching it
  const firstNewline = text.indexOf('\n', startIndex);
  if (firstNewline !== -1) {
    nextScenePattern.lastIndex = firstNewline + 1;
  }

  const nextMatch = nextScenePattern.exec(text);

  const endIndex = nextMatch ? nextMatch.index : text.length;
  return text.slice(startIndex, endIndex).trim();
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
  // Extract actual scene content from the raw text using the sluglines
  const scenes: ParsedScene[] = aiResult.scenes.map(s => {
    // Extract content from the original text using the slugline
    const content = extractSceneContent(s.slugline, text);
    return {
      sceneNumber: s.sceneNumber,
      slugline: s.slugline,
      intExt: s.intExt,
      location: s.location,
      timeOfDay: normalizeTimeOfDay(s.timeOfDay),
      characters: s.characters,
      content: content,
      synopsis: s.synopsis,
    };
  });

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
 * Convert parsed script to project scenes and characters
 */
export function convertParsedScriptToProject(
  parsed: ParsedScript,
  selectedCharacters: string[] // Characters the user selected to track
): { scenes: Scene[]; characters: Character[] } {
  // Create character ID mapping
  const charIdMap = new Map<string, string>();
  const characters: Character[] = selectedCharacters.map((name, index) => {
    const id = uuidv4();
    charIdMap.set(name, id);

    // Generate initials
    const initials = name
      .split(' ')
      .map(w => w[0])
      .join('')
      .slice(0, 2);

    // Generate color
    const colors = ['#D4943A', '#E8621A', '#F0882A', '#4ABFB0', '#F5A623', '#5A3E28', '#F2C4A0', '#C4522A'];
    const avatarColour = colors[index % colors.length];

    return {
      id,
      name,
      initials,
      avatarColour,
    };
  });

  // Convert scenes — deduplicate scene numbers so they satisfy the
  // UNIQUE(project_id, scene_number) constraint in Supabase.
  const seenSceneNumbers = new Map<string, number>();
  const scenes: Scene[] = parsed.scenes.map((ps) => {
    // Map character names to IDs for this scene
    const sceneCharIds = ps.characters
      .filter(charName => charIdMap.has(charName))
      .map(charName => charIdMap.get(charName)!);

    // Deduplicate: "45" stays "45", second "45" becomes "45-2", etc.
    let sceneNum = ps.sceneNumber;
    const count = (seenSceneNumbers.get(sceneNum) || 0) + 1;
    seenSceneNumbers.set(sceneNum, count);
    if (count > 1) {
      sceneNum = `${sceneNum}-${count}`;
    }

    return {
      id: uuidv4(),
      sceneNumber: sceneNum,
      slugline: `${ps.intExt}. ${ps.location} - ${ps.timeOfDay}`,
      intExt: ps.intExt,
      timeOfDay: ps.timeOfDay,
      synopsis: ps.synopsis,
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

/**
 * Fast scene parsing - extracts ONLY scene structure without character detection
 * This is designed to complete in under 30 seconds for any script size
 * Uses regex only (no AI) for maximum speed
 */
export async function parseScenesFast(file: File): Promise<FastParsedScript> {
  const fileName = file.name.toLowerCase();
  let text: string;

  // Extract text based on file type
  if (fileName.endsWith('.pdf')) {
    text = await extractTextFromPDF(file);
  } else if (fileName.endsWith('.fdx')) {
    const xmlContent = await file.text();
    text = extractTextFromFDX(xmlContent);
  } else {
    text = await file.text();
  }

  // Parse scenes using regex only (fast path)
  const lines = text.split('\n');
  const scenes: FastParsedScene[] = [];

  let currentScene: FastParsedScene | null = null;
  let fallbackSceneNumber = 0;
  let currentSceneContent = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for scene heading using the existing robust parser
    const parsedHeading = parseSceneHeadingLine(trimmed);

    if (parsedHeading.isValid) {
      // Save previous scene
      if (currentScene) {
        currentScene.scriptContent = currentSceneContent.trim();
        scenes.push(currentScene);
      }

      // Use scene number from script, or fall back to sequential
      fallbackSceneNumber++;
      const sceneNum = parsedHeading.sceneNumber || String(fallbackSceneNumber);

      // Normalize time of day to our expected types
      const normalizedTime = normalizeTimeOfDayForScene(parsedHeading.timeOfDay);

      currentScene = {
        sceneNumber: sceneNum,
        slugline: trimmed,
        intExt: parsedHeading.intExt,
        location: parsedHeading.location,
        timeOfDay: normalizedTime,
        scriptContent: '',
      };
      currentSceneContent = trimmed + '\n';
      continue;
    }

    // Add to current scene content
    if (currentScene) {
      currentSceneContent += line + '\n';
    }
  }

  // Save last scene
  if (currentScene) {
    currentScene.scriptContent = currentSceneContent.trim();
    scenes.push(currentScene);
  }

  // Try to extract title from the beginning of the script
  const titleMatch = text.slice(0, 1000).match(/^(?:title[:\s]*)?([A-Z][A-Z\s\d\-\'\"]+)(?:\n|by)/im);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Script';

  return {
    title,
    scenes,
    rawText: text,
  };
}

/**
 * Detect characters for a single scene or batch of scenes
 * Can use AI for better accuracy or fall back to regex
 * @param sceneContent - The script content for the scene
 * @param rawText - The full raw script text (for context)
 * @param options - Optional settings including known characters from schedule
 * @returns Array of character names detected in this scene
 */
export async function detectCharactersForScene(
  sceneContent: string,
  _rawText: string,
  options?: { useAI?: boolean; knownCharacters?: string[] }
): Promise<string[]> {
  const useAI = options?.useAI ?? false;
  const knownCharacters = options?.knownCharacters ?? [];
  const characters: string[] = [];
  const characterSet = new Set<string>();

  // First, search for known characters from schedule (if provided)
  // This is the most reliable method when a schedule is uploaded
  if (knownCharacters.length > 0) {
    const contentUpper = sceneContent.toUpperCase();
    for (const charName of knownCharacters) {
      const normalized = normalizeCharacterName(charName);
      if (normalized.length < 2) continue;

      // Check if character name appears in the scene (as character cue or in action)
      // Use word boundary matching to avoid partial matches
      const namePattern = new RegExp(`\\b${escapeRegExp(normalized)}\\b`, 'i');
      if (namePattern.test(contentUpper) && !characterSet.has(normalized)) {
        characterSet.add(normalized);
        characters.push(normalized);
      }
    }
  }

  // Always try regex detection for character cues (fast, reliable for dialogue)
  const lines = sceneContent.split('\n');
  let lastLineWasCharacter = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for character cue
    if (isCharacterCue(trimmed)) {
      const normalized = normalizeCharacterName(trimmed);

      if (normalized.length >= 2 && !characterSet.has(normalized)) {
        characterSet.add(normalized);
        characters.push(normalized);
      }
      lastLineWasCharacter = true;
    } else if (lastLineWasCharacter && trimmed.length > 0) {
      // This is dialogue following a character cue
      // Keep lastLineWasCharacter true for multi-line dialogue
    } else {
      lastLineWasCharacter = false;

      // Also check for characters mentioned in action/description lines
      // Only do this if we don't have known characters (to avoid noise)
      if (trimmed.length > 10 && knownCharacters.length === 0) {
        const actionCharacters = extractCharactersFromActionLine(trimmed);
        for (const charName of actionCharacters) {
          const normalized = normalizeCharacterName(charName);
          if (normalized.length >= 2 && !characterSet.has(normalized)) {
            characterSet.add(normalized);
            characters.push(normalized);
          }
        }
      }
    }
  }

  // If AI is requested and available, use it to enhance detection
  if (useAI) {
    try {
      const aiAvailable = await checkAIAvailability();
      if (aiAvailable) {
        const aiCharacters = await detectCharactersWithAI(sceneContent);
        // Merge AI results with regex results, avoiding duplicates
        for (const char of aiCharacters) {
          const normalized = normalizeCharacterName(char);
          if (normalized.length >= 2 && !characterSet.has(normalized)) {
            characterSet.add(normalized);
            characters.push(normalized);
          }
        }
      }
    } catch {
      // AI enhancement is optional, fall back to regex results
    }
  }

  return characters;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect characters in a scene using AI
 * This is called by detectCharactersForScene when AI is enabled
 */
async function detectCharactersWithAI(sceneContent: string): Promise<string[]> {
  // Import the AI service dynamically to avoid circular dependencies
  const { callAI } = await import('@/services/aiService');

  const prompt = `You are a screenplay analyzer. Identify ALL characters who appear in this scene.

Rules:
1. Include characters who speak (have dialogue)
2. Include characters who are physically present but don't speak
3. Include characters referenced by role (e.g., "TAXI DRIVER", "YOUNG WOMAN")
4. Exclude location names, objects, and directions
5. Return ONLY character names, one per line
6. Use the name as it appears in the script (e.g., "JOHN", "MARY SMITH", "COP #1")

Scene content:
${sceneContent}

Return only character names, one per line:`;

  try {
    const response = await callAI(prompt);
    if (!response) return [];

    // Parse the response - expect one character name per line
    const lines = response.split('\n');
    const characters: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines and lines that look like explanations
      if (!trimmed || trimmed.length > 30 || trimmed.includes(':')) continue;
      // Remove common prefixes like "- " or "* " or numbers
      const cleaned = trimmed.replace(/^[-*\d.)\s]+/, '').trim();
      if (cleaned.length >= 2 && cleaned.length <= 25) {
        characters.push(cleaned.toUpperCase());
      }
    }

    return characters;
  } catch (error) {
    return [];
  }
}

/**
 * Batch detect characters for multiple scenes
 * More efficient than calling detectCharactersForScene individually
 * @param scenes - Array of scenes with their content
 * @param rawText - Full raw script text
 * @param options - Optional settings including known characters from schedule
 */
export async function detectCharactersForScenesBatch(
  scenes: Array<{ sceneNumber: string; scriptContent: string }>,
  rawText: string,
  options?: {
    useAI?: boolean;
    knownCharacters?: string[];
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();
  const total = scenes.length;
  let completed = 0;

  // Process scenes in parallel batches of 5 for better performance
  const batchSize = 5;

  for (let i = 0; i < scenes.length; i += batchSize) {
    const batch = scenes.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (scene) => {
        const characters = await detectCharactersForScene(
          scene.scriptContent,
          rawText,
          { useAI: options?.useAI, knownCharacters: options?.knownCharacters }
        );
        return { sceneNumber: scene.sceneNumber, characters };
      })
    );

    for (const result of batchResults) {
      results.set(result.sceneNumber, result.characters);
      completed++;
      options?.onProgress?.(completed, total);
    }
  }

  return results;
}
