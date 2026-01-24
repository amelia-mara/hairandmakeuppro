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

    onProgress?.({
      status: 'processing',
      progress: 20,
      message: 'Analyzing schedule structure...',
    });

    // For large schedules, we may need to process in chunks
    // But first, try processing the whole thing if it's not too large
    const maxChunkSize = 25000; // characters

    if (rawText.length <= maxChunkSize) {
      // Process entire schedule at once
      const result = await analyzeFullSchedule(rawText, castReference);

      onProgress?.({
        status: 'complete',
        progress: 100,
        message: `Successfully identified ${result.days.reduce((sum, d) => sum + d.scenes.length, 0)} scenes across ${result.days.length} days`,
      });

      return {
        ...existingSchedule,
        days: result.days,
        totalDays: result.days.length,
      };
    }

    // For larger schedules, process by shooting day
    const chunks = splitScheduleByDays(rawText);

    onProgress?.({
      status: 'processing',
      progress: 30,
      message: `Found ${chunks.length} shooting days to analyze...`,
    });

    const allDays: ScheduleDay[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const progress = 30 + Math.round((i / chunks.length) * 60);

      onProgress?.({
        status: 'processing',
        progress,
        message: `Analyzing Day ${chunk.dayNumber || i + 1}...`,
      });

      try {
        const dayResult = await analyzeDayChunk(chunk.text, chunk.dayNumber, castReference);
        if (dayResult && dayResult.scenes.length > 0) {
          allDays.push(dayResult);
        }
      } catch (error) {
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
    onProgress?.({
      status: 'error',
      progress: 0,
      message: 'Failed to analyze schedule with AI',
      error: errorMessage,
    });
    throw error;
  }
}

/**
 * Analyze the full schedule text at once
 */
async function analyzeFullSchedule(
  text: string,
  castReference: string
): Promise<{ days: ScheduleDay[] }> {
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

Return ONLY valid JSON with no additional text.`;

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
9. Extract the date from patterns like "Tuesday, 21 May 2024"`;

  const response = await callAI(prompt, { system: systemPrompt, maxTokens: 8000 });

  // Parse the JSON response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('No JSON found in AI response:', response.substring(0, 500));
    throw new Error('Failed to parse schedule - invalid AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Convert to proper format
  const days: ScheduleDay[] = (parsed.days || []).map((day: any) => ({
    dayNumber: day.dayNumber || 1,
    date: day.date || undefined,
    dayOfWeek: day.dayOfWeek || undefined,
    location: day.location || '',
    scenes: (day.scenes || []).map((s: any, idx: number) => ({
      sceneNumber: String(s.sceneNumber || ''),
      pages: s.pages || undefined,
      intExt: (s.intExt?.toUpperCase() === 'EXT' ? 'EXT' : 'INT') as 'INT' | 'EXT',
      dayNight: s.dayNight || 'Day',
      setLocation: s.setLocation || '',
      description: s.description || undefined,
      castNumbers: Array.isArray(s.castNumbers) ? s.castNumbers.filter((n: any) => typeof n === 'number') : [],
      estimatedTime: s.estimatedTime || undefined,
      shootOrder: s.shootOrder || idx + 1,
    })).filter((s: ScheduleSceneEntry) => s.sceneNumber),
  })).filter((d: ScheduleDay) => d.scenes.length > 0);

  return { days };
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
  const systemPrompt = `You are an expert at parsing film production shooting schedules. Extract all scenes from this portion of a schedule.

The schedule uses a TABLE FORMAT with columns for:
- Scene number, Page count, INT/EXT, Time of day, Location, Description, Cast numbers, Est. time, Story day marker

Look for:
- "Scene X" patterns to identify scene entries
- Story day markers like D5, N8 (Day 5, Night 8 in the story)
- Cast numbers as single digits or comma-separated lists
- Locations in ALL CAPS
- Descriptions in mixed case

Return ONLY valid JSON.`;

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

Extract EVERY scene. Scene numbers exactly as shown. dayNight = story day marker (D5, N8, etc).`;

  try {
    const response = await callAI(prompt, { system: systemPrompt, maxTokens: 4000 });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON in AI response for day', dayNumber);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

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
