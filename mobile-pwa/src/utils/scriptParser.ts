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
 * Normalize time of day string to the scene's expected type
 * Maps various script time indicators to our standard set
 */
function normalizeTimeOfDayForScene(timeStr: string): 'DAY' | 'NIGHT' | 'MORNING' | 'EVENING' | 'CONTINUOUS' {
  const upper = (timeStr || 'DAY').toUpperCase();

  // Night variations
  if (upper === 'NIGHT' || upper === 'NIGHTMARE') return 'NIGHT';

  // Morning variations
  if (upper === 'MORNING' || upper === 'DAWN' || upper === 'SUNRISE') return 'MORNING';

  // Evening variations
  if (upper === 'EVENING' || upper === 'DUSK' || upper === 'SUNSET' ||
      upper === 'MAGIC HOUR' || upper === 'GOLDEN HOUR') return 'EVENING';

  // Continuous variations
  if (upper === 'CONTINUOUS' || upper === 'CONT' || upper === 'LATER' ||
      upper === 'SAME' || upper === 'SAME TIME' || upper === 'MOMENTS LATER' ||
      upper === 'SIMULTANEOUS') return 'CONTINUOUS';

  // Day is default (including AFTERNOON, FLASHBACK, PRESENT, ESTABLISHING, etc.)
  return 'DAY';
}

/**
 * Normalize character name for comparison
 * Handles dual character names like "DEAN/PUNK ROCKER" by taking the first name
 */
function normalizeCharacterName(name: string): string {
  let normalized = name.toUpperCase();

  // Remove parentheticals (V.O.), (O.S.), (CONT'D), etc.
  normalized = normalized.replace(/\s*\(.*?\)\s*/g, '');

  // Handle dual character names - take the first name as primary
  // e.g., "DEAN/PUNK ROCKER" -> "DEAN"
  if (normalized.includes('/') && !normalized.startsWith('INT') && !normalized.startsWith('EXT')) {
    const parts = normalized.split('/');
    // Only split if both parts look like names (not INT/EXT)
    if (parts[0].length >= 2 && parts[0].length <= 20) {
      normalized = parts[0].trim();
    }
  }

  return normalized.replace(/\s+/g, ' ').trim();
}

/**
 * Extract character names mentioned in action/description lines
 * These are characters physically present in a scene but not speaking
 * Looks for names in ALL CAPS or Title Case within action text
 *
 * Examples:
 *   "a handsome LOCAL MAN in his late 30s" -> ["LOCAL MAN"]
 *   "Gwen and Peter approach a simple TAXI STAND" -> ["GWEN", "PETER"]
 *   "Jon unfolding it, gesturing for Peter to sit" -> ["JON", "PETER"]
 */
