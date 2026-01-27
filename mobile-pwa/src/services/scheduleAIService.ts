/**
 * AI Service for schedule PDF parsing
 * Uses Claude API to accurately identify scenes from complex schedule formats
 */

import { callAI } from './aiService';
import type {
  ProductionSchedule,
  ScheduleDay,
  ScheduleSceneEntry,
} from '@/types';

export interface AIScheduleProcessingStatus {
  status: 'idle' | 'processing' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  error?: string;
}

// Enable verbose logging for debugging
const DEBUG_AI_PARSING = true;

function debugLog(...args: any[]) {
  if (DEBUG_AI_PARSING) {
    console.log('[ScheduleAI]', ...args);
  }
}

/**
 * Sanitize and repair common JSON issues from AI responses
 * Handles: trailing commas, unclosed brackets, markdown formatting, etc.
 */
function sanitizeAIJSON(jsonStr: string): string {
  let sanitized = jsonStr;

  // Remove markdown code block markers if present (including variations)
  sanitized = sanitized.replace(/^[\s\n]*```(?:json)?[\s\n]*/i, '');
  sanitized = sanitized.replace(/[\s\n]*```[\s\n]*$/i, '');

  // Remove any text before the first { and after the last }
  const firstBrace = sanitized.indexOf('{');
  const lastBrace = sanitized.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    sanitized = sanitized.substring(firstBrace, lastBrace + 1);
  }

  // Remove any leading/trailing whitespace
  sanitized = sanitized.trim();

  // Fix trailing commas before closing brackets (common AI mistake)
  // This regex handles nested structures by repeatedly applying the fix
  let prevLength = 0;
  while (prevLength !== sanitized.length) {
    prevLength = sanitized.length;
    sanitized = sanitized.replace(/,(\s*[\]\}])/g, '$1');
  }

  // Fix missing commas between array elements (e.g., "} {" should be "}, {")
  sanitized = sanitized.replace(/\}(\s*)\{/g, '},$1{');

  // Fix missing commas between string values and objects in arrays
  sanitized = sanitized.replace(/"(\s*)\{/g, '",$1{');
  sanitized = sanitized.replace(/\}(\s*)"/g, '},$1"');

  // Fix missing commas between array elements that are numbers/booleans
  sanitized = sanitized.replace(/(\d)(\s+)(\d)/g, '$1,$2$3');
  sanitized = sanitized.replace(/(true|false|null)(\s+)(true|false|null|\d|"|\{|\[)/gi, '$1,$2$3');

  // Fix unescaped quotes in string values (common issue)
  // This is a simple fix for common cases - not perfect but helps
  sanitized = sanitized.replace(/: "([^"]*)"([^,}\]"]*)"([^,}\]]*)",/g, ': "$1\\"$2\\"$3",');

  // Fix "null" strings that should be null
  sanitized = sanitized.replace(/: "null"/g, ': null');

  // Try to fix truncated JSON by closing unclosed brackets
  const openBraces = (sanitized.match(/\{/g) || []).length;
  const closeBraces = (sanitized.match(/\}/g) || []).length;
  const openBrackets = (sanitized.match(/\[/g) || []).length;
  const closeBrackets = (sanitized.match(/\]/g) || []).length;

  // If JSON appears truncated, try to close it
  if (openBraces > closeBraces || openBrackets > closeBrackets) {
    debugLog('Detected truncated JSON, attempting to repair...');

    // Remove any incomplete trailing content (partial string, etc.)
    // Look for the last complete value
    const lastCompleteMatch = sanitized.match(/^([\s\S]*(?:[\]\}\"\d]|true|false|null))\s*,?\s*[^\]\}\"\d]*$/);
    if (lastCompleteMatch) {
      sanitized = lastCompleteMatch[1];
    }

    // Add missing closing brackets
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      sanitized += ']';
    }
    for (let i = 0; i < openBraces - closeBraces; i++) {
      sanitized += '}';
    }

    // Clean up any trailing commas we may have introduced
    sanitized = sanitized.replace(/,(\s*[\]\}])/g, '$1');
  }

  return sanitized;
}

