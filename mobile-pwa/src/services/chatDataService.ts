/**
 * Chat Data Service — typed query functions for the AI chat assistant.
 *
 * Every function returns a QueryResult so the router always gets a
 * consistent shape it can serialise into context for the LLM.
 */

import { useProjectStore } from '@/stores/projectStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useCallSheetStore } from '@/stores/callSheetStore';
import { useTimesheetStore } from '@/stores/timesheetStore';
import { useBudgetStore } from '@/stores/budgetStore';
import { useProjectSettingsStore } from '@/stores/projectSettingsStore';
import type {
  Scene,
  Character,
  Look,
  CallSheet,
  TimesheetEntry,
  SceneCapture,
  ScheduleDay,
  ContinuityFlags,
} from '@/types';

// ─── Result wrapper ────────────────────────────────────────────────

export interface QueryResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
}

function ok<T>(data: T): QueryResult<T> {
  return { success: true, data };
}
function fail<T>(error: string): QueryResult<T> {
  return { success: false, data: null, error };
}

// ─── Normalisation helpers ─────────────────────────────────────────

/** Normalise a scene number for comparison ("1a" → "1A"). */
function normScene(s: string): string {
  return s.toString().trim().toUpperCase();
}

/** Case-insensitive character name match. */
function matchCharName(stored: string, query: string): boolean {
  return stored.toLowerCase().includes(query.toLowerCase());
}

function getProject() {
  return useProjectStore.getState().currentProject;
}

// ─── Capture formatting ────────────────────────────────────────────

export interface CaptureData {
  sceneNumber: string;
  characterName: string;
  flags: string[];
  hairNotes: string;
  makeupNotes: string;
  generalNotes: string;
  photoCount: number;
  capturedAt: string;
}

function flagsToStrings(f: ContinuityFlags): string[] {
  const out: string[] = [];
  if (f.sweat) out.push('sweat');
  if (f.blood) out.push('blood');
  if (f.dirt) out.push('dirt');
  if (f.tears) out.push('tears');
  if (f.wetHair) out.push('wet hair');
  if (f.dishevelled) out.push('dishevelled');
  return out;
}

function photoCount(cap: SceneCapture): number {
  let count = 0;
  if (cap.photos.front) count++;
  if (cap.photos.left) count++;
  if (cap.photos.right) count++;
  if (cap.photos.back) count++;
  count += cap.additionalPhotos?.length ?? 0;
  return count;
}

function captureToData(
  cap: SceneCapture,
  sceneName: string,
  charName: string,
): CaptureData {
  return {
    sceneNumber: sceneName,
    characterName: charName,
    flags: flagsToStrings(cap.continuityFlags),
    hairNotes: '', // No separate hair notes on captures — notes field covers both
    makeupNotes: '',
    generalNotes: cap.notes || '',
    photoCount: photoCount(cap),
    capturedAt: cap.capturedAt ? new Date(cap.capturedAt).toISOString() : '',
  };
}

// ─── Scene & character queries ─────────────────────────────────────

export function getSceneList(): QueryResult<Scene[]> {
  const p = getProject();
  if (!p) return fail('No project loaded');
  return ok(p.scenes);
}

export function getScene(sceneNumber: string): QueryResult<Scene> {
  const p = getProject();
  if (!p) return fail('No project loaded');
  const norm = normScene(sceneNumber);
  const scene = p.scenes.find((s) => normScene(s.sceneNumber) === norm);
  return scene ? ok(scene) : fail(`Scene ${sceneNumber} not found`);
}

export function getCharacterList(): QueryResult<Character[]> {
  const p = getProject();
  if (!p) return fail('No project loaded');
  return ok(p.characters);
}

export function getCharacterByName(name: string): QueryResult<Character> {
  const p = getProject();
  if (!p) return fail('No project loaded');
  const char = p.characters.find((c) => matchCharName(c.name, name));
  return char ? ok(char) : fail(`Character "${name}" not found`);
}

export function getCharacterScenes(characterName: string): QueryResult<Scene[]> {
  const p = getProject();
  if (!p) return fail('No project loaded');
  const char = p.characters.find((c) => matchCharName(c.name, characterName));
  if (!char) return fail(`Character "${characterName}" not found`);
  const scenes = p.scenes.filter((s) => s.characters.includes(char.id));
  return ok(scenes);
}

