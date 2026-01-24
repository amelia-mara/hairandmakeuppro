/**
 * AI Service for schedule PDF parsing
 * Uses Claude API to accurately identify scenes from complex schedule formats
 */

import { callAI } from './aiService';
import type {
  ProductionSchedule,
  ScheduleDay,
  ScheduleSceneEntry,
  ScheduleCastMember,
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
    // Split text into manageable chunks by shooting day markers
    const chunks = splitScheduleIntoChunks(rawText);

    onProgress?.({
      status: 'processing',
      progress: 20,
      message: `Found ${chunks.length} sections to analyze...`,
    });

    const allDays: ScheduleDay[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const progress = 20 + Math.round((i / chunks.length) * 60);

      onProgress?.({
        status: 'processing',
        progress,
        message: `Analyzing section ${i + 1} of ${chunks.length}...`,
      });

      try {
        const dayResult = await analyzeScheduleChunk(
          chunk.text,
          chunk.dayNumber,
          existingSchedule.castList
        );

        if (dayResult) {
          allDays.push(dayResult);
        }
      } catch (error) {
        console.error(`Failed to analyze chunk ${i + 1}:`, error);
        // Continue with other chunks
      }
    }

    onProgress?.({
      status: 'processing',
      progress: 85,
      message: 'Merging and validating results...',
    });

    // Merge AI-parsed days with existing schedule metadata
    const mergedSchedule = mergeScheduleResults(existingSchedule, allDays);

    onProgress?.({
      status: 'complete',
      progress: 100,
      message: `Successfully identified ${mergedSchedule.days.reduce((sum, d) => sum + d.scenes.length, 0)} scenes across ${mergedSchedule.days.length} days`,
    });

    return mergedSchedule;
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
 * Split schedule text into chunks by shooting day boundaries
 */
function splitScheduleIntoChunks(text: string): Array<{ text: string; dayNumber: number | null }> {
  const chunks: Array<{ text: string; dayNumber: number | null }> = [];

  // Split by "End of Shooting Day" markers
  const endOfDayPattern = /End of Shooting Day\s+(\d+)/gi;
  const matches: Array<{ index: number; dayNumber: number }> = [];

  let match;
  while ((match = endOfDayPattern.exec(text)) !== null) {
    matches.push({
      index: match.index + match[0].length,
      dayNumber: parseInt(match[1], 10),
    });
  }

  if (matches.length === 0) {
    // No day markers found - process as single chunk
    return [{ text, dayNumber: null }];
  }

  // Create chunks from start to each day end
  let startIndex = 0;
  for (let i = 0; i < matches.length; i++) {
    const chunkText = text.slice(startIndex, matches[i].index);
    chunks.push({
      text: chunkText,
      dayNumber: matches[i].dayNumber,
    });
    startIndex = matches[i].index;
  }

  return chunks;
}

/**
 * Analyze a single schedule chunk using AI
 */
async function analyzeScheduleChunk(
  chunkText: string,
  dayNumber: number | null,
  castList: ScheduleCastMember[]
): Promise<ScheduleDay | null> {
  // Build cast reference for AI
  const castReference = castList.length > 0
    ? `\nCAST LIST (use these numbers to identify characters):\n${castList.map(c => `${c.number}. ${c.character || c.name}`).join('\n')}\n`
    : '';

  const systemPrompt = `You are an expert at parsing film production shooting schedules. Your job is to extract structured scene data from schedule PDF text.

IMPORTANT RULES:
1. Scene entries typically contain: Scene number, page count, INT/EXT, Day/Night, location, description, cast numbers, estimated time, and story day marker (D1, D2, N1, N2, etc.)
2. Scene numbers can be: "21", "4A", "61A", "14pt", etc.
3. Page counts look like: "2/8 pgs", "1 4/8 pgs", "2 pgs"
4. INT/EXT is interior or exterior
5. Day/Night indicates time of day in the story (Day, Night, Morning, Evening)
6. Story day markers like "D5", "N8" indicate which day in the story timeline
7. Cast numbers are single digits or comma-separated lists that reference the cast list
8. Estimated time is in format like "3:00", "1:30", ":30"
9. Location is typically ALL CAPS (e.g., "MARGOT'S BEDROOM - PLUMHILL MANOR")
10. Description is mixed case text describing the scene action

The schedule often has a two-row table format where:
- Row 1: "Scene" header, page count top, INT/EXT, location, cast numbers, "Est. Time", "Day:"
- Row 2: Scene number, "pgs", Day/Night, description, time value, story day marker

Return ONLY valid JSON with no additional text or markdown.`;

  const prompt = `Extract all scenes from this shooting schedule text.
${castReference}
SCHEDULE TEXT:
---
${chunkText.slice(0, 15000)}
---

Return a JSON object with this exact structure:
{
  "dayNumber": ${dayNumber || '"unknown"'},
  "date": "2024-05-21 or null if not found",
  "dayOfWeek": "Tuesday or null",
  "location": "Main location for the day",
  "scenes": [
    {
      "sceneNumber": "21",
      "pages": "2",
      "intExt": "INT",
      "dayNight": "D5",
      "setLocation": "MARGOT'S BEDROOM - PLUMHILL MANOR",
      "description": "Margot wakes to a call from Calvaux.",
      "castNumbers": [1, 3],
      "estimatedTime": "3:00",
      "shootOrder": 1
    }
  ]
}

IMPORTANT:
- Extract ALL scenes you can identify
- Scene numbers should exactly match the schedule (21, 14, 49, 62, 71, 73, 61A, etc.)
- dayNight should be the story day marker (D5, D4, D6, D8, N8, N7, etc.) not just "Day" or "Night"
- castNumbers should be an array of integers referencing the cast list
- shootOrder should be the order scenes appear in the schedule for this day (1, 2, 3, etc.)
- If a field cannot be determined, use null
- For INT/EXT, use only "INT" or "EXT"`;

  try {
    const response = await callAI(prompt, { system: systemPrompt, maxTokens: 8000 });

    // Parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in AI response:', response);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Extract date info from the chunk text if not provided by AI
    let date = parsed.date;
    let dayOfWeek = parsed.dayOfWeek;
    if (!date) {
      const dateMatch = chunkText.match(/(\w+day)[,\s]+(\d{1,2})\s+(\w+)\s+(\d{4})/i);
      if (dateMatch) {
        dayOfWeek = dateMatch[1];
        const day = dateMatch[2].padStart(2, '0');
        const month = monthToNumber(dateMatch[3]);
        const year = dateMatch[4];
        if (month) {
          date = `${year}-${month}-${day}`;
        }
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
    if (/Set\s+Move/i.test(chunkText)) notes.push('Set Move');

    // Convert scenes to proper format
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
    })).filter((s: ScheduleSceneEntry) => s.sceneNumber); // Filter out invalid scenes

    // Calculate total pages
    let totalPages = '';
    const totalPagesMatch = chunkText.match(/(\d+\s*\d*\/?\d*)\s*Pages?/i);
    if (totalPagesMatch) {
      totalPages = totalPagesMatch[1].trim();
    }

    return {
      dayNumber: typeof parsed.dayNumber === 'number' ? parsed.dayNumber : (dayNumber || 1),
      date: date || undefined,
      dayOfWeek: dayOfWeek || undefined,
      location: parsed.location || '',
      sunrise: srMatch ? `${srMatch[1]}:${srMatch[2]}` : undefined,
      sunset: ssMatch ? `${ssMatch[1]}:${ssMatch[2]}` : undefined,
      notes: notes.length > 0 ? notes : undefined,
      scenes,
      totalPages: totalPages || undefined,
    };
  } catch (error) {
    console.error('AI schedule chunk parsing failed:', error);
    return null;
  }
}

/**
 * Merge AI-parsed results with existing schedule metadata
 */
function mergeScheduleResults(
  existingSchedule: ProductionSchedule,
  aiDays: ScheduleDay[]
): ProductionSchedule {
  // Sort days by day number
  const sortedDays = aiDays.sort((a, b) => a.dayNumber - b.dayNumber);

  // If AI found more scenes than regex, use AI results
  const aiSceneCount = sortedDays.reduce((sum, d) => sum + d.scenes.length, 0);
  const existingSceneCount = existingSchedule.days.reduce((sum, d) => sum + d.scenes.length, 0);

  console.log(`AI found ${aiSceneCount} scenes, regex found ${existingSceneCount} scenes`);

  // Use AI days if they found more scenes or if regex found none
  const finalDays = aiSceneCount >= existingSceneCount || existingSceneCount === 0
    ? sortedDays
    : existingSchedule.days;

  return {
    ...existingSchedule,
    days: finalDays,
    totalDays: finalDays.length,
  };
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
  if (avgScenesPerDay < 2) return true;

  // If we have raw text but few parsed results
  if (schedule.rawText && schedule.rawText.length > 5000 && totalScenes < 5) return true;

  return false;
}
