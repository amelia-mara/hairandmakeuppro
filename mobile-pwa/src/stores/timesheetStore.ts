import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  RateCard,
  TimesheetEntry,
  TimesheetCalculation,
  WeekSummary,
  TimesheetView,
  CallSheet,
  DayType,
} from '@/types';
import { createDefaultRateCard, createEmptyTimesheetEntry, getLunchDurationForDayType } from '@/types';

// Parse call sheet dayType string to determine DayType
function parseDayTypeFromCallSheet(dayTypeStr?: string): DayType {
  if (!dayTypeStr) return 'SWD';
  const upper = dayTypeStr.toUpperCase();
  if (upper.includes('SCWD') || upper.includes('SHORT CONTINUOUS')) return 'SCWD';
  if (upper.includes('CWD') || upper.includes('CONTINUOUS')) return 'CWD';
  return 'SWD';
}

/**
 * Calculate the OT threshold (working hours before overtime kicks in) based on day type
 *
 * UK Film Industry working day rules:
 *
 * SWD (Standard Working Day):
 * - 10hrs or 11hrs working + 1hr unpaid lunch
 * - OT starts after baseDayHours (e.g., 10hrs for 10+1, 11hrs for 11+1)
 * - Lunch must happen minimum 6hrs from unit call, otherwise it's a "broken lunch"
 *
 * SCWD (Short Continuous Working Day):
 * - 9.5hr work day (from 10+1) or 10.5hrs (from 11+1)
 * - 30 mins lunch - minimum 6 hours from unit call
 * - OT starts after baseDayHours - 0.5 (e.g., 9.5hrs for 10+1, 10.5hrs for 11+1)
 *
 * CWD (Continuous Working Day):
 * - 9 hours straight working (from 10+1) or 10 hours (from 11+1)
 * - Working lunch "in hand" (30 min paid)
 * - OT starts after baseDayHours - 1 (e.g., 9hrs for 10+1, 10hrs for 11+1)
 */
function getOTThresholdForDayType(dayType: DayType, baseDayHours: number): number {
  switch (dayType) {
    case 'SWD':
      // Standard: full baseDayHours working before OT
      // e.g., 10+1 = 10hrs working, 11+1 = 11hrs working
      return baseDayHours;
    case 'SCWD':
      // Short Continuous: 30min less working time due to shorter lunch
      // e.g., 10+1 becomes 9.5hrs working, 11+1 becomes 10.5hrs working
      return baseDayHours - 0.5;
    case 'CWD':
      // Continuous: 1hr less working time (working lunch in hand)
      // e.g., 10+1 becomes 9hrs working, 11+1 becomes 10hrs working
      return baseDayHours - 1;
    default:
      return baseDayHours;
  }
}

/**
 * Check if lunch is "broken" (taken less than 6 hours from unit call)
 * This applies to SWD and SCWD day types
 */
function isLunchBroken(unitCall: string, lunchTime: string | undefined): boolean {
  if (!lunchTime) return false;

  const unitCallTime = parseTime(unitCall);
  const lunchStartTime = parseTime(lunchTime);

  if (unitCallTime === null || lunchStartTime === null) return false;

  // Calculate hours between unit call and lunch
  let hoursToLunch = lunchStartTime - unitCallTime;
  if (hoursToLunch < 0) hoursToLunch += 24; // Handle overnight

  // Lunch must be minimum 6 hours from unit call
  return hoursToLunch < 6;
}

/**
 * Get the lunch deduction in hours based on day type
 */
function getLunchDeductionHours(dayType: DayType): number {
  switch (dayType) {
    case 'SWD':
      return 1; // 1 hour unpaid lunch
    case 'SCWD':
      return 0.5; // 30 min lunch (deducted from working time)
    case 'CWD':
      return 0; // Working lunch in hand - no deduction
    default:
      return 1;
  }
}

interface TimesheetState {
  // Data
  rateCard: RateCard;
  entries: Record<string, TimesheetEntry>; // keyed by date (YYYY-MM-DD)