/**
 * Safely parse JSON from AI response with sanitization and helpful error messages
 */
function parseAIJSON(response: string, context: string = 'AI response'): any {
  debugLog(`parseAIJSON called for ${context}, response length: ${response?.length || 0}`);

  if (!response || response.trim().length === 0) {
    debugLog('ERROR: Empty response');
    throw new Error('Empty AI response');
  }

  // Extract JSON from response - find the outermost { }
  const firstBrace = response.indexOf('{');
  const lastBrace = response.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    debugLog(`ERROR: No JSON object found in ${context}`);
    console.error(`No JSON found in ${context}:`, response.substring(0, 500));
    throw new Error('Failed to parse schedule - no valid JSON in AI response');
  }

  const rawJSON = response.substring(firstBrace, lastBrace + 1);
  debugLog(`Extracted JSON, length: ${rawJSON.length}`);

  // First try parsing as-is
  try {
    const result = JSON.parse(rawJSON);
    debugLog('JSON parsed successfully on first try');
    return result;
  } catch (firstError) {
    debugLog('First JSON parse failed, attempting sanitization...');

    // Try with sanitization
    const sanitized = sanitizeAIJSON(rawJSON);
    try {
      debugLog('Retrying with sanitized JSON...');
      const result = JSON.parse(sanitized);
      debugLog('JSON parsed successfully after sanitization');
      return result;
    } catch (secondError) {
      // Try one more approach: extract just the days array
      debugLog('Second parse failed, trying to extract days array...');
      try {
        const daysMatch = rawJSON.match(/"days"\s*:\s*\[[\s\S]*?\]/);
        if (daysMatch) {
          const wrappedJSON = `{${daysMatch[0]}}`;
          const result = JSON.parse(wrappedJSON);
          debugLog('JSON parsed by extracting days array');
          return result;
        }
      } catch {
        // Fall through to error
      }

      // Provide helpful error message with context
      const errorMsg = secondError instanceof Error ? secondError.message : 'Unknown parse error';
      debugLog(`ERROR: JSON parse failed for ${context}: ${errorMsg}`);
      console.error(`JSON parse failed for ${context}:`);
      console.error('Original error:', firstError);
      console.error('After sanitization:', secondError);
      console.error('Raw JSON (first 1000 chars):', rawJSON.substring(0, 1000));
      console.error('Sanitized JSON (first 1000 chars):', sanitized.substring(0, 1000));

      throw new Error(`Failed to parse AI response: ${errorMsg}. The AI may have returned incomplete or malformed data.`);
    }
  }
}

export type AIScheduleProgressCallback = (status: AIScheduleProcessingStatus) => void;

/**
 * Parse schedule text using AI to extract scenes and shooting days
 * This is designed to handle complex tabular formats that regex cannot reliably parse
 */