function extractCharactersFromActionLine(line: string): string[] {
  const characters: string[] = [];
  const trimmed = line.trim();

  // Skip scene headings, transitions, and very short lines
  if (trimmed.length < 5) return characters;
  if (/^(INT\.|EXT\.|INT\/EXT|CUT TO|FADE|DISSOLVE|CONTINUED)/i.test(trimmed)) return characters;

  // Pattern 1: ALL CAPS names (2-3 words max) within the line
  // Matches: "LOCAL MAN", "YOUNG WOMAN", "TAXI DRIVER", "DR. SMITH"
  const allCapsPattern = /\b([A-Z][A-Z.'-]+(?:\s+[A-Z][A-Z.'-]+){0,2})\b/g;
  let match;

  while ((match = allCapsPattern.exec(trimmed)) !== null) {
    const potential = match[1].trim();

    // Skip if it's a common non-character all-caps word
    const nonCharacterWords = new Set([
      'INT', 'EXT', 'DAY', 'NIGHT', 'MORNING', 'EVENING', 'CONTINUOUS',
      'LATER', 'SAME', 'CONT', 'CONTINUED', 'CUT', 'FADE', 'DISSOLVE',
      'THE', 'AND', 'BUT', 'FOR', 'NOT', 'YOU', 'ALL', 'CAN', 'HER',
      'HIS', 'HIM', 'SHE', 'HAS', 'HAD', 'WAS', 'ARE', 'BEEN', 'HAVE',
      'THEIR', 'WHAT', 'WHEN', 'WHERE', 'WHICH', 'WHO', 'THIS', 'THAT',
      'WITH', 'FROM', 'INTO', 'ONTO', 'UPON', 'BACK', 'OVER', 'UNDER',
      'CLOSE', 'WIDE', 'ANGLE', 'VIEW', 'SHOT', 'POV', 'INSERT',
      'FLASHBACK', 'DREAM', 'TITLE', 'SUPER', 'CHYRON', 'SUBTITLE',
      'TV', 'DVD', 'VHS', 'USA', 'NYC', 'NYPD', 'FBI', 'CIA', 'NSA',
      'TAXI', 'STAND', 'TAXI STAND', 'CAR', 'DOOR', 'ROOM', 'HOUSE',
      'YELLOW', 'PARKA', 'YELLOW PARKA', 'WHEELCHAIR'
    ]);

    // Skip single words that are common non-character terms
    if (potential.split(/\s+/).length === 1 && nonCharacterWords.has(potential)) {
      continue;
    }

    // Skip multi-word terms that are objects/props
    if (nonCharacterWords.has(potential)) {
      continue;
    }

    // Skip if it looks like an object description (contains common object words)
    const objectWords = /\b(TAXI|CAR|DOOR|ROOM|HOUSE|BOAT|PHONE|GUN|KNIFE|TABLE|CHAIR|STAND|PARKA|WHEELCHAIR|VEHICLE)\b/i;
    if (objectWords.test(potential)) {
      continue;
    }

    // Valid character indicators: contains MAN, WOMAN, PERSON, DRIVER, etc.
    const characterIndicators = /\b(MAN|WOMAN|PERSON|DRIVER|OFFICER|DOCTOR|NURSE|GUARD|SOLDIER|WORKER|GIRL|BOY|LADY|GUY|KID|CHILD|TEENAGER|ELDERLY|YOUNG|OLD|LOCAL|HANDSOME|BEAUTIFUL)\b/i;

    // If it's 2+ words and contains a character indicator, it's likely a character
    if (potential.split(/\s+/).length >= 2 && characterIndicators.test(potential)) {
      characters.push(potential);
      continue;
    }

    // If it's a single capitalized word that's 3+ chars and not a common word, could be a name
    if (potential.length >= 3 && potential.length <= 15 && !nonCharacterWords.has(potential)) {
      // Check context: is it followed by action verbs or preceded by articles suggesting it's a name?
      const beforeMatch = trimmed.slice(0, match.index);
      const afterMatch = trimmed.slice(match.index + potential.length);

      // Strong indicators it's a character name
      const nameContext = /(^|\s)(a |an |the |young |old |handsome |beautiful )?$/i.test(beforeMatch) ||
                          /^(\s+)(enters|exits|walks|runs|stands|sits|looks|turns|moves|says|speaks|watches|stares|smiles|nods|shakes|reaches|grabs|holds|opens|closes)/i.test(afterMatch) ||
                          /^('s\s|'s$|\s+and\s+[A-Z])/i.test(afterMatch);

      if (nameContext) {
        characters.push(potential);
      }
    }
  }

  // Pattern 2: Title Case names at start of sentence or after comma
  // Matches: "Gwen and Peter approach", "Jon unfolding it"
  const titleCasePattern = /(?:^|[,;]\s*|\.\s+)([A-Z][a-z]+(?:\s+(?:and|&)\s+[A-Z][a-z]+)*)\s+(?:and\s+)?[a-z]/g;

  while ((match = titleCasePattern.exec(trimmed)) !== null) {
    const names = match[1].split(/\s+(?:and|&)\s+/i);
    for (const name of names) {
      const upperName = name.trim().toUpperCase();
      // Skip common non-name words
      if (upperName.length >= 2 && upperName.length <= 20 &&
          !['THE', 'AND', 'BUT', 'FOR', 'NOT', 'THIS', 'THAT', 'WHEN', 'WHERE', 'WHILE'].includes(upperName)) {
        characters.push(upperName);
      }
    }
  }

  // Deduplicate
  return [...new Set(characters)];
}

/**
 * Check if a line is a character cue (character name before dialogue)
 * Improved to better filter out false positives from action lines
 */