  // UI State
  selectedDate: string; // YYYY-MM-DD
  viewMode: TimesheetView;
  editingEntry: boolean;

  // Actions - Rate Card
  updateRateCard: (updates: Partial<RateCard>) => void;

  // Actions - Entries
  getEntry: (date: string) => TimesheetEntry;
  saveEntry: (entry: TimesheetEntry) => void;
  deleteEntry: (date: string) => void;
  clearAll: () => void;
  autoFillFromCallSheet: (date: string, callSheet: CallSheet) => TimesheetEntry;

  // Actions - Navigation
  setSelectedDate: (date: string) => void;
  setViewMode: (mode: TimesheetView) => void;
  setEditingEntry: (editing: boolean) => void;
  navigateDay: (direction: 'prev' | 'next') => void;

  // Calculations
  calculateEntry: (entry: TimesheetEntry) => TimesheetCalculation;
  getWeekSummary: (weekStartDate: string) => WeekSummary;
  getMonthEntries: (year: number, month: number) => TimesheetEntry[];
}

// Helper functions for time calculations
function parseTime(timeStr: string): number | null {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours + minutes / 60;
}

function getHoursDiff(start: string, end: string): number {
  const startTime = parseTime(start);
  const endTime = parseTime(end);
  if (startTime === null || endTime === null) return 0;

  // Handle overnight (wrap time is next day)
  let diff = endTime - startTime;
  if (diff < 0) diff += 24;
  return diff;
}

function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return formatDateString(date);
}

function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  date.setDate(diff);
  return formatDateString(date);
}

