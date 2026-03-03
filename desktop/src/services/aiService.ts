/**
 * Desktop AI Service for character detection.
 * Adapted from shared/services/aiService.ts — uses /api/ai proxy endpoint.
 */
import type { ParsedScene, DetectedCharacter } from '../types/breakdown';

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  content: Array<{ type: string; text: string }>;
}

/**
 * Call the AI API with retry logic and exponential backoff.
 */
async function callAI(
  prompt: string,
  options: { system?: string; maxTokens?: number; maxRetries?: number } = {},
): Promise<string> {
  const { system, maxTokens = 4000, maxRetries = 3 } = options;
  const messages: AIMessage[] = [{ role: 'user', content: prompt }];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, system, maxTokens, model: 'claude-sonnet-4-20250514' }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.error?.message || errorData.error || '';

        if (response.status === 429 && (msg.includes('usage limit') || msg.includes('will regain access'))) {
          throw new Error(msg || 'API usage limits reached.');
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid API key. Please check your configuration.');
        }
        if (response.status === 429 || response.status === 529 || response.status >= 500) {
          const wait = Math.pow(2, attempt + 1) * 1000;
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw new Error(msg || `API error: ${response.status}`);
      }

      const data: AIResponse = await response.json();
      if (data.content && data.content.length > 0) {
        return data.content[0].text;
      }
      throw new Error('Empty response from AI');
    } catch (error) {
      lastError = error as Error;
      const msg = lastError.message || '';
      if (msg.includes('Invalid API key') || msg.includes('usage limit')) throw lastError;

      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt + 1) * 1000));
      }
    }
  }

  throw lastError || new Error('AI call failed after retries');
}

/**
 * Pre-extract character names from dialogue cues via regex.
 */
function preExtractCharacters(scriptText: string): string[] {
  const characters = new Set<string>();
  const exclusions = new Set([
    'INT', 'EXT', 'FADE', 'CUT', 'DISSOLVE', 'CONTINUED', 'THE END',
    'TITLE', 'SUPER', 'INSERT', 'BACK TO', 'FLASHBACK', 'END FLASHBACK',
    'LATER', 'CONTINUOUS', 'SAME', 'MORNING', 'AFTERNOON', 'EVENING',
    'NIGHT', 'DAY', 'DAWN', 'DUSK', 'MOMENTS', 'MORE', 'MONTAGE',
  ]);

  const dialoguePattern = /^([A-Z][A-Z\s.'-]{1,30})\s*(?:\([^)]*\))?\s*$/gm;
  let match;
  while ((match = dialoguePattern.exec(scriptText)) !== null) {
    const name = match[1].trim().replace(/\s*\(.*\)\s*$/, '').trim();
    if (name.length >= 2 && name.length <= 35 && !exclusions.has(name.toUpperCase())) {
      characters.add(name.toUpperCase());
    }
  }

  return Array.from(characters).slice(0, 100);
}

/**
 * Split script into chunks for long scripts, breaking at scene boundaries.
 */
function splitIntoChunks(text: string, maxSize = 30000): string[] {
  if (text.length <= maxSize) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxSize) {
      chunks.push(remaining);
      break;
    }

    let breakPoint = maxSize;
    const searchStart = Math.max(0, maxSize - 5000);
    const searchText = remaining.slice(searchStart, maxSize + 1000);
    const scenePat = /\n\s*(?:\d+[A-Z]?\s+)?(INT\.?|EXT\.?|INT\.?\/EXT\.?)\s/gi;
    let lastMatch = null;
    let m;
    while ((m = scenePat.exec(searchText)) !== null) {
      if (searchStart + m.index <= maxSize) lastMatch = m;
    }
    if (lastMatch) breakPoint = searchStart + lastMatch.index;

    chunks.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint);
  }

  return chunks;
}

interface AIExtractedScene {
  sceneNumber: string;
  slugline: string;
  intExt: string;
  location: string;
  timeOfDay: string;
  characters: string[];
}