function isCharacterCue(line: string): boolean {
  const trimmed = line.trim();

  // Character cues are typically uppercase
  if (trimmed !== trimmed.toUpperCase()) return false;

  // Should be short (character names aren't long sentences)
  if (trimmed.length > 50) return false;

  // Should not start with common non-character patterns
  const nonCharPatterns = [
    /^(INT\.|EXT\.|INT\/EXT|EXT\/INT|I\/E\.)/i,
    /^(CUT TO|FADE|DISSOLVE|SMASH|MATCH|WIPE)/i,
    /^(THE END|CONTINUED|MORE|\(MORE\))/i,
    /^\d+\s*$/,
    /^\s*$/,
    /^(TITLE:|SUPER:|CHYRON:|CARD:|INSERT:|INTERCUT)/i,
    /^(FLASHBACK|END FLASHBACK|FLASH BACK|DREAM SEQUENCE)/i,
    /^(BACK TO|RESUME|ANGLE ON|CLOSE ON|WIDE ON|POV)/i,
    /^(LATER|CONTINUOUS|MOMENTS LATER|SAME TIME)/i,
    /^(SUPERIMPOSE|SUBTITLE|CAPTION)/i,
  ];

  for (const pattern of nonCharPatterns) {
    if (pattern.test(trimmed)) return false;
  }

  // Should contain at least one letter
  if (!/[A-Z]/.test(trimmed)) return false;

  // Filter out common action line patterns that are all caps
  // These typically describe what's happening, not who's speaking
  const actionPatterns = [
    /^(A |AN |THE |HE |SHE |THEY |WE |IT |HIS |HER |THEIR )/,
    /^(IN THE |AT THE |ON THE |FROM THE |TO THE |INTO THE )/,
    /^(ARRIVING|ENTERING|LEAVING|WALKING|RUNNING|STANDING|SITTING)/,
    / (ENTERS|EXITS|WALKS|RUNS|STANDS|SITS|LOOKS|TURNS|MOVES)$/,
    / (IS |ARE |WAS |WERE |HAS |HAVE |THE |A |AN )/, // Action lines have articles/verbs mid-sentence
    /^[A-Z]+ [A-Z]+ [A-Z]+ [A-Z]+ [A-Z]+/, // 5+ words is likely an action line
    /\.$/, // Character cues don't end with periods
    /^\d+[A-Z]?\s+/, // Starts with scene number
  ];

  for (const pattern of actionPatterns) {
    if (pattern.test(trimmed)) return false;
  }

  // Allow parentheticals like (V.O.), (O.S.), (CONT'D)
  const nameWithoutParen = trimmed.replace(/\s*\(.*?\)\s*/g, '').trim();

  // Character names should be reasonably short (1-4 words typically)
  const wordCount = nameWithoutParen.split(/\s+/).length;
  if (wordCount > 4) return false;

  // Character names should be reasonably short
  return nameWithoutParen.length >= 2 && nameWithoutParen.length <= 35;
}

/**
 * Parsed scene heading result
 */
interface ParsedSceneHeading {
  sceneNumber: string | null;
  intExt: 'INT' | 'EXT';
  location: string;
  timeOfDay: string;
  rawSlugline: string;
  isValid: boolean;
}

/**
 * Check if a line is a scene heading
 * Handles scene numbers before and after INT/EXT
 * Examples:
 *   "4    INT. HOTEL ROOM - CONTINUOUS    4"
 *   "INT. COFFEE SHOP - DAY"
 *   "12A  EXT. PARK - NIGHT  12A"
 *   "I/E. FARMHOUSE - KITCHEN - DAY"
 */
/**
 * Parse a scene heading line and extract all components
 * Handles various formats:
 *   - Scene numbers on left: "4 INT. LOCATION - TIME"
 *   - Scene numbers on both sides: "4 INT. LOCATION - TIME 4"
 *   - Scene numbers with letters: "4A INT. LOCATION - TIME"
 *   - Various INT/EXT formats: INT., EXT., I/E., INT./EXT., INT/EXT
 *   - Various separators: dashes, periods, commas
 */
