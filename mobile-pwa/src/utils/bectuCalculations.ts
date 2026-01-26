/**
 * BECTU (UK Film Industry) Timesheet Calculation Logic
 *
 * Implements UK film industry standard pay calculations including:
 * - Base contracts (10+1, 11+1)
 * - Day types (SWD, SCWD, CWD)
 * - Pre-call, overtime, late night calculations
 * - Broken lunch and broken turnaround penalties
 * - 6th/7th day multipliers
 */

// ============================================
// TIME HELPER FUNCTIONS
// ============================================

/**
 * Parse time string "HH:MM" to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [hours, mins] = time.split(':').map(Number);
  if (isNaN(hours) || isNaN(mins)) return 0;
  return hours * 60 + mins;
}

/**
 * Convert minutes since midnight back to "HH:MM" format
 */
export function minutesToTime(minutes: number): string {
  const normalizedMins = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalizedMins / 60);
  const m = normalizedMins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Get difference in hours between two times
 * Handles overnight wraps (end time is next day)
 */
export function timeDiffHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;

  let startMins = timeToMinutes(startTime);
  let endMins = timeToMinutes(endTime);

  // Handle overnight (wrap after midnight)
  if (endMins < startMins) {
    endMins += 24 * 60;
  }

  return (endMins - startMins) / 60;
}

/**
 * Add hours to a time string
 */
export function addHoursToTime(time: string, hours: number): string {
  const mins = timeToMinutes(time) + (hours * 60);
  return minutesToTime(mins);
}

/**
 * Check if time1 is before time2
 */
export function timeIsBefore(time1: string, time2: string): boolean {
  return timeToMinutes(time1) < timeToMinutes(time2);
}

/**
 * Check if time1 is after time2
 */
export function timeIsAfter(time1: string, time2: string): boolean {
  return timeToMinutes(time1) > timeToMinutes(time2);
}

/**
 * Check if two times are equal
 */
export function timeEquals(time1: string, time2: string): boolean {
  return timeToMinutes(time1) === timeToMinutes(time2);
}

// ============================================
// BASE CONTRACTS & DAY TYPES
// ============================================

export type BaseContract = '10+1' | '11+1';
export type BECTUDayType = 'SWD' | 'SCWD' | 'CWD';

export interface BaseContractConfig {
  baseWorkHours: number;
  label: string;
}

export interface DayTypeConfig {
  name: string;
  lunchMins: number;
  hourReduction: number;
}

export const BASE_CONTRACTS: Record<BaseContract, BaseContractConfig> = {
  '10+1': { baseWorkHours: 10, label: '10+1 (10 hours + 1hr lunch)' },
  '11+1': { baseWorkHours: 11, label: '11+1 (11 hours + 1hr lunch)' },
};

export const DAY_TYPES: Record<BECTUDayType, DayTypeConfig> = {
  'SWD': {
    name: 'Standard Working Day',
    lunchMins: 60,
    hourReduction: 0,
  },
  'SCWD': {
    name: 'Semi-Continuous Working Day',
    lunchMins: 30,
    hourReduction: 0.5,
  },
  'CWD': {
    name: 'Continuous Working Day',
    lunchMins: 0,
    hourReduction: 1,
  },
};

/**
 * Calculate contracted work hours based on base contract and day type
 *
 * Examples:
 * - 11+1 + SWD = 11 hours work, 1hr lunch, 12hr total on set
 * - 11+1 + SCWD = 10.5 hours work, 30min lunch, 11hr total on set
 * - 11+1 + CWD = 10 hours work, no lunch, 10hr total on set
 * - 10+1 + SWD = 10 hours work, 1hr lunch, 11hr total on set
 * - 10+1 + SCWD = 9.5 hours work, 30min lunch, 10hr total on set
 * - 10+1 + CWD = 9 hours work, no lunch, 9hr total on set
 */
export function getContractedWorkHours(baseContract: BaseContract, dayType: BECTUDayType): number {
  const base = BASE_CONTRACTS[baseContract].baseWorkHours;
  const reduction = DAY_TYPES[dayType].hourReduction;
  return base - reduction;
}

/**
 * Get lunch duration in minutes based on day type
 */
export function getLunchDuration(dayType: BECTUDayType): number {
  return DAY_TYPES[dayType].lunchMins;
}

/**
 * Calculate hourly rate from day rate
 */
export function getHourlyRate(dayRate: number, baseContract: BaseContract, dayType: BECTUDayType): number {
  const workHours = getContractedWorkHours(baseContract, dayType);
  if (workHours <= 0) return 0;
  return dayRate / workHours;
}

// ============================================
// CALCULATION COMPONENTS
// ============================================

export interface HoursAndPay {
  hours: number;
  pay: number;
}

