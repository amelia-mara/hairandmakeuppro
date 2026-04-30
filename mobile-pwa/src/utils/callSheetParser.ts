import { v4 as uuidv4 } from 'uuid';
import type { CallSheet } from '@/types';
import { extractTextFromPDF } from './callSheet/extractText';
import { parseHeader } from './callSheet/parseHeader';
import { parseLocations } from './callSheet/parseLocations';
import { parseScenes, type ParseContext } from './callSheet/parseScenes';
import { parseCastCalls, parseSupportingArtists } from './callSheet/parseCast';

// Re-export so existing imports of `extractTextFromPDF` from this module
// keep working.
export { extractTextFromPDF };
export type { ParseContext };

/**
 * Parse extracted call sheet text into a structured CallSheet object.
 * 100% client-side regex; no API key required. Different productions use
 * different layouts so each sub-parser has its own dispatch + heuristics.
 *
 * `context` lets the caller pass project knowledge (cast roster from the
 * schedule, scene numbers from the script) that the parser uses to
 * filter noise — e.g. dropping a stray "1330" that looks like a cast ID
 * but isn't in the project's cast list.
 */
export function parseCallSheetText(
  text: string,
  pdfUri?: string,
  context?: ParseContext,
): CallSheet {
  const header = parseHeader(text);
  const loc = parseLocations(text);
  const scenes = parseScenes(text, context);
  const castCalls = parseCastCalls(text);
  const supportingArtists = parseSupportingArtists(text);

  return {
    id: uuidv4(),
    date: header.date ?? new Date().toISOString().slice(0, 10),
    productionDay: header.productionDay ?? 1,
    totalProductionDays: header.totalProductionDays,
    dayType: header.dayType,
    unitCallTime: header.unitCallTime ?? '06:00',
    rehearsalsTime: header.rehearsalsTime,
    firstShotTime: header.firstShotTime,
    preCalls: header.preCalls,
    breakfastTime: header.breakfastTime,
    lunchTime: header.lunchTime,
    lunchLocation: header.lunchLocation,
    cameraWrapEstimate: header.cameraWrapEstimate,
    wrapEstimate: header.wrapEstimate,
    weather: header.weather,
    unitBase: loc.unitBase,
    shootLocation: loc.shootLocation,
    crewParking: loc.crewParking,
    unitNotes: loc.unitNotes,
    scenes,
    castCalls,
    supportingArtists,
    uploadedAt: new Date(),
    pdfUri,
    rawText: text,
  };
}

/**
 * Wrap parseCallSheetText in a Promise so it remains a drop-in for the
 * old async AI version. callSheetStore awaits this.
 */
export async function parseCallSheetPDF(
  file: File,
  context?: ParseContext,
): Promise<CallSheet> {
  const pdfUri = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
  const text = await extractTextFromPDF(file);
  return parseCallSheetText(text, pdfUri, context);
}
