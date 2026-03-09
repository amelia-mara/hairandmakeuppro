/**
 * BECTU (UK Film Industry) Timesheet Calculation Logic
 * Ported from mobile app for desktop multi-crew timesheet system
 */

// ============================================
// TIME HELPERS
// ============================================

export function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [hours, mins] = time.split(':').map(Number);
  if (isNaN(hours) || isNaN(mins)) return 0;
  return hours * 60 + mins;
}

export function minutesToTime(minutes: number): string {
  const normalizedMins = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalizedMins / 60);
  const m = normalizedMins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function timeDiffHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  let startMins = timeToMinutes(startTime);
  let endMins = timeToMinutes(endTime);
  if (endMins < startMins) endMins += 24 * 60;
  return (endMins - startMins) / 60;
}

export function addHoursToTime(time: string, hours: number): string {
  const mins = timeToMinutes(time) + (hours * 60);
  return minutesToTime(mins);
}

// ============================================
// BASE CONTRACTS & DAY TYPES
// ============================================

export type BaseContract = '10+1' | '11+1';
export type BECTUDayType = 'SWD' | 'SCWD' | 'CWD';

export const BASE_CONTRACTS: Record<BaseContract, { baseWorkHours: number; label: string }> = {
  '10+1': { baseWorkHours: 10, label: '10+1 (10 hours + 1hr lunch)' },
  '11+1': { baseWorkHours: 11, label: '11+1 (11 hours + 1hr lunch)' },
};

export const DAY_TYPES: Record<BECTUDayType, { name: string; lunchMins: number; hourReduction: number }> = {
  'SWD': { name: 'Standard Working Day', lunchMins: 60, hourReduction: 0 },
  'SCWD': { name: 'Semi-Continuous Working Day', lunchMins: 30, hourReduction: 0.5 },
  'CWD': { name: 'Continuous Working Day', lunchMins: 0, hourReduction: 1 },
};

export function getContractedWorkHours(baseContract: BaseContract, dayType: BECTUDayType): number {
  return BASE_CONTRACTS[baseContract].baseWorkHours - DAY_TYPES[dayType].hourReduction;
}

export function getLunchDuration(dayType: BECTUDayType): number {
  return DAY_TYPES[dayType].lunchMins;
}

export function getHourlyRate(dayRate: number, baseContract: BaseContract, dayType: BECTUDayType): number {
  const workHours = getContractedWorkHours(baseContract, dayType);
  if (workHours <= 0) return 0;
  return dayRate / workHours;
}

// ============================================
// CALCULATION COMPONENTS
// ============================================

interface HoursAndPay { hours: number; pay: number; }

function calculatePreCall(
  preCallTime: string | null | undefined,
  unitCallTime: string,
  hourlyRate: number,
  preCallMultiplier: number = 1.5
): HoursAndPay {
  if (!preCallTime || !unitCallTime) return { hours: 0, pay: 0 };
  const preCallHours = timeDiffHours(preCallTime, unitCallTime);
  if (preCallHours <= 0) return { hours: 0, pay: 0 };
  return { hours: preCallHours, pay: preCallHours * (hourlyRate * preCallMultiplier) };
}

function calculateOvertime(
  actualWorkHours: number,
  contractedHours: number,
  hourlyRate: number,
  otMultiplier: number = 1.5
): HoursAndPay {
  const overtimeHours = Math.max(0, actualWorkHours - contractedHours);
  return { hours: overtimeHours, pay: overtimeHours * (hourlyRate * otMultiplier) };
}

function calculateBrokenLunch(
  unitCallTime: string,
  lunchTime: string | null | undefined,
  dayType: BECTUDayType,
  hourlyRate: number,
  otMultiplier: number = 1.5
): HoursAndPay {
  if (dayType === 'CWD' || !lunchTime || !unitCallTime) return { hours: 0, pay: 0 };
  const lunchDeadline = addHoursToTime(unitCallTime, 6);
  const lunchMins = timeToMinutes(lunchTime);
  const deadlineMins = timeToMinutes(lunchDeadline);
  if (lunchMins <= deadlineMins) return { hours: 0, pay: 0 };
  const brokenHours = timeDiffHours(lunchDeadline, lunchTime);
  return { hours: brokenHours, pay: brokenHours * (hourlyRate * otMultiplier) };
}