/**
 * Calculate pre-call pay
 * Time worked before unit call, paid at pre-call multiplier
 */
export function calculatePreCall(
  preCallTime: string | null | undefined,
  unitCallTime: string,
  hourlyRate: number,
  preCallMultiplier: number = 1.5
): HoursAndPay {
  if (!preCallTime || !unitCallTime) return { hours: 0, pay: 0 };

  const preCallHours = timeDiffHours(preCallTime, unitCallTime);
  if (preCallHours <= 0) return { hours: 0, pay: 0 };

  return {
    hours: preCallHours,
    pay: preCallHours * (hourlyRate * preCallMultiplier),
  };
}

/**
 * Calculate overtime
 * OT only applies when actual work hours EXCEED contracted hours
 */
export function calculateOvertime(
  actualWorkHours: number,
  contractedHours: number,
  hourlyRate: number,
  otMultiplier: number = 1.5
): HoursAndPay {
  const overtimeHours = Math.max(0, actualWorkHours - contractedHours);
  const otRate = hourlyRate * otMultiplier;
  return {
    hours: overtimeHours,
    pay: overtimeHours * otRate,
  };
}

/**
 * Calculate broken lunch penalty
 * OT rate applies from 6 hours after unit call until lunch is taken
 *
 * Note: Lunch MUST be taken within 6 hours of unit call.
 * If lunch is taken AFTER the 6 hour mark, the time between
 * the 6 hour deadline and when lunch was actually taken is paid at OT rate.
 */
export function calculateBrokenLunch(
  unitCallTime: string,
  lunchTime: string | null | undefined,
  dayType: BECTUDayType,
  hourlyRate: number,
  otMultiplier: number = 1.5
): HoursAndPay {
  // CWD has no lunch break, so no broken lunch applies
  if (dayType === 'CWD' || !lunchTime || !unitCallTime) {
    return { hours: 0, pay: 0 };
  }

  // Lunch deadline is 6 hours from unit call
  const lunchDeadline = addHoursToTime(unitCallTime, 6);
  const lunchMins = timeToMinutes(lunchTime);
  const deadlineMins = timeToMinutes(lunchDeadline);

  // If lunch is taken on time or before deadline, no penalty
  if (lunchMins <= deadlineMins) {
    return { hours: 0, pay: 0 };
  }

  // Calculate how late lunch was taken
  const brokenHours = timeDiffHours(lunchDeadline, lunchTime);
  const otRate = hourlyRate * otMultiplier;

  return {
    hours: brokenHours,
    pay: brokenHours * otRate,
  };
}

/**
 * Calculate broken turnaround penalty
 * OT rate applies for any shortfall under 11 hours between previous wrap and current call
 */
export function calculateBrokenTurnaround(
  previousWrapOut: string | null | undefined,
  currentPreCall: string | null | undefined,
  currentUnitCall: string,
  hourlyRate: number,
  otMultiplier: number = 1.5,
  minimumTurnaround: number = 11
): HoursAndPay {
  if (!previousWrapOut || !currentUnitCall) {
    return { hours: 0, pay: 0 };
  }

  // Use pre-call if they had one, otherwise unit call
  const callTime = currentPreCall || currentUnitCall;

  // Calculate actual turnaround (hours between previous wrap and current call)
  // Note: This calculation assumes same day or next day scenarios
  // For overnight scenarios, we need to add 24 hours to the call time
  let turnaroundHours = timeDiffHours(previousWrapOut, callTime);

  // If turnaround appears negative or very small, it's likely next day
  if (turnaroundHours < 0) {
    turnaroundHours += 24;
  }

  // If turnaround is sufficient, no penalty
  if (turnaroundHours >= minimumTurnaround) {
    return { hours: 0, pay: 0 };
  }

  const brokenHours = minimumTurnaround - turnaroundHours;
  const otRate = hourlyRate * otMultiplier;

  return {
    hours: brokenHours,
    pay: brokenHours * otRate,
  };
}

/**
 * Calculate late night enhancement
 * Enhanced rate for hours worked after 23:00
 *
 * Late night is paid as ADDITIONAL enhancement on top of base/OT,
 * so we pay the DIFFERENCE between late night rate and normal rate.
 */