export function searchScenes(query: string): QueryResult<Scene[]> {
  const p = getProject();
  if (!p) return fail('No project loaded');
  const q = query.toLowerCase();
  const matched = p.scenes.filter(
    (s) =>
      s.sceneNumber.toLowerCase().includes(q) ||
      s.slugline.toLowerCase().includes(q) ||
      (s.synopsis && s.synopsis.toLowerCase().includes(q)),
  );
  return ok(matched);
}

// ─── Continuity capture queries ────────────────────────────────────

export function getContinuityCapture(
  characterName: string,
  sceneNumber: string,
): QueryResult<CaptureData> {
  const p = getProject();
  if (!p) return fail('No project loaded');

  const char = p.characters.find((c) => matchCharName(c.name, characterName));
  if (!char) return fail(`Character "${characterName}" not found`);

  const norm = normScene(sceneNumber);
  const scene = p.scenes.find((s) => normScene(s.sceneNumber) === norm);
  if (!scene) return fail(`Scene ${sceneNumber} not found`);

  const captures = useProjectStore.getState().sceneCaptures;
  const key = `${scene.id}-${char.id}`;
  const cap = captures[key];
  if (!cap) return fail(`No capture for ${characterName} in scene ${sceneNumber}`);

  return ok(captureToData(cap, sceneNumber, char.name));
}

export function getCharacterCaptures(
  characterName: string,
): QueryResult<CaptureData[]> {
  const p = getProject();
  if (!p) return fail('No project loaded');

  const char = p.characters.find((c) => matchCharName(c.name, characterName));
  if (!char) return fail(`Character "${characterName}" not found`);

  const captures = useProjectStore.getState().sceneCaptures;
  const results: CaptureData[] = [];

  for (const cap of Object.values(captures)) {
    if (cap.characterId === char.id) {
      const scene = p.scenes.find((s) => s.id === cap.sceneId);
      results.push(captureToData(cap, scene?.sceneNumber ?? '?', char.name));
    }
  }

  return ok(results);
}

export function getSceneCaptures(sceneNumber: string): QueryResult<CaptureData[]> {
  const p = getProject();
  if (!p) return fail('No project loaded');

  const norm = normScene(sceneNumber);
  const scene = p.scenes.find((s) => normScene(s.sceneNumber) === norm);
  if (!scene) return fail(`Scene ${sceneNumber} not found`);

  const captures = useProjectStore.getState().sceneCaptures;
  const results: CaptureData[] = [];

  for (const cap of Object.values(captures)) {
    if (cap.sceneId === scene.id) {
      const char = p.characters.find((c) => c.id === cap.characterId);
      results.push(captureToData(cap, sceneNumber, char?.name ?? '?'));
    }
  }

  return ok(results);
}

export function getCaptureProgress(): QueryResult<{
  total: number;
  captured: number;
  pending: number;
}> {
  const p = getProject();
  if (!p) return fail('No project loaded');

  // Total = every scene×character pair where character is in the scene
  let total = 0;
  for (const scene of p.scenes) {
    total += scene.characters.length;
  }

  const captured = Object.keys(useProjectStore.getState().sceneCaptures).length;
  return ok({ total, captured, pending: Math.max(0, total - captured) });
}

// ─── Look queries ──────────────────────────────────────────────────

export function getCharacterLooks(
  characterName: string,
): QueryResult<Look[]> {
  const p = getProject();
  if (!p) return fail('No project loaded');
  const char = p.characters.find((c) => matchCharName(c.name, characterName));
  if (!char) return fail(`Character "${characterName}" not found`);
  const looks = p.looks.filter((l) => l.characterId === char.id);
  return ok(looks);
}

export function getLookDetails(
  characterName: string,
  lookName: string,
): QueryResult<Look> {
  const p = getProject();
  if (!p) return fail('No project loaded');
  const char = p.characters.find((c) => matchCharName(c.name, characterName));
  if (!char) return fail(`Character "${characterName}" not found`);
  const look = p.looks.find(
    (l) => l.characterId === char.id && l.name.toLowerCase().includes(lookName.toLowerCase()),
  );
  return look ? ok(look) : fail(`Look "${lookName}" not found for ${characterName}`);
}