function calculateBrokenTurnaround(
  previousWrapOut: string | null | undefined,
  currentPreCall: string | null | undefined,
  currentUnitCall: string,
  hourlyRate: number,
  otMultiplier: number = 1.5,
  minimumTurnaround: number = 11
): HoursAndPay {
  if (!previousWrapOut || !currentUnitCall) return { hours: 0, pay: 0 };
  const callTime = currentPreCall || currentUnitCall;
  let turnaroundHours = timeDiffHours(previousWrapOut, callTime);
  if (turnaroundHours < 0) turnaroundHours += 24;
  if (turnaroundHours >= minimumTurnaround) return { hours: 0, pay: 0 };
  const brokenHours = minimumTurnaround - turnaroundHours;
  return { hours: brokenHours, pay: brokenHours * (hourlyRate * otMultiplier) };
}

function calculateLateNight(
  unitCallTime: string,
  wrapTime: string,
  lunchTime: string | null | undefined,
  lunchDurationMins: number,
  hourlyRate: number,
  lateNightMultiplier: number = 2,
  lateNightThreshold: string = '23:00'
): HoursAndPay {
  if (!wrapTime || !unitCallTime) return { hours: 0, pay: 0 };
  const wrapMins = timeToMinutes(wrapTime);
  const thresholdMins = timeToMinutes(lateNightThreshold);
  let adjustedWrapMins = wrapMins;
  if (wrapMins < timeToMinutes(unitCallTime)) adjustedWrapMins = wrapMins + 24 * 60;
  if (adjustedWrapMins <= thresholdMins && wrapMins >= timeToMinutes(unitCallTime)) {
    return { hours: 0, pay: 0 };
  }
  const lateNightMins = adjustedWrapMins - thresholdMins;
  let lateNightHours = lateNightMins / 60;
  if (lunchTime) {
    const lunchMins = timeToMinutes(lunchTime);
    if (lunchMins > thresholdMins || lunchMins < timeToMinutes(unitCallTime)) {
      lateNightHours -= lunchDurationMins / 60;
    }
  }
  lateNightHours = Math.max(0, lateNightHours);
  const enhancement = hourlyRate * (lateNightMultiplier - 1);
  return { hours: lateNightHours, pay: lateNightHours * enhancement };
}

function applyDayMultiplier(
  baseDayTotal: number,
  is6thDay: boolean,
  is7thDay: boolean,
  sixthDayMultiplier: number = 1.5,
  seventhDayMultiplier: number = 2
): { multiplier: number; total: number } {
  if (is7thDay) return { multiplier: seventhDayMultiplier, total: baseDayTotal * seventhDayMultiplier };
  if (is6thDay) return { multiplier: sixthDayMultiplier, total: baseDayTotal * sixthDayMultiplier };
  return { multiplier: 1, total: baseDayTotal };
}

// ============================================
// MASTER CALCULATION
// ============================================

export interface BECTUTimesheetEntry {
  date: string;
  dayRate: number;
  baseContract: BaseContract;
  dayType: BECTUDayType;
  preCallTime: string | null;
  unitCallTime: string;
  lunchTime: string | null;
  lunchDuration: number;
  wrapOutTime: string;
  is6thDay: boolean;
  is7thDay: boolean;
  previousWrapOut: string | null;
  preCallMultiplier: number;
  otMultiplier: number;
  lateNightMultiplier: number;
  sixthDayMultiplier: number;
  seventhDayMultiplier: number;
}

export interface BECTUTimesheetCalculation {
  contractedHours: number;
  hourlyRate: number;
  otRate: number;
  actualWorkHours: number;
  preCallHours: number;
  overtimeHours: number;
  brokenLunchHours: number;
  brokenTurnaroundHours: number;
  lateNightHours: number;
  basePay: number;
  preCallPay: number;
  overtimePay: number;
  brokenLunchPay: number;
  brokenTurnaroundPay: number;
  lateNightPay: number;
  subtotal: number;
  dayMultiplier: number;
  totalPay: number;
  hasBrokenLunch: boolean;
  hasBrokenTurnaround: boolean;
  hasLateNight: boolean;
  hasOvertime: boolean;
}

