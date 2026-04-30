import { normalizeTime, normalizeTimeRange, parseDateFromText } from './shared';
import type { CallSheet } from '@/types';

export interface HeaderFields {
  date?: string;
  productionDay?: number;
  totalProductionDays?: number;
  dayType?: string;
  unitCallTime?: string;
  rehearsalsTime?: string;
  firstShotTime?: string;
  preCalls?: NonNullable<CallSheet['preCalls']>;
  breakfastTime?: string;
  breakfastLocation?: string;
  lunchTime?: string;
  lunchLocation?: string;
  cameraWrapEstimate?: string;
  wrapEstimate?: string;
  weather?: NonNullable<CallSheet['weather']>;
}

export function parseHeader(text: string): HeaderFields {
  const out: HeaderFields = {};

  // ── Date ───────────────────────────────────────────────────────
  // Try the first 30 lines to avoid grabbing dates from the advance schedule.
  const head = text.split('\n').slice(0, 40).join('\n');
  out.date = parseDateFromText(head);

  // ── Production day ─────────────────────────────────────────────
  // "DAY 6 OF 20", "SHOOT DAY 1 / 39", "Callsheet 11 of 45", "CALL SHEET 1 OF 9"
  const dayPatterns = [
    /\b(?:SHOOT\s*)?DAY\s*(\d+)\s*(?:OF|\/)\s*(\d+)/i,
    /\bCALL\s*SHEET\s*(\d+)\s*OF\s*(\d+)/i,
    /\bCALLSHEET\s*(\d+)\s*OF\s*(\d+)/i,
  ];
  for (const re of dayPatterns) {
    const m = head.match(re);
    if (m) {
      out.productionDay = parseInt(m[1], 10);
      out.totalProductionDays = parseInt(m[2], 10);
      break;
    }
  }
  if (out.productionDay === undefined) {
    // Fall back to single "DAY X" without total
    const m = head.match(/\b(?:SHOOT\s*)?DAY\s*(\d+)\b/i);
    if (m) out.productionDay = parseInt(m[1], 10);
  }

  // ── Day type ───────────────────────────────────────────────────
  const dayTypeRe = /(\d+(?:\.\d+)?\s*\+?\s*\d*\s*(?:HRS?\s*)?)?(SEMI[-\s]?CONTINUOUS|CONTINUOUS|SCWD|SWD|STANDARD)\s*WORKING\s*DAY/i;
  const dayTypeMatch = head.match(dayTypeRe);
  if (dayTypeMatch) out.dayType = dayTypeMatch[0].trim();

  // ── Unit call ──────────────────────────────────────────────────
  // "UNIT CALL: 0800", "UNIT CALL TIME: 08:00 AM", "UNIT CALL: SWD 0800-1900"
  const ucMatch =
    text.match(/UNIT\s*CALL(?:\s*TIME)?\s*[:\s]+(?:[A-Z]{2,5}\s+)?(\d{1,2}[:.]?\d{2}\s*(?:AM|PM)?)/i);
  if (ucMatch) out.unitCallTime = normalizeTime(ucMatch[1]);

  // ── Rehearsals / first shot ────────────────────────────────────
  const reh = text.match(/REHEARSALS?\s*ON\s*SET\s*FOR\s*[:\s]+(\d{1,2}[:.]?\d{2})/i);
  if (reh) out.rehearsalsTime = normalizeTime(reh[1]);
  const fto = text.match(/(?:TO\s*SHOOT\s*FOR|FIRST\s*SHOT|FTO)\s*[:\s]+(\d{1,2}[:.]?\d{2})/i);
  if (fto) out.firstShotTime = normalizeTime(fto[1]);

  // ── Meals ──────────────────────────────────────────────────────
  // "BREAKFAST: 0730", "BREAKFAST 07:30", "Breakfast@ Unit Base from: 0700-0800"
  const bf =
    text.match(/B(?:REAKFAST|['’]?FAST)\s*[@:]?\s*[^0-9\n]{0,30}?(\d{1,2}[:.]?\d{2}(?:\s*-\s*\d{1,2}[:.]?\d{2})?)/i);
  if (bf) out.breakfastTime = normalizeTimeRange(bf[1]);

  // "EST. LUNCH: 1300", "LUNCH (HOTBOX) 13:45 - 14:15", "1 hr Lunch@ Unit Base from: 1300-1400"
  const lu = text.match(
    /(?:EST\.?\s*)?(?:1\s*hr\s*)?LUNCH(?:\s*\(([^)]+)\))?\s*[@:]?\s*[^0-9\n]{0,30}?(\d{1,2}[:.]?\d{2}(?:\s*-\s*\d{1,2}[:.]?\d{2})?)/i,
  );
  if (lu) {
    out.lunchTime = normalizeTimeRange(lu[2]);
    if (lu[1]) out.lunchLocation = lu[1].trim();
  }

  // ── Wrap estimates ─────────────────────────────────────────────
  const cw = text.match(/CAMERA\s*WRAP\s*[:\s]*(\d{1,2}[:.]?\d{2})/i);
  if (cw) out.cameraWrapEstimate = normalizeTime(cw[1]);
  const w =
    text.match(/(?:^|[^A-Z])(?:EST\.?\s*)?WRAP\s*[:\s]*(\d{1,2}[:.]?\d{2})/im);
  if (w) out.wrapEstimate = normalizeTime(w[1]);

  // ── Weather ────────────────────────────────────────────────────
  out.weather = parseWeather(text);

  // ── Pre-calls ──────────────────────────────────────────────────
  out.preCalls = parsePreCalls(text);

  return out;
}

function parseWeather(text: string): NonNullable<CallSheet['weather']> | undefined {
  const w: NonNullable<CallSheet['weather']> = {};

  // Conditions: try a few shapes
  // 1. "WEATHER: Mostly Cloudy, ..."
  // 2. Free text after WEATHER label / on its own line ("OVERCAST WITH SCATTERED SHOWERS")
  // 3. "CLOUDY WITH SOME SUN"
  const condInline = text.match(/WEATHER\s*:?\s*([A-Za-z][A-Za-z\s,/&-]{2,60})(?:\s*[,|]|\n)/);
  if (condInline) {
    const c = condInline[1].trim();
    if (!/^(MAX|MIN|TEMP|HIGH|LOW)/i.test(c)) w.conditions = c;
  }
  if (!w.conditions) {
    const standalone = text.match(/\b(OVERCAST(?:\s+WITH\s+[A-Z\s]+?)?|SUNNY(?:\s+SPELLS)?|MOSTLY\s+CLOUDY|CLOUDY(?:\s+WITH\s+[A-Z\s]+?)?|RAIN(?:Y)?|SHOWERS|LIGHT\s+SHOWERS?|SCATTERED\s+SHOWERS|CLEAR|FOGGY|SNOW)\b/i);
    if (standalone) w.conditions = standalone[1].trim();
  }

  const high = text.match(/(?:HIGH|MAX)\s*[:\s]*(\d+)\s*[°ºo]?\s*[CcFf]?/);
  if (high) w.tempHigh = parseInt(high[1], 10);
  const low = text.match(/(?:LOW|MIN)\s*[:\s]*(\d+)\s*[°ºo]?\s*[CcFf]?/);
  if (low) w.tempLow = parseInt(low[1], 10);

  const sr = text.match(/(?:SUN(?:RISE)?|SR)\s*[:\s]*(\d{1,2}[:.]?\d{2})/i);
  if (sr) w.sunrise = normalizeTime(sr[1]);
  const ss = text.match(/(?:SUN(?:SET|\s*SETS?)|SS)\s*[:\s]*(\d{1,2}[:.]?\d{2})/i);
  if (ss) w.sunset = normalizeTime(ss[1]);

  return Object.values(w).some((v) => v !== undefined) ? w : undefined;
}

function parsePreCalls(text: string): NonNullable<CallSheet['preCalls']> | undefined {
  const pc: NonNullable<CallSheet['preCalls']> = {};

  // Format 1: "PRE CALLS: LIGHTING 0720, HMU 0700, AD 0700"
  // Format 2: "PRE-CALLS (30/30): ADs: 07:45 @ UB | HMU: 07:45 @ UB | COSTUME: 07:45 @ UB | PRODUCTION: 07:45"
  const dept: Array<[keyof NonNullable<CallSheet['preCalls']>, RegExp]> = [
    ['ads',        /\bADs?\b\s*[:\s]?\s*(\d{1,2}[:.]?\d{2})/i],
    ['hmu',        /\b(?:HMU|H&MU|H&M\.U)\b\s*[:\s]?\s*(\d{1,2}[:.]?\d{2})/i],
    ['costume',    /\bCOSTUME\b\s*[:\s]?\s*(\d{1,2}[:.]?\d{2})/i],
    ['production', /\bPRODUCTION\b\s*[:\s]?\s*(\d{1,2}[:.]?\d{2})/i],
    ['lighting',   /\bLIGHTING\b\s*[:\s]?\s*(\d{1,2}[:.]?\d{2})/i],
    ['camera',     /\bCAMERA\b\s*[:\s]?\s*(\d{1,2}[:.]?\d{2})/i],
  ];

  // Restrict the search to the pre-calls block when we can find it, to
  // avoid false matches against the cast table or department list.
  let scope = text;
  const block = text.match(/PRE[-\s]*CALLS?[^\n]*(?:\n[^\n]*){0,3}/i);
  if (block) scope = block[0];

  for (const [key, re] of dept) {
    const m = scope.match(re);
    if (m) pc[key] = normalizeTime(m[1]);
  }

  // Pre-call location: "07:45 @ UB" → "UB" or "Unit Base"
  const loc = scope.match(/@\s*(UB|Unit\s*Base|On\s*Set|Set|Loc(?:ation)?\s*\d*)/i);
  if (loc) {
    const v = loc[1].toUpperCase().trim();
    pc.location = v === 'UB' ? 'Unit Base' : loc[1].trim();
  }

  return Object.values(pc).some((v) => v !== undefined) ? pc : undefined;
}