export async function parseScheduleWithAI(
  rawText: string,
  existingSchedule: ProductionSchedule,
  onProgress?: AIScheduleProgressCallback
): Promise<ProductionSchedule> {
  debugLog('Starting AI schedule parsing');
  debugLog('Raw text length:', rawText?.length || 0);
  debugLog('Existing schedule days:', existingSchedule.days.length);
  debugLog('Existing cast list:', existingSchedule.castList.length);

  // Validate input
  if (!rawText || rawText.length === 0) {
    debugLog('ERROR: No raw text provided for AI parsing');
    onProgress?.({
      status: 'error',
      progress: 0,
      message: 'No schedule text available for AI analysis',
      error: 'Raw text is empty',
    });
    return existingSchedule;
  }

  onProgress?.({
    status: 'processing',
    progress: 10,
    message: 'Starting AI analysis of schedule...',
  });

  try {
    // Build cast reference for AI
    const castReference = existingSchedule.castList.length > 0
      ? `\nCAST LIST (use these numbers to identify characters):\n${existingSchedule.castList.map(c => `${c.number}. ${c.character || c.name}`).join('\n')}\n`
      : '';

    debugLog('Cast reference built:', castReference.length > 0 ? 'yes' : 'no');

    onProgress?.({
      status: 'processing',
      progress: 20,
      message: 'Analyzing schedule structure...',
    });

    // For large schedules, we may need to process in chunks
    // But first, try processing the whole thing if it's not too large
    const maxChunkSize = 25000; // characters

    debugLog('Processing mode:', rawText.length <= maxChunkSize ? 'full' : 'chunked');

    if (rawText.length <= maxChunkSize) {
      // Process entire schedule at once
      debugLog('Calling analyzeFullSchedule...');
      const result = await analyzeFullSchedule(rawText, castReference);
      debugLog('analyzeFullSchedule result:', result.days.length, 'days');

      const totalScenes = result.days.reduce((sum, d) => sum + d.scenes.length, 0);
      debugLog('Total scenes found by AI:', totalScenes);

      onProgress?.({
        status: 'complete',
        progress: 100,
        message: `Successfully identified ${totalScenes} scenes across ${result.days.length} days`,
      });

      return {
        ...existingSchedule,
        days: result.days.length > 0 ? result.days : existingSchedule.days,
        totalDays: result.days.length > 0 ? result.days.length : existingSchedule.totalDays,
      };
    }

    // For larger schedules, process by shooting day
    const chunks = splitScheduleByDays(rawText);
    debugLog('Split into', chunks.length, 'day chunks');

    onProgress?.({
      status: 'processing',
      progress: 30,
      message: `Found ${chunks.length} shooting days to analyze...`,
    });

    const allDays: ScheduleDay[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const progress = 30 + Math.round((i / chunks.length) * 60);

      debugLog(`Processing chunk ${i + 1}/${chunks.length}, day ${chunk.dayNumber}`);

      onProgress?.({
        status: 'processing',
        progress,
        message: `Analyzing Day ${chunk.dayNumber || i + 1}...`,
      });

      try {
        const dayResult = await analyzeDayChunk(chunk.text, chunk.dayNumber, castReference);
        if (dayResult && dayResult.scenes.length > 0) {
          debugLog(`Day ${chunk.dayNumber}: found ${dayResult.scenes.length} scenes`);
          allDays.push(dayResult);
        } else {
          debugLog(`Day ${chunk.dayNumber}: no scenes found`);
        }
      } catch (error) {
        debugLog(`ERROR: Failed to analyze day ${i + 1}:`, error);
        console.error(`Failed to analyze day ${i + 1}:`, error);
        // Continue with other days
      }
    }

    onProgress?.({
      status: 'processing',
      progress: 95,
      message: 'Finalizing results...',
    });

    // Sort days by day number
    allDays.sort((a, b) => a.dayNumber - b.dayNumber);

    const totalScenes = allDays.reduce((sum, d) => sum + d.scenes.length, 0);
    debugLog('Total scenes found across all chunks:', totalScenes);

    onProgress?.({
      status: 'complete',
      progress: 100,
      message: `Successfully identified ${totalScenes} scenes across ${allDays.length} days`,
    });

    return {
      ...existingSchedule,
      days: allDays.length > 0 ? allDays : existingSchedule.days,
      totalDays: allDays.length > 0 ? allDays.length : existingSchedule.totalDays,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    debugLog('ERROR: AI schedule parsing failed:', errorMessage);
    console.error('AI schedule parsing failed:', error);

    onProgress?.({
      status: 'error',
      progress: 0,
      message: 'Failed to analyze schedule with AI',
      error: errorMessage,
    });

    // Return existing schedule on error rather than throwing
    return existingSchedule;
  }
}

/**
 * Analyze the full schedule text at once
 */
async function analyzeFullSchedule(
  text: string,
  castReference: string
): Promise<{ days: ScheduleDay[] }> {
  debugLog('analyzeFullSchedule called, text length:', text.length);

  const systemPrompt = `You are an expert at parsing film production shooting schedules. Your job is to extract ALL scenes from a schedule PDF that has been converted to text.

CRITICAL: This schedule has a SPECIFIC FORMAT where each scene entry ends with "pgs Scenes:" as a delimiter.

SCENE FORMAT PATTERN A - Scene number at START of synopsis line:
\`\`\`
EXT FARMHOUSE - DRIVEWAY
Day
1/8
4A TAXI passes the road to the Farmhouse
pgs Scenes:
:30
Est. Time
\`\`\`
This gives: Scene 4A, EXT, FARMHOUSE - DRIVEWAY, Day, synopsis "TAXI passes the road to the Farmhouse"

SCENE FORMAT PATTERN B - Scene number on SEPARATE line after cast:
\`\`\`
EXT FARMHOUSE
Day
1 6/8
They meet INGA & JOHN
1, 2, 4, 7
7
pgs Scenes:
1:30
Est. Time
\`\`\`
This gives: Scene 7, EXT, FARMHOUSE, Day, synopsis "They meet INGA & JOHN", cast [1, 2, 4, 7]

HOW TO IDENTIFY EACH FORMAT:
- Format A: Line before "pgs Scenes:" starts with a scene number like "4A", "18B" followed by text
- Format B: Line before "pgs Scenes:" is JUST a scene number (like "7"), and the synopsis is higher up

CRITICAL DISTINCTIONS:
- SCENE NUMBERS: Standalone like "7", "4A", "18B", "106A p1", "14pt" - NOT comma-separated
- CAST NUMBERS: Comma-separated lists like "1, 2, 4, 7" - these are NOT scene numbers!
- Page counts look like "1/8", "2 3/8", "1 6/8" (fractions of 8ths)

STRUCTURE OF EACH SCENE ENTRY:
1. INT/EXT + LOCATION (e.g., "EXT FARMHOUSE - DRIVEWAY" or just "EXT FARMHOUSE")
2. Time of day (Day, Night, Morning, Evening)
3. Page count (e.g., "1/8", "2 3/8")
4. Synopsis/description line
5. Cast numbers (comma-separated, if present)
6. Scene number (either embedded in synopsis or on own line)
7. "pgs Scenes:" delimiter
8. Estimated time
9. "Est. Time" label

IMPORTANT PATTERNS:
- "End of Shooting Day X" marks the end of each shooting day
- Look for the "pgs Scenes:" delimiter to identify scene boundaries
- Story day markers like "D5" mean "Day 5 in the story", "N8" means "Night 8"

Return ONLY valid JSON with no additional text, no markdown code blocks.`;

  const prompt = `Extract ALL scenes from this shooting schedule, organized by shooting day.
${castReference}
SCHEDULE TEXT:
---
${text}
---

Return a JSON object with this exact structure:
{
  "days": [
    {
      "dayNumber": 1,
      "date": "2024-05-21 or null",
      "dayOfWeek": "Tuesday or null",
      "location": "The Crown, Framlingham",
      "scenes": [
        {
          "sceneNumber": "21",
          "pages": "2",
          "intExt": "INT",
          "dayNight": "D5",
          "setLocation": "MARGOT'S BEDROOM - PLUMHILL MANOR",
          "description": "Margot wakes to a call from Calvaux.",
          "castNumbers": [1],
          "estimatedTime": "3:00",
          "shootOrder": 1
        }
      ]
    }
  ]
}

CRITICAL INSTRUCTIONS:
1. Extract EVERY scene - look for "pgs Scenes:" delimiters to find each scene boundary
2. Scene numbers: exactly as shown (4A, 4B, 6, 7, 8, 9, 18B, 106A p1, 14pt, etc.)
3. For Format A: scene number is at START of synopsis line (e.g., "4A TAXI passes..." → scene 4A)
4. For Format B: scene number is on its OWN LINE just before "pgs Scenes:" (standalone number like "7")
5. NEVER confuse cast lists "1, 2, 4, 7" (comma-separated) with scene numbers (standalone)
6. dayNight: extract story day marker if present (D5, D4, N8) otherwise use "Day" or "Night"
7. castNumbers: array of integers from comma-separated cast lists (e.g., "1, 2, 4, 7" → [1, 2, 4, 7])
8. shootOrder: order scenes appear within each shooting day (1, 2, 3...)
9. Group by shooting day using "End of Shooting Day X" markers
10. For Day 1, expect scenes like: 4A, 4B, 6, 7, 8, 9 (six scenes)
11. Return ONLY the JSON object, no explanation, no markdown`;

  try {
    debugLog('Calling AI for full schedule analysis...');
    const response = await callAI(prompt, { system: systemPrompt, maxTokens: 8000 });
    debugLog('AI response received, length:', response?.length || 0);

    if (!response) {
      debugLog('ERROR: Empty AI response');
      return { days: [] };
    }

    // Log a snippet of the response for debugging
    debugLog('Response preview:', response.substring(0, 500));

    // Parse the JSON response with sanitization for common AI mistakes
    let parsed;
    try {
      parsed = parseAIJSON(response, 'full schedule analysis');
      debugLog('JSON parsed successfully');
    } catch (parseError) {
      debugLog('ERROR: JSON parsing failed:', parseError);
      console.error('JSON parsing failed:', parseError);
      return { days: [] };
    }

    if (!parsed || !parsed.days) {
      debugLog('ERROR: Parsed response missing days array');
      return { days: [] };
    }

    debugLog('Parsed days count:', parsed.days.length);

    // Convert to proper format
    const days: ScheduleDay[] = (parsed.days || []).map((day: any, dayIdx: number) => {
      const scenes = (day.scenes || []).map((s: any, idx: number) => ({
        sceneNumber: String(s.sceneNumber || ''),
        pages: s.pages || undefined,
        intExt: (s.intExt?.toUpperCase() === 'EXT' ? 'EXT' : 'INT') as 'INT' | 'EXT',
        dayNight: s.dayNight || 'Day',
        setLocation: s.setLocation || '',
        description: s.description || undefined,
        castNumbers: Array.isArray(s.castNumbers) ? s.castNumbers.filter((n: any) => typeof n === 'number') : [],
        estimatedTime: s.estimatedTime || undefined,
        shootOrder: s.shootOrder || idx + 1,
      })).filter((s: ScheduleSceneEntry) => s.sceneNumber);

      debugLog(`Day ${dayIdx + 1}: ${scenes.length} valid scenes`);

      return {
        dayNumber: day.dayNumber || dayIdx + 1,
        date: day.date || undefined,
        dayOfWeek: day.dayOfWeek || undefined,
        location: day.location || '',
        scenes,
      };
    }).filter((d: ScheduleDay) => d.scenes.length > 0);

    debugLog('Final days with scenes:', days.length);
    return { days };
  } catch (error) {
    debugLog('ERROR: analyzeFullSchedule failed:', error);
    console.error('analyzeFullSchedule error:', error);
    return { days: [] };
  }
}

/**
 * Split schedule text by shooting day boundaries
 */
function splitScheduleByDays(text: string): Array<{ text: string; dayNumber: number }> {
  const chunks: Array<{ text: string; dayNumber: number }> = [];

  // Find all "End of Shooting Day X" markers
  const endOfDayPattern = /End of Shooting Day\s+(\d+)[^\n]*/gi;
  const matches: Array<{ index: number; endIndex: number; dayNumber: number }> = [];

  let match;
  while ((match = endOfDayPattern.exec(text)) !== null) {
    matches.push({
      index: match.index,
      endIndex: match.index + match[0].length,
      dayNumber: parseInt(match[1], 10),
    });
  }

  if (matches.length === 0) {
    // No day markers found - return entire text as day 1
    return [{ text, dayNumber: 1 }];
  }

  // Create chunks for each day
  let startIndex = 0;
  for (const m of matches) {
    const chunkText = text.slice(startIndex, m.endIndex);
    chunks.push({
      text: chunkText,
      dayNumber: m.dayNumber,
    });
    startIndex = m.endIndex;
  }

  return chunks;
}

/**
 * Analyze a single day's chunk of schedule text
 */
async function analyzeDayChunk(
  chunkText: string,
  dayNumber: number,
  castReference: string
): Promise<ScheduleDay | null> {
  debugLog(`analyzeDayChunk called for day ${dayNumber}, text length: ${chunkText.length}`);

  const systemPrompt = `You are an expert at parsing film production shooting schedules. Extract all scenes from this portion of a schedule.

CRITICAL: Each scene entry ends with "pgs Scenes:" as a delimiter. Use this to identify scene boundaries.

SCENE FORMAT PATTERN A - Scene number at START of synopsis line:
\`\`\`
EXT FARMHOUSE - DRIVEWAY
Day
1/8
4A TAXI passes the road to the Farmhouse
pgs Scenes:
\`\`\`
Result: Scene 4A, EXT, "FARMHOUSE - DRIVEWAY", synopsis "TAXI passes the road to the Farmhouse"

SCENE FORMAT PATTERN B - Scene number on SEPARATE line after cast:
\`\`\`
EXT FARMHOUSE
Day
1 6/8
They meet INGA & JOHN
1, 2, 4, 7
7
pgs Scenes:
\`\`\`
Result: Scene 7, EXT, "FARMHOUSE", synopsis "They meet INGA & JOHN", cast [1, 2, 4, 7]

HOW TO IDENTIFY:
- Format A: Line before "pgs Scenes:" starts with scene number + text (e.g., "4A TAXI...")
- Format B: Line before "pgs Scenes:" is JUST a standalone number (e.g., "7")

CRITICAL DISTINCTIONS:
- SCENE NUMBERS: Standalone like "7", "4A", "18B" - NOT comma-separated
- CAST NUMBERS: Comma-separated lists like "1, 2, 4, 7" - these are NOT scene numbers!

Return ONLY valid JSON, no markdown code blocks.`;

  const prompt = `Extract ALL scenes from this shooting day.
${castReference}
SCHEDULE TEXT FOR DAY ${dayNumber}:
---
${chunkText.slice(0, 15000)}
---

Return JSON:
{
  "date": "2024-05-21 or null",
  "dayOfWeek": "Tuesday or null",
  "location": "Main location name",
  "scenes": [
    {
      "sceneNumber": "21",
      "pages": "2",
      "intExt": "INT",
      "dayNight": "D5",
      "setLocation": "MARGOT'S BEDROOM - PLUMHILL MANOR",
      "description": "Scene action description",
      "castNumbers": [1, 3],
      "estimatedTime": "3:00",
      "shootOrder": 1
    }
  ]
}

CRITICAL INSTRUCTIONS:
1. Extract EVERY scene - use "pgs Scenes:" as the delimiter between scenes
2. For Format A: scene number is at START of line before "pgs Scenes:" (e.g., "4A TAXI..." → scene 4A)
3. For Format B: scene number is STANDALONE on its own line just before "pgs Scenes:" (e.g., "7")
4. NEVER confuse cast lists "1, 2, 4, 7" (comma-separated) with scene numbers (standalone)
5. Scene numbers exactly as shown: 4A, 4B, 6, 7, 8, 9, 18B, 106A p1, etc.
6. castNumbers: array of integers from comma-separated lists
Return ONLY the JSON object, no explanation, no markdown.`;

  try {
    debugLog(`Calling AI for day ${dayNumber}...`);
    const response = await callAI(prompt, { system: systemPrompt, maxTokens: 4000 });
    debugLog(`Day ${dayNumber} AI response length:`, response?.length || 0);

    if (!response) {
      debugLog(`ERROR: Empty AI response for day ${dayNumber}`);
      return null;
    }

    // Parse the JSON response with sanitization for common AI mistakes
    let parsed;
    try {
      parsed = parseAIJSON(response, `day ${dayNumber} analysis`);
      debugLog(`Day ${dayNumber} JSON parsed successfully`);
    } catch (parseError) {
      debugLog(`ERROR: No valid JSON in AI response for day ${dayNumber}:`, parseError);
      console.error('No valid JSON in AI response for day', dayNumber, parseError);
      return null;
    }

    // Extract metadata from text
    const dateMatch = chunkText.match(/(\w+day)[,\s]+(\d{1,2})\s+(\w+)\s+(\d{4})/i);
    let date = parsed.date;
    let dayOfWeek = parsed.dayOfWeek;
    if (!date && dateMatch) {
      dayOfWeek = dateMatch[1];
      const day = dateMatch[2].padStart(2, '0');
      const month = monthToNumber(dateMatch[3]);
      const year = dateMatch[4];
      if (month) {
        date = `${year}-${month}-${day}`;
      }
    }

    // Extract sunrise/sunset
    const srMatch = chunkText.match(/SR[:\s]*(\d{2}):?(\d{2})/i);
    const ssMatch = chunkText.match(/SS[:\s]*(\d{2}):?(\d{2})/i);

    // Extract notes
    const notes: string[] = [];
    if (/UNIT\s+MOVE/i.test(chunkText)) notes.push('UNIT MOVE');
    if (/Drone\s+Day/i.test(chunkText)) notes.push('Drone Day');
    if (/Load\s*in/i.test(chunkText)) notes.push('Load In');
    if (/Load\s*Out/i.test(chunkText)) notes.push('Load Out');
    if (/Lighting\s+Change/i.test(chunkText)) notes.push('Lighting Change');

    // Total pages
    const totalPagesMatch = chunkText.match(/(\d+\s*\d*\/?\d*)\s*Pages?/i);

    const scenes: ScheduleSceneEntry[] = (parsed.scenes || []).map((s: any, idx: number) => ({
      sceneNumber: String(s.sceneNumber || ''),
      pages: s.pages || undefined,
      intExt: (s.intExt?.toUpperCase() === 'EXT' ? 'EXT' : 'INT') as 'INT' | 'EXT',
      dayNight: s.dayNight || 'Day',
      setLocation: s.setLocation || '',
      description: s.description || undefined,
      castNumbers: Array.isArray(s.castNumbers) ? s.castNumbers.filter((n: any) => typeof n === 'number') : [],
      estimatedTime: s.estimatedTime || undefined,
      shootOrder: s.shootOrder || idx + 1,
    })).filter((s: ScheduleSceneEntry) => s.sceneNumber);

    return {
      dayNumber,
      date: date || undefined,
      dayOfWeek: dayOfWeek || undefined,
      location: parsed.location || '',
      sunrise: srMatch ? `${srMatch[1]}:${srMatch[2]}` : undefined,
      sunset: ssMatch ? `${ssMatch[1]}:${ssMatch[2]}` : undefined,
      notes: notes.length > 0 ? notes : undefined,
      scenes,
      totalPages: totalPagesMatch ? totalPagesMatch[1].trim() : undefined,
    };
  } catch (error) {
    console.error('AI day chunk parsing failed:', error);
    return null;
  }
}

/**
 * Helper to convert month name to number
 */
function monthToNumber(month: string): string | null {
  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12',
  };
  return months[month.toLowerCase()] || null;
}

