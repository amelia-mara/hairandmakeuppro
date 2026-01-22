/**
 * AI Service for script parsing using Claude API
 * Uses the serverless /api/ai endpoint for secure API key handling
 */

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  content: Array<{ type: string; text: string }>;
  usage?: { input_tokens: number; output_tokens: number };
}

/**
 * Call the AI API with retry logic and exponential backoff
 */
export async function callAI(
  prompt: string,
  options: {
    system?: string;
    maxTokens?: number;
    maxRetries?: number;
  } = {}
): Promise<string> {
  const { system, maxTokens = 4000, maxRetries = 3 } = options;

  const messages: AIMessage[] = [{ role: 'user', content: prompt }];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Use relative URL for Vercel deployment, falls back to local for dev
      const apiUrl = '/api/ai';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          system,
          maxTokens,
          model: 'claude-sonnet-4-20250514',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || errorData.error || '';

        // Handle rate limiting with exponential backoff
        if (response.status === 429) {
          const waitTime = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
          console.log(`Rate limited, waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // Handle credit/billing errors (non-retryable)
        if (response.status === 400 && (errorMessage.includes('credit balance') || errorMessage.includes('purchase credits'))) {
          throw new Error('Insufficient API credits. Please add credits at console.anthropic.com');
        }

        // Handle auth errors (non-retryable)
        if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid API key. Please check your configuration.');
        }

        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data: AIResponse = await response.json();

      if (data.content && data.content.length > 0) {
        return data.content[0].text;
      }

      throw new Error('Empty response from AI');
    } catch (error) {
      lastError = error as Error;
      console.error(`AI call attempt ${attempt + 1} failed:`, error);

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt + 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError || new Error('AI call failed after retries');
}

/**
 * Parse script text using AI to extract scenes and characters
 * Includes cross-chunk character validation for long scripts
 */
export async function parseScriptWithAI(
  scriptText: string,
  onProgress?: (status: string) => void
): Promise<{
  scenes: AIExtractedScene[];
  characters: AIExtractedCharacter[];
}> {
  onProgress?.('Analyzing script structure with AI...');

  // STEP 1: Pre-extract ALL character names from entire script BEFORE chunking
  // This ensures we have a complete cast list to reference across all chunks
  onProgress?.('Pre-extracting character names...');
  const preExtractedCharacters = extractCharacterNamesFromScript(scriptText);
  console.log(`Pre-extracted ${preExtractedCharacters.length} character names for cross-chunk reference`);

  // For very long scripts, we need to process in chunks
  const MAX_CHUNK_SIZE = 30000; // Characters per chunk
  const chunks = splitScriptIntoChunks(scriptText, MAX_CHUNK_SIZE);

  const allScenes: AIExtractedScene[] = [];
  const characterMap = new Map<string, AIExtractedCharacter>();

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(`Analyzing script section ${i + 1} of ${chunks.length}...`);

    // Pass the pre-extracted character list to each chunk
    const chunkResult = await analyzeScriptChunk(chunks[i], i, chunks.length, preExtractedCharacters);

    // Merge scenes with offset for scene numbers
    const sceneOffset = allScenes.length;
    for (const scene of chunkResult.scenes) {
      // Adjust scene number if it's sequential
      if (!scene.sceneNumber.match(/[A-Z]/)) {
        const numericPart = parseInt(scene.sceneNumber, 10);
        if (!isNaN(numericPart)) {
          scene.sceneNumber = String(numericPart + sceneOffset);
        }
      }
      allScenes.push(scene);
    }

    // Merge characters
    for (const char of chunkResult.characters) {
      const existing = characterMap.get(char.normalizedName);
      if (existing) {
        // Merge scene appearances
        existing.scenes = [...new Set([...existing.scenes, ...char.scenes])];
        existing.sceneCount = existing.scenes.length;
        existing.dialogueCount += char.dialogueCount;
        // Merge variants
        existing.variants = [...new Set([...existing.variants, ...char.variants])];
      } else {
        characterMap.set(char.normalizedName, char);
      }
    }
  }

  // STEP 2: Cross-validate characters across scenes
  onProgress?.('Cross-validating characters...');
  crossValidateSceneCharacters(allScenes, preExtractedCharacters, scriptText, chunks);

  // Sort characters by scene count
  const characters = Array.from(characterMap.values())
    .sort((a, b) => b.sceneCount - a.sceneCount);

  onProgress?.('Script analysis complete');

  return { scenes: allScenes, characters };
}

/**
 * Pre-extract character names from script using pattern matching
 * This runs BEFORE AI analysis to build a complete cast reference
 */
function extractCharacterNamesFromScript(scriptText: string): string[] {
  const characters = new Set<string>();

  // Pattern for dialogue cues: CHARACTER NAME (possibly with extension) on its own line
  const dialoguePattern = /^([A-Z][A-Z\s.'-]{1,30})\s*(?:\([^)]*\))?\s*$/gm;

  // Exclusion list for non-character uppercase text
  const exclusions = new Set([
    'INT', 'EXT', 'FADE', 'CUT', 'DISSOLVE', 'CONTINUED', 'THE END',
    'TITLE', 'SUPER', 'INSERT', 'BACK TO', 'FLASHBACK', 'END FLASHBACK',
    'LATER', 'CONTINUOUS', 'SAME', 'MORNING', 'AFTERNOON', 'EVENING',
    'NIGHT', 'DAY', 'DAWN', 'DUSK', 'MOMENTS', 'THE NEXT', 'MORE',
    'ANGLE ON', 'CLOSE ON', 'WIDE ON', 'POV', 'INTERCUT', 'MONTAGE'
  ]);

  let match;
  while ((match = dialoguePattern.exec(scriptText)) !== null) {
    const name = match[1].trim();
    // Validate: not too short, not too long, not in exclusions
    if (name.length >= 2 && name.length <= 35 && !exclusions.has(name.toUpperCase())) {
      // Remove common extensions
      const cleanName = name.replace(/\s*\(.*\)\s*$/, '').trim();
      if (cleanName.length >= 2) {
        characters.add(cleanName.toUpperCase());
      }
    }
  }

  return Array.from(characters).slice(0, 100); // Limit to 100 characters
}

/**
 * Cross-validate characters in scenes after AI analysis
 * Checks for characters that might have been missed due to chunk boundaries
 */
function crossValidateSceneCharacters(
  scenes: AIExtractedScene[],
  knownCharacters: string[],
  fullScript: string,
  _chunks: string[] // Keep for potential future use
): void {
  scenes.forEach((scene) => {
    // For each scene, check if any known characters are missing
    const currentChars = new Set(scene.characters.map(c => c.toUpperCase()));

    knownCharacters.forEach((charName) => {
      if (!currentChars.has(charName.toUpperCase())) {
        // Check if this character has dialogue in this scene by looking at the scene content
        // We can use the slugline to find the scene in the full script
        const sluglinePattern = new RegExp(
          scene.slugline.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          'i'
        );
        const sluglineMatch = fullScript.match(sluglinePattern);

        if (sluglineMatch && sluglineMatch.index !== undefined) {
          // Find scene content (from slugline to next scene heading)
          const sceneStart = sluglineMatch.index;
          const nextScenePattern = /\n\s*(?:\d+[A-Z]?\s+)?(?:INT|EXT)\./gi;
          nextScenePattern.lastIndex = sceneStart + 1;
          const nextMatch = nextScenePattern.exec(fullScript);
          const sceneEnd = nextMatch ? nextMatch.index : Math.min(sceneStart + 5000, fullScript.length);
          const sceneContent = fullScript.slice(sceneStart, sceneEnd);

          // Check for character's dialogue cue in this scene
          const charDialoguePattern = new RegExp(
            `^\\s*${charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?:\\([^)]*\\))?\\s*$`,
            'im'
          );

          if (charDialoguePattern.test(sceneContent)) {
            scene.characters.push(charName);
            console.log(`Cross-validation: Added missing character "${charName}" to scene ${scene.sceneNumber}`);
          }
        }
      }
    });

    // Remove duplicates
    scene.characters = [...new Set(scene.characters.map(c => c.toUpperCase()))];
  });
}

export interface AIExtractedScene {
  sceneNumber: string;
  slugline: string;
  intExt: 'INT' | 'EXT';
  location: string;
  timeOfDay: string;
  characters: string[];
  synopsis?: string;
  content: string;
}

export interface AIExtractedCharacter {
  name: string;
  normalizedName: string;
  sceneCount: number;
  dialogueCount: number;
  scenes: string[];
  variants: string[];
  description?: string;
}

/**
 * Split script into processable chunks, trying to break at scene boundaries
 * Updated to handle scene numbers before INT/EXT (e.g., "4 INT. LOCATION - DAY")
 */
function splitScriptIntoChunks(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxSize) {
      chunks.push(remaining);
      break;
    }

    // Try to find a scene heading near the max size to break at
    let breakPoint = maxSize;
    const searchStart = Math.max(0, maxSize - 5000);
    const searchText = remaining.slice(searchStart, maxSize + 1000);

    // Look for scene heading patterns to break at
    // Updated pattern to handle optional leading scene numbers (e.g., "4 INT." or "12A EXT.")
    const scenePattern = /\n\s*(?:\d+[A-Z]?\s+)?(INT\.?|EXT\.?|INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?)\s/gi;
    let lastMatch = null;
    let match;

    while ((match = scenePattern.exec(searchText)) !== null) {
      if (searchStart + match.index <= maxSize) {
        lastMatch = match;
      }
    }

    if (lastMatch) {
      breakPoint = searchStart + lastMatch.index;
    }

    chunks.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint);
  }

  return chunks;
}

/**
 * Analyze a chunk of script text using AI
 * Now includes pre-extracted character list for cross-chunk consistency
 */
async function analyzeScriptChunk(
  chunk: string,
  chunkIndex: number,
  totalChunks: number,
  knownCharacters: string[] = []
): Promise<{ scenes: AIExtractedScene[]; characters: AIExtractedCharacter[] }> {
  // Build character reference section if we have pre-extracted names
  const characterReference = knownCharacters.length > 0
    ? `\nKNOWN CHARACTERS IN THIS SCRIPT (use these exact names when found):\n${knownCharacters.join(', ')}\n\nWhen you encounter any of these characters in a scene, use the EXACT name from this list.\n`
    : '';

  const systemPrompt = `You are an expert screenplay parser. Your job is to analyze screenplay text and extract structured data about scenes and characters.

IMPORTANT RULES:
1. Scene headings (sluglines) start with INT. or EXT. (or INT/EXT, EXT/INT)
2. Scene headings contain a LOCATION and usually a TIME OF DAY (DAY, NIGHT, MORNING, EVENING, CONTINUOUS, etc.)
3. Character names appear in ALL CAPS before their dialogue
4. Character names may have extensions like (V.O.), (O.S.), (CONT'D) - these should be stripped from the normalized name
5. Scene numbers may appear before the INT/EXT (e.g., "15 INT. OFFICE - DAY" or "4A EXT. PARK - NIGHT")
6. Ignore transitions like CUT TO:, FADE IN:, FADE OUT, DISSOLVE TO:, etc.
7. Action/description lines are not character names even if they're uppercase

Return ONLY valid JSON with no additional text or markdown.`;

  const prompt = `Analyze this screenplay text and extract all scenes and characters.
${characterReference}
${totalChunks > 1 ? `This is chunk ${chunkIndex + 1} of ${totalChunks}.` : ''}

SCREENPLAY TEXT:
---
${chunk}
---

Return a JSON object with this exact structure:
{
  "scenes": [
    {
      "sceneNumber": "1",
      "slugline": "INT. COFFEE SHOP - DAY",
      "intExt": "INT",
      "location": "COFFEE SHOP",
      "timeOfDay": "DAY",
      "characters": ["JOHN", "MARY"]
    }
  ],
  "characters": [
    {
      "name": "JOHN",
      "normalizedName": "JOHN",
      "sceneCount": 3,
      "dialogueCount": 5,
      "scenes": ["1", "3", "5"],
      "variants": ["JOHN", "JOHN (V.O.)", "JOHN (CONT'D)"],
      "description": "Brief character description if apparent from script"
    }
  ]
}

IMPORTANT:
- Extract ALL scenes, even if there are many
- Include ALL speaking characters
- Scene numbers should match what's in the script, or be sequential if not numbered
- Characters list should include everyone who speaks, with accurate scene counts
- For intExt, use only "INT" or "EXT"
- For timeOfDay, standardize to: DAY, NIGHT, MORNING, EVENING, CONTINUOUS, or DAWN/DUSK`;

  try {
    const response = await callAI(prompt, { system: systemPrompt, maxTokens: 8000 });

    // Parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in AI response:', response);
      throw new Error('Invalid AI response format');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and clean up the response
    // Note: synopsis is intentionally NOT extracted here - it's generated on-demand per-scene
    const scenes: AIExtractedScene[] = (parsed.scenes || []).map((s: any) => ({
      sceneNumber: String(s.sceneNumber || ''),
      slugline: s.slugline || '',
      intExt: (s.intExt?.toUpperCase() === 'EXT' ? 'EXT' : 'INT') as 'INT' | 'EXT',
      location: s.location || '',
      timeOfDay: s.timeOfDay || 'DAY',
      characters: Array.isArray(s.characters) ? s.characters : [],
      synopsis: '', // Generated on-demand via generateSceneSynopsis()
      content: '', // Will be filled in later if needed
    }));

    const characters: AIExtractedCharacter[] = (parsed.characters || []).map((c: any) => ({
      name: c.name || '',
      normalizedName: c.normalizedName || c.name || '',
      sceneCount: c.sceneCount || 0,
      dialogueCount: c.dialogueCount || 0,
      scenes: Array.isArray(c.scenes) ? c.scenes.map(String) : [],
      variants: Array.isArray(c.variants) ? c.variants : [c.name],
      description: c.description || '',
    }));

    return { scenes, characters };
  } catch (error) {
    console.error('AI parsing failed:', error);
    throw error;
  }
}

/**
 * Generate a synopsis for a scene using AI
 */
export async function generateSceneSynopsis(
  sceneHeading: string,
  sceneContent: string
): Promise<string> {
  const prompt = `Generate a brief 15-25 word synopsis for this screenplay scene:

Scene: ${sceneHeading}

Content:
${sceneContent.slice(0, 2000)}

Return ONLY the synopsis text, no quotes or explanation.`;

  try {
    const synopsis = await callAI(prompt, { maxTokens: 100 });
    return synopsis.trim().replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error('Failed to generate synopsis:', error);
    return '';
  }
}

/**
 * Check if AI service is available
 */
export async function checkAIAvailability(): Promise<boolean> {
  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 10,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