function parseSceneHeadingLine(line: string): ParsedSceneHeading {
  const trimmed = line.trim();

  // Default invalid result
  const invalidResult: ParsedSceneHeading = {
    sceneNumber: null,
    intExt: 'INT',
    location: '',
    timeOfDay: 'DAY',
    rawSlugline: trimmed,
    isValid: false,
  };

  if (!trimmed || trimmed.length < 5) return invalidResult;

  // Remove revision asterisks from end
  let cleanLine = trimmed.replace(/\s*\*+\s*$/, '').trim();

  // Pattern to match scene numbers (with optional letter suffix)
  const sceneNumPattern = /^(\d+[A-Z]?)\s+/i;
  const trailingSceneNumPattern = /\s+(\d+[A-Z]?)\s*$/i;

  let sceneNumber: string | null = null;
  let workingLine = cleanLine;

  // Extract leading scene number
  const leadingMatch = workingLine.match(sceneNumPattern);
  if (leadingMatch) {
    sceneNumber = leadingMatch[1].toUpperCase();
    workingLine = workingLine.slice(leadingMatch[0].length).trim();
  }

  // Extract trailing scene number (and validate it matches leading if both exist)
  const trailingMatch = workingLine.match(trailingSceneNumPattern);
  if (trailingMatch) {
    const trailingNum = trailingMatch[1].toUpperCase();
    if (!sceneNumber) {
      sceneNumber = trailingNum;
    }
    // Remove trailing scene number
    workingLine = workingLine.slice(0, -trailingMatch[0].length).trim();
  }

  // Now check for INT/EXT pattern
  // Supports: INT. INT EXT. EXT I/E. I/E INT./EXT. INT/EXT EXT./INT. EXT/INT
  const intExtPattern = /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|INT\.?|EXT\.?)\s*/i;
  const intExtMatch = workingLine.match(intExtPattern);

  if (!intExtMatch) {
    return invalidResult;
  }

  const intExtRaw = intExtMatch[1].toUpperCase().replace(/\.$/, '');
  const intExt: 'INT' | 'EXT' = intExtRaw.startsWith('EXT') ? 'EXT' : 'INT';

  // Remove INT/EXT from working line
  workingLine = workingLine.slice(intExtMatch[0].length).trim();

  // Remove leading period or dash if present (some scripts have "INT. - LOCATION")
  workingLine = workingLine.replace(/^[\.\-–—]\s*/, '').trim();

  // Now extract time of day and location
  // Build regex to find time of day (handling various separators)
  // Matches: "- DAY", "-- DAY", "– DAY", "— DAY", ". DAY", ", DAY", just "DAY" at end
  const timeSeparatorPattern = /(?:\s*[-–—\.]+\s*|\s+)(DAY|NIGHT|MORNING|EVENING|AFTERNOON|DAWN|DUSK|SUNSET|SUNRISE|CONTINUOUS|CONT|LATER|SAME|SAME TIME|MOMENTS LATER|SIMULTANEOUS|MAGIC HOUR|GOLDEN HOUR|FLASHBACK|PRESENT|DREAM|FANTASY|NIGHTMARE|ESTABLISHING)(?:\s*[-–—]?\s*(?:FLASHBACK|PRESENT|CONT(?:'D)?)?)?$/i;

  let timeOfDay = 'DAY';
  let location = workingLine;

  const timeMatch = workingLine.match(timeSeparatorPattern);
  if (timeMatch) {
    timeOfDay = timeMatch[1].toUpperCase();
    // Normalize some time values
    if (timeOfDay === 'CONT') timeOfDay = 'CONTINUOUS';

    // Extract location (everything before the time match)
    location = workingLine.slice(0, timeMatch.index).trim();
    // Clean up trailing separators from location
    location = location.replace(/[\s\-–—\.,]+$/, '').trim();
  }

  // If no time found but line is valid scene heading format, assume DAY
  if (!timeMatch && workingLine.length > 0) {
    location = workingLine.replace(/[\s\-–—\.,]+$/, '').trim();
  }

  // Validate: must have a location
  if (!location || location.length < 2) {
    return invalidResult;
  }

  return {
    sceneNumber,
    intExt,
    location,
    timeOfDay,
    rawSlugline: trimmed, // Keep original for reference
    isValid: true,
  };
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