/**
 * Check if AI processing would be beneficial based on initial parse results
 */
export function shouldUseAIProcessing(schedule: ProductionSchedule): boolean {
  // If no scenes were found, definitely try AI
  const totalScenes = schedule.days.reduce((sum, d) => sum + d.scenes.length, 0);
  if (totalScenes === 0) return true;

  // If we have very few scenes relative to days, AI might help
  const avgScenesPerDay = totalScenes / (schedule.days.length || 1);
  if (avgScenesPerDay < 3) return true;

  // If we have raw text but few parsed results
  if (schedule.rawText && schedule.rawText.length > 5000 && totalScenes < 10) return true;

  // Always use AI for better accuracy
  return true;
}

/**
 * Parse a single day's text with AI (exported for Stage 2 processing)
 * This is the main entry point for day-by-day background processing
 */
export async function parseSingleDayWithAI(
  dayNumber: number,
  dayText: string,
  castReference: string
): Promise<ScheduleDay | null> {
  debugLog(`parseSingleDayWithAI called for day ${dayNumber}`);

  if (!dayText || dayText.length < 50) {
    debugLog(`Day ${dayNumber}: Text too short, skipping`);
    return null;
  }

  // Format cast reference for AI
  const castContext = castReference
    ? `\nCAST LIST (use these numbers):\n${castReference}\n`
    : '';

  return analyzeDayChunk(dayText, dayNumber, castContext);
}