// ─── Schedule queries ──────────────────────────────────────────────

export interface ScheduleDayData {
  dayNumber: number;
  date: string;
  scenes: string[];
  location: string;
  hours: string;
  dayType: string;
  notes: string[];
}

function formatScheduleDay(d: ScheduleDay): ScheduleDayData {
  return {
    dayNumber: d.dayNumber,
    date: d.date ?? '',
    scenes: d.scenes.map((s) => s.sceneNumber),
    location: d.location,
    hours: d.hours ?? '',
    dayType: d.dayType ?? '',
    notes: d.notes ?? [],
  };
}

export function getScheduleOverview(): QueryResult<{
  totalDays: number;
  days: ScheduleDayData[];
}> {
  const sched = useScheduleStore.getState().schedule;
  if (!sched) return fail('No schedule uploaded');
  return ok({
    totalDays: sched.totalDays,
    days: sched.days.map(formatScheduleDay),
  });
}

export function getShootingDay(dayNumber: number): QueryResult<ScheduleDayData> {
  const sched = useScheduleStore.getState().schedule;
  if (!sched) return fail('No schedule uploaded');
  const day = sched.days.find((d) => d.dayNumber === dayNumber);
  return day ? ok(formatScheduleDay(day)) : fail(`Day ${dayNumber} not in schedule`);
}

export function getShootingDayByDate(date: string): QueryResult<ScheduleDayData> {
  const sched = useScheduleStore.getState().schedule;
  if (!sched) return fail('No schedule uploaded');
  const day = sched.days.find((d) => d.date === date);
  return day ? ok(formatScheduleDay(day)) : fail(`No shooting day on ${date}`);
}

export function getTodaysSchedule(): QueryResult<ScheduleDayData> {
  const today = new Date().toISOString().split('T')[0];
  return getShootingDayByDate(today);
}

export function getSceneShootingDay(
  sceneNumber: string,
): QueryResult<ScheduleDayData> {
  const sched = useScheduleStore.getState().schedule;
  if (!sched) return fail('No schedule uploaded');
  const norm = normScene(sceneNumber);
  const day = sched.days.find((d) =>
    d.scenes.some((s) => normScene(s.sceneNumber) === norm),
  );
  return day ? ok(formatScheduleDay(day)) : fail(`Scene ${sceneNumber} not in schedule`);
}

// ─── Call sheet queries ────────────────────────────────────────────

export interface CallSheetData {
  date: string;
  productionDay: number;
  unitCallTime: string;
  wrapEstimate: string;
  sceneCount: number;
  scenes: string[];
  castCalls: { name: string; character: string; callTime: string }[];
  weather: string;
  notes: string[];
}

function formatCallSheet(cs: CallSheet): CallSheetData {
  return {
    date: cs.date,
    productionDay: cs.productionDay,
    unitCallTime: cs.unitCallTime,
    wrapEstimate: cs.wrapEstimate ?? '',
    sceneCount: cs.scenes.length,
    scenes: cs.scenes.map((s) => s.sceneNumber),
    castCalls: (cs.castCalls ?? []).map((c) => ({
      name: c.name,
      character: c.character,
      callTime: c.callTime,
    })),
    weather: cs.weather
      ? `${cs.weather.conditions ?? ''} ${cs.weather.tempHigh ?? ''}/${cs.weather.tempLow ?? ''}`.trim()
      : '',
    notes: cs.unitNotes ?? [],
  };
}

export function getCallSheet(date: string): QueryResult<CallSheetData> {
  const store = useCallSheetStore.getState();
  const cs = store.getCallSheetByDate(date);
  return cs ? ok(formatCallSheet(cs)) : fail(`No call sheet for ${date}`);
}

export function getTodaysCallSheet(): QueryResult<CallSheetData> {
  const today = new Date().toISOString().split('T')[0];
  return getCallSheet(today);
}

// ─── Timesheet queries ────────────────────────────────────────────

export function getTimesheetEntries(
  startDate?: string,
  endDate?: string,
): QueryResult<TimesheetEntry[]> {
  const store = useTimesheetStore.getState();
  let entries = Object.values(store.entries);

  if (startDate) entries = entries.filter((e) => e.date >= startDate);
  if (endDate) entries = entries.filter((e) => e.date <= endDate);

  entries.sort((a, b) => a.date.localeCompare(b.date));
  return ok(entries);
}