interface AIExtractedCharacter {
  name: string;
  normalizedName: string;
  sceneCount: number;
  dialogueCount: number;
  scenes: string[];
  variants: string[];
  description?: string;
}

/**
 * Detect characters in scenes using AI.
 * Sends script to Claude via /api/ai for full scene + character extraction.
 */
export async function detectCharactersWithAI(
  scenes: ParsedScene[],
  rawText: string,
  onProgress?: (msg: string) => void,
): Promise<DetectedCharacter[]> {
  onProgress?.('Pre-extracting character names...');
  const preExtracted = preExtractCharacters(rawText);

  const chunks = splitIntoChunks(rawText);
  const characterMap = new Map<string, { name: string; sceneIds: Set<string>; dialogueCount: number }>();

  // Build scene ID lookup by scene number for mapping AI results back
  const sceneByNumber = new Map(scenes.map((s) => [s.sceneNumber, s]));

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(`Analyzing section ${i + 1} of ${chunks.length}...`);

    const charRef = preExtracted.length > 0
      ? `\nKNOWN CHARACTERS IN THIS SCRIPT:\n${preExtracted.join(', ')}\n\nUse these exact names when found.\n`
      : '';

    const systemPrompt = `You are an expert screenplay parser. Extract structured data about scenes and characters.
RULES:
1. Scene headings start with INT. or EXT. (or INT/EXT)
2. Character names appear in ALL CAPS before dialogue
3. Strip extensions like (V.O.), (O.S.), (CONT'D) from normalized names
4. Scene numbers may appear before INT/EXT (e.g. "15 INT. OFFICE - DAY")
5. Include characters physically present but not speaking
6. Return ONLY valid JSON with no additional text.`;

    const prompt = `Analyze this screenplay text and extract all scenes and characters.
${charRef}
${chunks.length > 1 ? `This is chunk ${i + 1} of ${chunks.length}.` : ''}

SCREENPLAY TEXT:
---
${chunks[i]}
---

Return JSON:
{
  "scenes": [{ "sceneNumber": "1", "slugline": "INT. COFFEE SHOP - DAY", "intExt": "INT", "location": "COFFEE SHOP", "timeOfDay": "DAY", "characters": ["JOHN", "MARY"] }],
  "characters": [{ "name": "JOHN", "normalizedName": "JOHN", "sceneCount": 3, "dialogueCount": 5, "scenes": ["1", "3", "5"], "variants": ["JOHN", "JOHN (V.O.)"], "description": "" }]
}

Extract ALL scenes and ALL characters (including non-speaking).`;

    try {
      const response = await callAI(prompt, { system: systemPrompt, maxTokens: 8000 });
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      const parsed = JSON.parse(jsonMatch[0]);
      const aiCharacters: AIExtractedCharacter[] = parsed.characters || [];

      for (const c of aiCharacters) {
        const normalized = c.normalizedName || c.name;
        const existing = characterMap.get(normalized);
        if (existing) {
          for (const sn of c.scenes) {
            const scene = sceneByNumber.get(sn);
            if (scene) existing.sceneIds.add(scene.id);
          }
          existing.dialogueCount += c.dialogueCount || 0;
        } else {
          const sceneIds = new Set<string>();
          for (const sn of c.scenes) {
            const scene = sceneByNumber.get(sn);
            if (scene) sceneIds.add(scene.id);
          }
          characterMap.set(normalized, {
            name: normalized,
            sceneIds,
            dialogueCount: c.dialogueCount || 0,
          });
        }
      }
    } catch (err) {
      console.error(`AI chunk ${i + 1} failed:`, err);
    }
  }

  onProgress?.('Character detection complete');

  let charIdCounter = 0;
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
        id: `aichar-${Date.now()}-${++charIdCounter}`,
        name: c.name,
        sceneCount,
        roleType,
        scenes: Array.from(c.sceneIds),
      };
    });

  return characters;
}

/**
 * Check if the AI endpoint is reachable.
 */
export async function checkAIAvailability(): Promise<boolean> {
  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }], maxTokens: 10 }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