function round2(num: number): number {
  return Math.round(num * 100) / 100;
}

function createEmptyCalc(): BECTUTimesheetCalculation {
  return {
    contractedHours: 0, hourlyRate: 0, otRate: 0,
    actualWorkHours: 0, preCallHours: 0, overtimeHours: 0,
    brokenLunchHours: 0, brokenTurnaroundHours: 0, lateNightHours: 0,
    basePay: 0, preCallPay: 0, overtimePay: 0,
    brokenLunchPay: 0, brokenTurnaroundPay: 0, lateNightPay: 0,
    subtotal: 0, dayMultiplier: 1, totalPay: 0,
    hasBrokenLunch: false, hasBrokenTurnaround: false,
    hasLateNight: false, hasOvertime: false,
  };
}

export function calculateBECTUTimesheet(entry: BECTUTimesheetEntry): BECTUTimesheetCalculation {
  if (!entry.unitCallTime || !entry.wrapOutTime) return createEmptyCalc();

  const contractedHours = getContractedWorkHours(entry.baseContract, entry.dayType);
  const hourlyRate = getHourlyRate(entry.dayRate, entry.baseContract, entry.dayType);
  const otRate = hourlyRate * entry.otMultiplier;
  const startTime = entry.preCallTime || entry.unitCallTime;
  const totalOnSet = timeDiffHours(startTime, entry.wrapOutTime);
  const lunchHours = entry.lunchDuration / 60;
  const actualWorkHours = Math.max(0, totalOnSet - lunchHours);

  const preCall = calculatePreCall(entry.preCallTime, entry.unitCallTime, hourlyRate, entry.preCallMultiplier);
  const workHoursAfterUnitCall = timeDiffHours(entry.unitCallTime, entry.wrapOutTime) - lunchHours;
  const overtime = calculateOvertime(Math.max(0, workHoursAfterUnitCall), contractedHours, hourlyRate, entry.otMultiplier);
  const brokenLunch = calculateBrokenLunch(entry.unitCallTime, entry.lunchTime, entry.dayType, hourlyRate, entry.otMultiplier);
  const brokenTurnaround = calculateBrokenTurnaround(entry.previousWrapOut, entry.preCallTime, entry.unitCallTime, hourlyRate, entry.otMultiplier);
  const lateNight = calculateLateNight(entry.unitCallTime, entry.wrapOutTime, entry.lunchTime, entry.lunchDuration, hourlyRate, entry.lateNightMultiplier);

  const basePay = entry.dayRate;
  const subtotal = basePay + preCall.pay + overtime.pay + brokenLunch.pay + brokenTurnaround.pay + lateNight.pay;
  const dayMult = applyDayMultiplier(subtotal, entry.is6thDay, entry.is7thDay, entry.sixthDayMultiplier, entry.seventhDayMultiplier);

  return {
    contractedHours: round2(contractedHours), hourlyRate: round2(hourlyRate), otRate: round2(otRate),
    actualWorkHours: round2(actualWorkHours), preCallHours: round2(preCall.hours),
    overtimeHours: round2(overtime.hours), brokenLunchHours: round2(brokenLunch.hours),
    brokenTurnaroundHours: round2(brokenTurnaround.hours), lateNightHours: round2(lateNight.hours),
    basePay: round2(basePay), preCallPay: round2(preCall.pay), overtimePay: round2(overtime.pay),
    brokenLunchPay: round2(brokenLunch.pay), brokenTurnaroundPay: round2(brokenTurnaround.pay),
    lateNightPay: round2(lateNight.pay), subtotal: round2(subtotal),
    dayMultiplier: dayMult.multiplier, totalPay: round2(dayMult.total),
    hasBrokenLunch: brokenLunch.hours > 0, hasBrokenTurnaround: brokenTurnaround.hours > 0,
    hasLateNight: lateNight.hours > 0, hasOvertime: overtime.hours > 0,
  };
}

// ============================================
// HELPERS
// ============================================

export function baseDayHoursToContract(baseDayHours: number): BaseContract {
  return baseDayHours === 10 ? '10+1' : '11+1';
}

export function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return formatDateString(date);
}

export function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return formatDateString(date);
}

export function getDayName(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-GB', { weekday: 'short' });
}

export function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
