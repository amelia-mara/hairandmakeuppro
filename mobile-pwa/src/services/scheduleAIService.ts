/**
 * Schedule AI Service - Stage 2 processing
 * Uses AI to extract scene-by-scene breakdown data from the production schedule PDF text
 */

import { callAI } from '@/services/aiService';
import type {
  ProductionSchedule,
  ScheduleDay,
  ScheduleSceneEntry,
} from '@/types';

interface Stage2Progress {
  current: number;
  total: number;
  message?: string;
}

interface Stage2Result {
  days: ScheduleDay[];
}

/**
 * Process a single shooting day's text block using AI
 * Returns structured scene entries for that day
 */
async function processDayWithAI(
  dayText: string,
  dayNumber: number,
  castListRef: string
): Promise<ScheduleDay> {
  const systemPrompt = `You are an expert at parsing film/TV production schedules. Extract structured scene data from a single shooting day's schedule text.

The text comes from a PDF extraction and may have table structure lost. Look for patterns:
- Scene numbers (e.g., "Scene 21", "Scene 14", "Scene 61A")
- INT/EXT markers
- Location/set descriptions (e.g., "MARGOT'S BEDROOM - PLUMHILL MANOR")
- Day/Night indicators
- Page counts (e.g., "2 pgs", "1 4/8 pgs", "5/8 pgs")
- Cast numbers (small numbers like 1, 2, 3 that refer to cast members)
- Estimated times (e.g., "3:00", "1:30", ":30")
- Story day markers (e.g., "D5", "N8", "D4")
- Scene descriptions/log lines
- Set moves, lighting changes, load in/out markers
- "End of Shooting Day" summary lines with date and total pages

${castListRef}

Return ONLY valid JSON with no additional text or markdown.`;

  const prompt = `Parse this shooting day text and extract ALL scenes with their details.

SHOOTING DAY TEXT:
---
${dayText}
---

Return a JSON object with this structure:
{
  "dayNumber": ${dayNumber},
  "date": "YYYY-MM-DD or null if not found",
  "dayOfWeek": "Monday/Tuesday/etc or null",
  "location": "Main location for the day",
  "notes": ["array of notes like 'Set Move :30', 'Lighting Change for Night', 'Load In :30'"],
  "totalPages": "total pages string if found in End of Shooting Day line",
  "scenes": [
    {
      "sceneNumber": "21",
      "pages": "2",
      "intExt": "INT",
      "dayNight": "Day",
      "setLocation": "MARGOT'S BEDROOM - PLUMHILL MANOR",
      "description": "Margot wakes to a call from Calvaux.",
      "castNumbers": [1],
      "estimatedTime": "3:00",
      "storyDay": "D5",
      "remarks": "Calvaux (Phone)"
    }
  ]
}

IMPORTANT:
- Extract EVERY scene entry, including those after "Lighting Change" or "Set Move" markers
- Scene numbers may include letters like "61A", "14pt"
- Pages can be "2", "1 4/8", "2/8", "5/8", "3/8" etc.
- Cast numbers are the small integers (1, 2, 3, 7, etc.) that reference the cast list
- Day/Night is usually "Day", "Night", "Morning" - also look for D/N column
- The description/log line describes what happens in the scene
- estimatedTime is the Est. Time value (e.g., "3:00", "1:30", ":30", "1:00")
- storyDay is the Day marker like "D5", "N8", "D4" from the Day column
- remarks captures any additional notes from the Remarks column
- Include the shootOrder (1-based index within the day)
- Look for the "End of Shooting Day X" line for date and total pages info`;

  const response = await callAI(prompt, { system: systemPrompt, maxTokens: 6000 });

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Failed to parse AI response for day ${dayNumber}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);

  const scenes: ScheduleSceneEntry[] = (parsed.scenes || []).map((s: any, index: number) => ({
    sceneNumber: String(s.sceneNumber || ''),
    pages: s.pages || undefined,
    intExt: (s.intExt?.toUpperCase() === 'EXT' ? 'EXT' : 'INT') as 'INT' | 'EXT',
    dayNight: s.dayNight || s.storyDay || 'Day',
    setLocation: s.setLocation || '',
    description: s.description || s.remarks || undefined,
    castNumbers: Array.isArray(s.castNumbers) ? s.castNumbers.map(Number).filter((n: number) => !isNaN(n)) : [],
    estimatedTime: s.estimatedTime || undefined,
    shootOrder: index + 1,
  }));

  return {
    dayNumber: parsed.dayNumber || dayNumber,
    date: parsed.date || undefined,
    dayOfWeek: parsed.dayOfWeek || undefined,
    location: parsed.location || '',
    notes: Array.isArray(parsed.notes) ? parsed.notes : undefined,
    scenes,
    totalPages: parsed.totalPages || undefined,
  };
}