export function calculateLateNight(
  unitCallTime: string,
  wrapTime: string,
  lunchTime: string | null | undefined,
  lunchDurationMins: number,
  hourlyRate: number,
  lateNightMultiplier: number = 2,
  lateNightThreshold: string = '23:00'
): HoursAndPay {
  if (!wrapTime || !unitCallTime) {
    return { hours: 0, pay: 0 };
  }

  const wrapMins = timeToMinutes(wrapTime);
  const thresholdMins = timeToMinutes(lateNightThreshold);

  // Handle overnight wraps (after midnight)
  let adjustedWrapMins = wrapMins;
  if (wrapMins < timeToMinutes(unitCallTime)) {
    adjustedWrapMins = wrapMins + 24 * 60; // Next day
  }

  // If wrap is before 23:00, no late night
  // Also handle the case where adjusted wrap is before threshold on next day
  if (adjustedWrapMins <= thresholdMins && wrapMins >= timeToMinutes(unitCallTime)) {
    return { hours: 0, pay: 0 };
  }

  // Calculate hours worked after 23:00
  let lateNightMins: number;
  if (adjustedWrapMins > thresholdMins) {
    lateNightMins = adjustedWrapMins - thresholdMins;
  } else {
    // Wrap is after midnight on next day
    lateNightMins = adjustedWrapMins - thresholdMins;
  }

  let lateNightHours = lateNightMins / 60;

  // Subtract lunch if lunch was taken after 23:00
  if (lunchTime) {
    const lunchMins = timeToMinutes(lunchTime);
    if (lunchMins > thresholdMins || lunchMins < timeToMinutes(unitCallTime)) {
      lateNightHours -= lunchDurationMins / 60;
    }
  }

  lateNightHours = Math.max(0, lateNightHours);

  // Late night enhancement is the DIFFERENCE (multiplier - 1) times hourly rate
  const enhancement = hourlyRate * (lateNightMultiplier - 1);

  return {
    hours: lateNightHours,
    pay: lateNightHours * enhancement,
  };
}

/**
 * Apply 6th/7th day multiplier to entire day's earnings
 */
export function applyDayMultiplier(
  baseDayTotal: number,
  is6thDay: boolean,
  is7thDay: boolean,
  sixthDayMultiplier: number = 1.5,
  seventhDayMultiplier: number = 2
): { multiplier: number; total: number } {
  if (is7thDay) {
    return {
      multiplier: seventhDayMultiplier,
      total: baseDayTotal * seventhDayMultiplier,
    };
  }
  if (is6thDay) {
    return {
      multiplier: sixthDayMultiplier,
      total: baseDayTotal * sixthDayMultiplier,
    };
  }
  return {
    multiplier: 1,
    total: baseDayTotal,
  };
}

// ============================================
// MASTER CALCULATION INTERFACE
// ============================================

export interface BECTUTimesheetEntry {
  date: string;
  dayRate: number;
  baseContract: BaseContract;
  dayType: BECTUDayType;
  preCallTime: string | null;
  unitCallTime: string;
  lunchTime: string | null;
  lunchDuration: number; // in minutes (auto-set from dayType)
  wrapOutTime: string;
  is6thDay: boolean;
  is7thDay: boolean;
  previousWrapOut: string | null; // from previous day's entry

  // Multipliers from rate card
  preCallMultiplier: number;
  otMultiplier: number;
  lateNightMultiplier: number;
  sixthDayMultiplier: number;
  seventhDayMultiplier: number;
}

export interface BECTUTimesheetCalculation {
  // Rates
  contractedHours: number;
  hourlyRate: number;
  otRate: number;

  // Hours breakdown
  actualWorkHours: number;
  preCallHours: number;
  overtimeHours: number;
  brokenLunchHours: number;
  brokenTurnaroundHours: number;
  lateNightHours: number;

  // Pay breakdown
  basePay: number;
  preCallPay: number;
  overtimePay: number;
  brokenLunchPay: number;
  brokenTurnaroundPay: number;
  lateNightPay: number;
  subtotal: number;
  dayMultiplier: number;
  totalPay: number;

  // Flags for UI warnings
  hasBrokenLunch: boolean;
  hasBrokenTurnaround: boolean;
  hasLateNight: boolean;
  hasOvertime: boolean;
}

/**
 * Master BECTU calculation function
 * Computes all pay components for a single timesheet entry
 */
