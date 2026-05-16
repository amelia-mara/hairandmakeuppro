// Prep mirror of the mobile call sheet parser. Both apps run the same
// regex code so the parsed data they produce is identical — letting prep
// upload feed mobile's Today page via the shared call_sheet_data row.
//
// If you change anything here, update the mobile-pwa copy too.

import type { CallSheet } from './callSheet/types';
import { extractTextFromPDF } from './callSheet/extractText';
import { parseHeader } from './callSheet/parseHeader';
import { parseLocations } from './callSheet/parseLocations';
import { parseScenes, type ParseContext } from './callSheet/parseScenes';
import { parseCastCalls, parseSupportingArtists } from './callSheet/parseCast';

export type { CallSheet } from './callSheet/types';
export type { ParseContext };
export { extractTextFromPDF };

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

  // F-20 fallback chain for shoot date:
  //   1. PDF parser (header.date) — preferred
  //   2. Schedule lookup by production day (context.scheduleDaysByDay)
  //   3. Today's date — last resort, with a console warning so the
  //      user can spot the silently-wrong date in the call-sheet card.
  let date = header.date;
  if (!date && header.productionDay !== undefined) {
    date = context?.scheduleDaysByDay?.get(header.productionDay)?.date;
    if (date) {
      console.log(
        `[callSheetParser] Date not found in PDF; using schedule day ${header.productionDay} -> ${date}`,
      );
    }
  }
  if (!date) {
    date = new Date().toISOString().slice(0, 10);
    console.warn(
      '[callSheetParser] Falling back to upload date for shoot_date — PDF and schedule both missed.',
    );
  }

  return {
    id: crypto.randomUUID(),
    date,
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