/**
 * Extract text blocks for each shooting day from the full schedule text
 */
function extractDayTextBlocks(rawText: string): Map<number, string> {
  const blocks = new Map<number, string>();

  // Find all "End of Shooting Day X" markers
  const endPattern = /End of Shooting Day\s+(\d+)/gi;
  const markers: { dayNum: number; endPos: number }[] = [];

  let match;
  while ((match = endPattern.exec(rawText)) !== null) {
    const dayNum = parseInt(match[1], 10);
    // Include some text after the marker (date, page count line)
    const endPos = Math.min(match.index + match[0].length + 200, rawText.length);
    markers.push({ dayNum, endPos });
  }

  markers.sort((a, b) => a.endPos - b.endPos);

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    const startPos = i > 0 ? markers[i - 1].endPos : 0;
    const dayText = rawText.slice(startPos, marker.endPos);
    blocks.set(marker.dayNum, dayText);
  }

  return blocks;
}

/**
 * Stage 2: AI-powered schedule processing
 * Processes each shooting day to extract scene entries
 */
export async function processScheduleStage2(
  schedule: ProductionSchedule,
  onProgress?: (progress: Stage2Progress) => void
): Promise<Stage2Result> {
  const rawText = schedule.rawText;
  if (!rawText) {
    throw new Error('No raw text available for processing. Please re-upload the schedule.');
  }

  // Build cast list reference string for the AI prompt
  const castListRef = schedule.castList.length > 0
    ? `CAST LIST (number → name):\n${schedule.castList.map(c => `${c.number}. ${c.name}`).join('\n')}\n\nUse these cast numbers when identifying which cast members are in each scene.`
    : '';

  // Extract day text blocks
  const dayBlocks = extractDayTextBlocks(rawText);
  const totalDays = schedule.totalDays || dayBlocks.size;

  if (dayBlocks.size === 0) {
    // Fall back: try to process the entire text as one block
    onProgress?.({ current: 1, total: 1, message: 'Processing schedule...' });
    const day = await processDayWithAI(rawText.slice(0, 30000), 1, castListRef);
    return { days: [day] };
  }

  const days: ScheduleDay[] = [];

  // Process each day sequentially
  const sortedDayNums = Array.from(dayBlocks.keys()).sort((a, b) => a - b);

  for (let i = 0; i < sortedDayNums.length; i++) {
    const dayNum = sortedDayNums[i];
    const dayText = dayBlocks.get(dayNum)!;

    onProgress?.({
      current: i + 1,
      total: totalDays,
      message: `Processing Day ${dayNum} of ${totalDays}...`,
    });

    try {
      const day = await processDayWithAI(dayText, dayNum, castListRef);
      days.push(day);
    } catch (error) {
      console.error(`Failed to process day ${dayNum}:`, error);
      // Add an empty day entry so we don't lose the count
      days.push({
        dayNumber: dayNum,
        location: '',
        scenes: [],
        notes: [`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      });
    }
  }

  return { days };
}
