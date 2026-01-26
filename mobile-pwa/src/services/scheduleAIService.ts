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

CRITICAL: The schedule uses a TABLE FORMAT where each scene has these columns:
1. Scene number (e.g., "Scene 21", "Scene 14", "Scene 49", "Scene 61A")
2. Page count (e.g., "2 pgs", "1 4/8 pgs", "2/8 pgs")
3. INT or EXT (interior/exterior)
4. Time of day (Day, Night, Morning)
5. Location in CAPS (e.g., "MARGOT'S BEDROOM - PLUMHILL MANOR", "KITCHEN - PLUMHILL MANOR")
6. Scene description in mixed case (the action/synopsis)
7. Cast numbers (single digits or comma-separated like "1, 3" or "1, 2, 3, 7")
8. Estimated time (like "3:00", "1:30", ":30")
9. Story day marker (D5, D4, D6, D8, N8, N7, etc. - this indicates which story day)
10. Remarks (optional notes)

IMPORTANT PATTERNS:
- "End of Shooting Day X" marks the end of each shooting day's scenes
- Look for scene rows that have "Scene" followed by a number
- Story day markers like "D5" mean "Day 5 in the story timeline", "N8" means "Night 8"
- Cast numbers reference the cast list and appear as single digits or lists
- Locations are typically ALL CAPS
- Scene descriptions/synopses are typically mixed case
- The schedule may have TWO-ROW format where "Scene" is on one line and scene number on next line

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
1. Extract EVERY scene you can find - don't skip any
2. Scene numbers should be exactly as shown (21, 14, 49, 62, 71, 73, 61A, 14pt, etc.)
3. dayNight should be the STORY DAY marker (D5, D4, N8, etc.) NOT just "Day" or "Night"
4. castNumbers should be an array of integers (the cast ID numbers)
5. shootOrder should be the order scenes appear within each shooting day (1, 2, 3...)
6. Group scenes by shooting day based on "End of Shooting Day X" markers
7. For intExt, use only "INT" or "EXT"
8. Look for patterns like "Scene 21" or "Sc 21" to identify scene entries
9. Extract the date from patterns like "Tuesday, 21 May 2024"
10. Return ONLY the JSON object, no explanation, no markdown`;

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

The schedule uses a TABLE FORMAT with columns for:
- Scene number, Page count, INT/EXT, Time of day, Location, Description, Cast numbers, Est. time, Story day marker

Look for:
- "Scene X" patterns to identify scene entries
- Story day markers like D5, N8 (Day 5, Night 8 in the story)
- Cast numbers as single digits or comma-separated lists
- Locations in ALL CAPS
- Descriptions in mixed case
- The schedule may have TWO-ROW format where "Scene" is on one line and scene number on next line

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

Extract EVERY scene. Scene numbers exactly as shown. dayNight = story day marker (D5, N8, etc).
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