export function calculateBECTUTimesheet(entry: BECTUTimesheetEntry): BECTUTimesheetCalculation {
  // Handle empty entries
  if (!entry.unitCallTime || !entry.wrapOutTime) {
    return createEmptyCalculation();
  }

  // 1. Get contracted hours based on base contract + day type
  const contractedHours = getContractedWorkHours(entry.baseContract, entry.dayType);

  // 2. Calculate hourly rate (day rate / contracted hours)
  const hourlyRate = getHourlyRate(entry.dayRate, entry.baseContract, entry.dayType);
  const otRate = hourlyRate * entry.otMultiplier;

  // 3. Calculate actual work hours
  // Total time on set minus lunch
  const startTime = entry.preCallTime || entry.unitCallTime;
  const totalOnSet = timeDiffHours(startTime, entry.wrapOutTime);
  const lunchHours = entry.lunchDuration / 60;
  const actualWorkHours = Math.max(0, totalOnSet - lunchHours);

  // 4. Pre-call (before unit call, at pre-call multiplier)
  const preCall = calculatePreCall(
    entry.preCallTime,
    entry.unitCallTime,
    hourlyRate,
    entry.preCallMultiplier
  );

  // 5. Calculate work hours AFTER unit call (excluding pre-call)
  const workHoursAfterUnitCall = timeDiffHours(entry.unitCallTime, entry.wrapOutTime) - lunchHours;

  // 6. Overtime (only on hours beyond contracted, from unit call onwards)
  const overtime = calculateOvertime(
    Math.max(0, workHoursAfterUnitCall),
    contractedHours,
    hourlyRate,
    entry.otMultiplier
  );

  // 7. Broken lunch
  const brokenLunch = calculateBrokenLunch(
    entry.unitCallTime,
    entry.lunchTime,
    entry.dayType,
    hourlyRate,
    entry.otMultiplier
  );

  // 8. Broken turnaround
  const brokenTurnaround = calculateBrokenTurnaround(
    entry.previousWrapOut,
    entry.preCallTime,
    entry.unitCallTime,
    hourlyRate,
    entry.otMultiplier
  );

  // 9. Late night
  const lateNight = calculateLateNight(
    entry.unitCallTime,
    entry.wrapOutTime,
    entry.lunchTime,
    entry.lunchDuration,
    hourlyRate,
    entry.lateNightMultiplier
  );

  // 10. Base pay is ALWAYS the guaranteed day rate minimum
  const basePay = entry.dayRate;

  // 11. Calculate subtotal (before day multiplier)
  // Base pay + all extras
  const subtotal = basePay +
    preCall.pay +
    overtime.pay +
    brokenLunch.pay +
    brokenTurnaround.pay +
    lateNight.pay;

  // 12. Apply 6th/7th day multiplier to entire subtotal
  const dayMultiplierResult = applyDayMultiplier(
    subtotal,
    entry.is6thDay,
    entry.is7thDay,
    entry.sixthDayMultiplier,
    entry.seventhDayMultiplier
  );

  return {
    // Rates
    contractedHours: round2(contractedHours),
    hourlyRate: round2(hourlyRate),
    otRate: round2(otRate),

    // Hours breakdown
    actualWorkHours: round2(actualWorkHours),
    preCallHours: round2(preCall.hours),
    overtimeHours: round2(overtime.hours),
    brokenLunchHours: round2(brokenLunch.hours),
    brokenTurnaroundHours: round2(brokenTurnaround.hours),
    lateNightHours: round2(lateNight.hours),

    // Pay breakdown
    basePay: round2(basePay),
    preCallPay: round2(preCall.pay),
    overtimePay: round2(overtime.pay),
    brokenLunchPay: round2(brokenLunch.pay),
    brokenTurnaroundPay: round2(brokenTurnaround.pay),
    lateNightPay: round2(lateNight.pay),
    subtotal: round2(subtotal),
    dayMultiplier: dayMultiplierResult.multiplier,
    totalPay: round2(dayMultiplierResult.total),

    // Flags for UI warnings
    hasBrokenLunch: brokenLunch.hours > 0,
    hasBrokenTurnaround: brokenTurnaround.hours > 0,
    hasLateNight: lateNight.hours > 0,
    hasOvertime: overtime.hours > 0,
  };
}

/**
 * Create empty calculation result
 */
function createEmptyCalculation(): BECTUTimesheetCalculation {
  return {
    contractedHours: 0,
    hourlyRate: 0,
    otRate: 0,
    actualWorkHours: 0,
    preCallHours: 0,
    overtimeHours: 0,
    brokenLunchHours: 0,
    brokenTurnaroundHours: 0,
    lateNightHours: 0,
    basePay: 0,
    preCallPay: 0,
    overtimePay: 0,
    brokenLunchPay: 0,
    brokenTurnaroundPay: 0,
    lateNightPay: 0,
    subtotal: 0,
    dayMultiplier: 1,
    totalPay: 0,
    hasBrokenLunch: false,
    hasBrokenTurnaround: false,
    hasLateNight: false,
    hasOvertime: false,
  };
}

/**
 * Round to 2 decimal places
 */
function round2(num: number): number {
  return Math.round(num * 100) / 100;
}

// ============================================
// CONVERSION HELPERS
// ============================================

/**
 * Convert legacy baseDayHours (10, 11) to BaseContract format
 */
export function baseDayHoursToContract(baseDayHours: number): BaseContract {
  return baseDayHours === 10 ? '10+1' : '11+1';
}

/**
 * Convert BaseContract to legacy baseDayHours
 */
export function contractToBaseDayHours(contract: BaseContract): number {
  return contract === '10+1' ? 10 : 11;
}