export function getTimesheetSummary(): QueryResult<{
  totalDays: number;
  totalHours: number;
  overtimeHours: number;
  totalEarnings: number;
}> {
  const store = useTimesheetStore.getState();
  const entries = Object.values(store.entries);
  if (entries.length === 0) return ok({ totalDays: 0, totalHours: 0, overtimeHours: 0, totalEarnings: 0 });

  let totalHours = 0;
  let overtimeHours = 0;
  let totalEarnings = 0;

  // Sort for turnaround calculation
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  sorted.forEach((entry, i) => {
    const prevWrap = i > 0 ? sorted[i - 1].wrapOut : undefined;
    const calc = store.calculateEntry(entry, prevWrap);
    totalHours += calc.totalHours;
    overtimeHours += calc.otHours;
    totalEarnings += calc.totalEarnings;
  });

  return ok({
    totalDays: entries.length,
    totalHours: Math.round(totalHours * 10) / 10,
    overtimeHours: Math.round(overtimeHours * 10) / 10,
    totalEarnings: Math.round(totalEarnings * 100) / 100,
  });
}

export function getDayTimesheet(date: string): QueryResult<{
  entry: TimesheetEntry;
  hours: number;
  earnings: number;
}> {
  const store = useTimesheetStore.getState();
  const entry = store.entries[date];
  if (!entry) return fail(`No timesheet entry for ${date}`);
  const prevWrap = store.getPreviousWrapOut(date);
  const calc = store.calculateEntry(entry, prevWrap);
  return ok({
    entry,
    hours: Math.round(calc.totalHours * 10) / 10,
    earnings: Math.round(calc.totalEarnings * 100) / 100,
  });
}

// ─── Budget queries ────────────────────────────────────────────────

export function getBudgetSummary(): QueryResult<{
  total: number;
  spent: number;
  remaining: number;
  currency: string;
  receiptCount: number;
}> {
  const store = useBudgetStore.getState();
  const spent = store.getTotalSpent();
  return ok({
    total: store.budgetTotal,
    spent,
    remaining: store.budgetTotal - spent,
    currency: store.currency,
    receiptCount: store.receipts.length,
  });
}

export function getReceipts(category?: string): QueryResult<
  { id: string; date: string; vendor: string; amount: number; category: string; description: string }[]
> {
  const store = useBudgetStore.getState();
  let receipts = store.receipts;
  if (category) {
    receipts = receipts.filter(
      (r) => r.category.toLowerCase() === category.toLowerCase(),
    );
  }
  return ok(
    receipts.map((r) => ({
      id: r.id,
      date: r.date,
      vendor: r.vendor,
      amount: r.amount,
      category: r.category,
      description: r.description,
    })),
  );
}

export function getRecentReceipts(limit: number = 5): QueryResult<
  { id: string; date: string; vendor: string; amount: number; category: string }[]
> {
  const store = useBudgetStore.getState();
  const sorted = [...store.receipts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  return ok(
    sorted.slice(0, limit).map((r) => ({
      id: r.id,
      date: r.date,
      vendor: r.vendor,
      amount: r.amount,
      category: r.category,
    })),
  );
}

// ─── Team / project queries ───────────────────────────────────────

export function getTeamMembers(): QueryResult<
  { name: string; role: string; isOwner: boolean }[]
> {
  const store = useProjectSettingsStore.getState();
  if (!store.teamMembers.length) return fail('No team data loaded');
  return ok(
    store.teamMembers.map((m) => ({
      name: m.name,
      role: m.role,
      isOwner: m.isOwner,
    })),
  );
}

export function getProjectInfo(): QueryResult<{
  name: string;
  type: string;
  status: string;
  sceneCount: number;
  characterCount: number;
  lookCount: number;
  completedScenes: number;
}> {
  const p = getProject();
  if (!p) return fail('No project loaded');
  return ok({
    name: p.name,
    type: 'production',
    status: 'active',
    sceneCount: p.scenes.length,
    characterCount: p.characters.length,
    lookCount: p.looks.length,
    completedScenes: p.scenes.filter((s) => s.isComplete).length,
  });
}