export const useTimesheetStore = create<TimesheetState>()(
  persist(
    (set, get) => ({
      // Initial state
      rateCard: createDefaultRateCard(),
      entries: {},
      selectedDate: formatDateString(new Date()),
      viewMode: 'week',
      editingEntry: false,

      // Rate Card actions
      updateRateCard: (updates) => {
        set((state) => ({
          rateCard: { ...state.rateCard, ...updates },
        }));
      },

      // Entry actions
      getEntry: (date) => {
        const state = get();
        return state.entries[date] || createEmptyTimesheetEntry(date);
      },

      saveEntry: (entry) => {
        set((state) => ({
          entries: {
            ...state.entries,
            [entry.date]: entry,
          },
        }));
      },

      deleteEntry: (date) => {
        set((state) => {
          const newEntries = { ...state.entries };
          delete newEntries[date];
          return { entries: newEntries };
        });
      },

      clearAll: () => {
        set({
          rateCard: createDefaultRateCard(),
          entries: {},
          selectedDate: formatDateString(new Date()),
          viewMode: 'week',
          editingEntry: false,
        });
      },

      // Navigation actions
      setSelectedDate: (date) => set({ selectedDate: date }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setEditingEntry: (editing) => set({ editingEntry: editing }),

      navigateDay: (direction) => {
        const state = get();
        const newDate = addDays(state.selectedDate, direction === 'next' ? 1 : -1);
        set({ selectedDate: newDate });
      },

      // Call sheet auto-fill - sets pre-call, unit call, and day type; leaves wrap empty for user
      autoFillFromCallSheet: (date, callSheet) => {
        const existingEntry = get().entries[date] || createEmptyTimesheetEntry(date);

        // Determine day type from call sheet
        const dayType = parseDayTypeFromCallSheet(callSheet.dayType);
        const lunchDuration = getLunchDurationForDayType(dayType);

        // Get HMU pre-call time from call sheet
        const preCallTime = callSheet.preCalls?.hmu || '';

        const autoFilledEntry: TimesheetEntry = {
          ...existingEntry,
          preCall: preCallTime || existingEntry.preCall,
          unitCall: callSheet.unitCallTime || existingEntry.unitCall,
          dayType: dayType,
          // Leave wrap times empty for user to fill
          wrapOut: existingEntry.wrapOut || '', // Don't auto-fill wrap
          outOfChair: existingEntry.outOfChair || '', // Don't auto-fill out of chair
          lunchTaken: lunchDuration,
          productionDay: callSheet.productionDay,
          autoFilledFrom: callSheet.id,
          callSheetUnitCall: callSheet.unitCallTime,
          callSheetLunch: callSheet.lunchTime,
          callSheetWrap: callSheet.wrapEstimate, // Store for reference but don't auto-fill
        };

        return autoFilledEntry;
      },

      // Calculations
      calculateEntry: (entry) => {
        const { rateCard } = get();

        // Empty entry check
        if (!entry.unitCall || !entry.wrapOut) {
          return {
            preCallHours: 0,
            preCallEarnings: 0,
            workingHours: 0,
            baseHours: 0,
            otHours: 0,
            lateNightHours: 0,
            totalHours: 0,
            dailyEarnings: 0,
            otEarnings: 0,
            lateNightEarnings: 0,
            sixthDayBonus: 0,
            seventhDayBonus: 0,
            kitRental: 0,
            totalEarnings: 0,
          };
        }

        // Calculate hourly rate
        const hourlyRate = rateCard.dailyRate / rateCard.baseDayHours;

        // 1. Pre-call hours (before unit call) - paid at pre-call multiplier
        const preCallHours = entry.preCall ? getHoursDiff(entry.preCall, entry.unitCall) : 0;
        const preCallEarnings = preCallHours * hourlyRate * rateCard.preCallMultiplier;

        // 2. Working time = wrapOut - unitCall - lunch break
        // Use day-type-specific lunch deduction:
        // - SWD: 1hr unpaid lunch deducted
        // - SCWD: 30min lunch deducted
        // - CWD: No deduction (working lunch in hand)
        const lunchDeductionHours = getLunchDeductionHours(entry.dayType);
        const rawWorkingHours = getHoursDiff(entry.unitCall, entry.wrapOut);
        const workingHours = Math.max(0, rawWorkingHours - lunchDeductionHours);

        // Check for broken lunch (lunch taken less than 6hrs from unit call)
        // This applies to SWD and SCWD day types
        const brokenLunch = (entry.dayType === 'SWD' || entry.dayType === 'SCWD')
          ? isLunchBroken(entry.unitCall, entry.callSheetLunch)
          : false;

        // 3. Calculate late night hours (after 23:00)
        const wrapTime = parseTime(entry.wrapOut);
        const lateNightThreshold = 23; // 11 PM
        let lateNightHours = 0;

        if (wrapTime !== null) {
          // If wrap is after midnight (0-6), treat as next day (add 24)
          const adjustedWrap = wrapTime < 6 ? wrapTime + 24 : wrapTime;
          if (adjustedWrap > lateNightThreshold) {
            lateNightHours = adjustedWrap - lateNightThreshold;
          }
        }

        // 4. Total hours
        const totalHours = preCallHours + workingHours;

        // 5. Calculate OT threshold based on day type
        // Use entry's dayType (from individual entry) to determine when OT kicks in
        const otThreshold = getOTThresholdForDayType(entry.dayType, rateCard.baseDayHours);

        // 6. Base hours (capped at OT threshold for the day type)
        const baseHours = Math.min(workingHours, otThreshold);

        // 7. OT hours (beyond OT threshold, excluding late night)
        const otHours = Math.max(0, workingHours - otThreshold - lateNightHours);

        // 8. Daily earnings (base hours at standard rate)
        const dailyEarnings = baseHours * hourlyRate;

        // 9. OT earnings (at 1.5x)
        const otEarnings = otHours * hourlyRate * rateCard.otMultiplier;

        // 10. Late night earnings (at 2x)
        const lateNightEarnings = lateNightHours * hourlyRate * rateCard.lateNightMultiplier;

        // 11. Sixth day bonus (1.5x)
        let sixthDayBonus = 0;
        if (entry.isSixthDay && !entry.isSeventhDay) {
          const baseEarnings = dailyEarnings + otEarnings + lateNightEarnings + preCallEarnings;
          sixthDayBonus = baseEarnings * (rateCard.sixthDayMultiplier - 1);
        }

        // 12. Seventh day bonus (2x)
        let seventhDayBonus = 0;
        if (entry.isSeventhDay) {
          const baseEarnings = dailyEarnings + otEarnings + lateNightEarnings + preCallEarnings;
          seventhDayBonus = baseEarnings * (rateCard.seventhDayMultiplier - 1);
        }

        // 13. Kit rental
        const kitRental = rateCard.kitRental;

        // Total earnings
        const totalEarnings = preCallEarnings + dailyEarnings + otEarnings + lateNightEarnings + sixthDayBonus + seventhDayBonus + kitRental;

        return {
          preCallHours: Math.round(preCallHours * 100) / 100,
          preCallEarnings: Math.round(preCallEarnings * 100) / 100,
          workingHours: Math.round(workingHours * 100) / 100,
          baseHours: Math.round(baseHours * 100) / 100,
          otHours: Math.round(otHours * 100) / 100,
          lateNightHours: Math.round(lateNightHours * 100) / 100,
          totalHours: Math.round(totalHours * 100) / 100,
          dailyEarnings: Math.round(dailyEarnings * 100) / 100,
          otEarnings: Math.round(otEarnings * 100) / 100,
          lateNightEarnings: Math.round(lateNightEarnings * 100) / 100,
          sixthDayBonus: Math.round(sixthDayBonus * 100) / 100,
          seventhDayBonus: Math.round(seventhDayBonus * 100) / 100,
          kitRental,
          totalEarnings: Math.round(totalEarnings * 100) / 100,
          brokenLunch,
        };
      },

      getWeekSummary: (weekStartDate) => {
        const state = get();
        const entries: TimesheetEntry[] = [];

        // Get all 7 days of the week
        for (let i = 0; i < 7; i++) {
          const date = addDays(weekStartDate, i);
          if (state.entries[date]) {
            entries.push(state.entries[date]);
          }
        }

        // Calculate totals
        let totalHours = 0;
        let preCallHours = 0;
        let baseHours = 0;
        let otHours = 0;
        let lateNightHours = 0;
        let sixthDayHours = 0;
        let seventhDayHours = 0;
        let totalEarnings = 0;
        let kitRentalTotal = 0;

        entries.forEach((entry) => {
          const calc = get().calculateEntry(entry);
          totalHours += calc.totalHours;
          preCallHours += calc.preCallHours;
          baseHours += calc.baseHours;
          otHours += calc.otHours;
          lateNightHours += calc.lateNightHours;
          if (entry.isSixthDay && !entry.isSeventhDay) {
            sixthDayHours += calc.totalHours;
          }
          if (entry.isSeventhDay) {
            seventhDayHours += calc.totalHours;
          }
          totalEarnings += calc.totalEarnings;
          if (entry.unitCall && entry.wrapOut) {
            kitRentalTotal += state.rateCard.kitRental;
          }
        });

        return {
          startDate: weekStartDate,
          endDate: addDays(weekStartDate, 6),
          totalHours: Math.round(totalHours * 10) / 10,
          preCallHours: Math.round(preCallHours * 10) / 10,
          baseHours: Math.round(baseHours * 10) / 10,
          otHours: Math.round(otHours * 10) / 10,
          sixthDayHours: Math.round(sixthDayHours * 10) / 10,
          seventhDayHours: Math.round(seventhDayHours * 10) / 10,
          lateNightHours: Math.round(lateNightHours * 10) / 10,
          kitRentalTotal,
          totalEarnings: Math.round(totalEarnings * 100) / 100,
          entries,
        };
      },

      getMonthEntries: (year, month) => {
        const state = get();
        const entries: TimesheetEntry[] = [];

        // Get first and last day of month
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // Iterate through all days
        const current = new Date(firstDay);
        while (current <= lastDay) {
          const dateStr = formatDateString(current);
          if (state.entries[dateStr]) {
            entries.push(state.entries[dateStr]);
          }
          current.setDate(current.getDate() + 1);
        }

        return entries;
      },
    }),
    {
      name: 'hair-makeup-timesheet-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Utility exports
export { formatDateString, addDays, getWeekStart, parseTime, getHoursDiff };
