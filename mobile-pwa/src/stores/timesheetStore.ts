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
  BaseContract,
} from '@/types';
import { createDefaultRateCard, createEmptyTimesheetEntry, getLunchDurationForDayType } from '@/types';
import {
  calculateBECTUTimesheet,
  getLunchDuration,
  baseDayHoursToContract,
  type BECTUTimesheetEntry,
  type BECTUDayType,
} from '@/utils/bectuCalculations';

// Parse call sheet dayType string to determine DayType
function parseDayTypeFromCallSheet(dayTypeStr?: string): DayType {
  if (!dayTypeStr) return 'SWD';
  const upper = dayTypeStr.toUpperCase();
  if (upper.includes('SCWD') || upper.includes('SHORT CONTINUOUS')) return 'SCWD';
  if (upper.includes('CWD') || upper.includes('CONTINUOUS')) return 'CWD';
  return 'SWD';
}

/**
 * Create empty calculation result for incomplete entries
 */
function createEmptyCalculation(): TimesheetCalculation {
  return {
    contractedHours: 0,
    hourlyRate: 0,
    otRate: 0,
    preCallHours: 0,
    preCallEarnings: 0,
    workingHours: 0,
    actualWorkHours: 0,
    baseHours: 0,
    otHours: 0,
    brokenLunchHours: 0,
    brokenTurnaroundHours: 0,
    lateNightHours: 0,
    totalHours: 0,
    dailyEarnings: 0,
    basePay: 0,
    otEarnings: 0,
    overtimePay: 0,
    brokenLunchPay: 0,
    brokenTurnaroundPay: 0,
    lateNightEarnings: 0,
    lateNightPay: 0,
    sixthDayBonus: 0,
    seventhDayBonus: 0,
    dayMultiplier: 1,
    subtotal: 0,
    kitRental: 0,
    totalEarnings: 0,
    totalPay: 0,
    brokenLunch: false,
    hasBrokenLunch: false,
    brokenTurnaround: false,
    hasBrokenTurnaround: false,
    hasLateNight: false,
    hasOvertime: false,
  };
}

/**
 * Convert TimesheetEntry + RateCard to BECTUTimesheetEntry format for calculation
 */
function toBECTUEntry(entry: TimesheetEntry, rateCard: RateCard, previousWrapOut?: string): BECTUTimesheetEntry {
  // Get base contract from rate card (use baseContract if available, otherwise derive from baseDayHours)
  const baseContract: BaseContract = rateCard.baseContract || baseDayHoursToContract(rateCard.baseDayHours);

  return {
    date: entry.date,
    dayRate: rateCard.dailyRate,
    baseContract: baseContract,
    dayType: entry.dayType as BECTUDayType,
    preCallTime: entry.preCall || null,
    unitCallTime: entry.unitCall,
    lunchTime: entry.lunchStart || entry.callSheetLunch || null,
    lunchDuration: entry.lunchTaken || getLunchDuration(entry.dayType as BECTUDayType),
    wrapOutTime: entry.wrapOut,
    is6thDay: entry.isSixthDay,
    is7thDay: entry.isSeventhDay,
    previousWrapOut: entry.previousWrapOut || previousWrapOut || null,
    preCallMultiplier: rateCard.preCallMultiplier,
    otMultiplier: rateCard.otMultiplier,
    lateNightMultiplier: rateCard.lateNightMultiplier,
    sixthDayMultiplier: rateCard.sixthDayMultiplier,
    seventhDayMultiplier: rateCard.seventhDayMultiplier,
  };
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
  calculateEntry: (entry: TimesheetEntry, previousWrapOut?: string) => TimesheetCalculation;
  getPreviousWrapOut: (date: string) => string | undefined;
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

      // Calculations - BECTU UK Film Industry Standards
      calculateEntry: (entry, previousWrapOut?: string) => {
        const { rateCard } = get();

        // Empty entry check - return empty calculation
        if (!entry.unitCall || !entry.wrapOut) {
          return createEmptyCalculation();
        }

        // Convert to BECTU format and calculate
        const bectuEntry = toBECTUEntry(entry, rateCard, previousWrapOut);
        const bectuCalc = calculateBECTUTimesheet(bectuEntry);

        // Calculate 6th/7th day bonuses for display
        // (These are included in totalPay via dayMultiplier, but we break them out for UI)
        let sixthDayBonus = 0;
        let seventhDayBonus = 0;
        if (entry.isSeventhDay) {
          seventhDayBonus = bectuCalc.subtotal * (rateCard.seventhDayMultiplier - 1);
        } else if (entry.isSixthDay) {
          sixthDayBonus = bectuCalc.subtotal * (rateCard.sixthDayMultiplier - 1);
        }

        // Add kit rental to total
        const kitRental = rateCard.kitRental;
        const totalEarnings = bectuCalc.totalPay + kitRental;

        // Map to TimesheetCalculation interface (with backward-compatible aliases)
        return {
          // Rates
          contractedHours: bectuCalc.contractedHours,
          hourlyRate: bectuCalc.hourlyRate,
          otRate: bectuCalc.otRate,

          // Hours
          preCallHours: bectuCalc.preCallHours,
          workingHours: bectuCalc.actualWorkHours, // Alias
          actualWorkHours: bectuCalc.actualWorkHours,
          baseHours: bectuCalc.contractedHours, // Base hours is contracted hours
          otHours: bectuCalc.overtimeHours,
          brokenLunchHours: bectuCalc.brokenLunchHours,
          brokenTurnaroundHours: bectuCalc.brokenTurnaroundHours,
          lateNightHours: bectuCalc.lateNightHours,
          totalHours: bectuCalc.actualWorkHours + bectuCalc.preCallHours,

          // Earnings
          preCallEarnings: bectuCalc.preCallPay,
          dailyEarnings: bectuCalc.basePay, // Day rate guarantee
          basePay: bectuCalc.basePay,
          otEarnings: bectuCalc.overtimePay,
          overtimePay: bectuCalc.overtimePay,
          brokenLunchPay: bectuCalc.brokenLunchPay,
          brokenTurnaroundPay: bectuCalc.brokenTurnaroundPay,
          lateNightEarnings: bectuCalc.lateNightPay,
          lateNightPay: bectuCalc.lateNightPay,
          sixthDayBonus: Math.round(sixthDayBonus * 100) / 100,
          seventhDayBonus: Math.round(seventhDayBonus * 100) / 100,
          dayMultiplier: bectuCalc.dayMultiplier,
          subtotal: bectuCalc.subtotal,
          kitRental,
          totalEarnings: Math.round(totalEarnings * 100) / 100,
          totalPay: Math.round(totalEarnings * 100) / 100,

          // Flags
          brokenLunch: bectuCalc.hasBrokenLunch,
          hasBrokenLunch: bectuCalc.hasBrokenLunch,
          brokenTurnaround: bectuCalc.hasBrokenTurnaround,
          hasBrokenTurnaround: bectuCalc.hasBrokenTurnaround,
          hasLateNight: bectuCalc.hasLateNight,
          hasOvertime: bectuCalc.hasOvertime,
        };
      },

      // Get previous day's wrap out time for turnaround calculation
      getPreviousWrapOut: (date) => {
        const prevDate = addDays(date, -1);
        const prevEntry = get().entries[prevDate];
        return prevEntry?.wrapOut || undefined;
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

        // Calculate totals with BECTU fields
        let totalHours = 0;
        let preCallHours = 0;
        let baseHours = 0;
        let otHours = 0;
        let lateNightHours = 0;
        let brokenLunchHours = 0;
        let brokenTurnaroundHours = 0;
        let sixthDayHours = 0;
        let seventhDayHours = 0;
        let totalEarnings = 0;
        let kitRentalTotal = 0;

        // Pay breakdown totals
        let basePay = 0;
        let overtimePay = 0;
        let preCallPay = 0;
        let brokenLunchPay = 0;
        let brokenTurnaroundPay = 0;
        let lateNightPay = 0;

        // Sort entries by date for proper turnaround calculation
        const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));

        sortedEntries.forEach((entry, index) => {
          // Get previous day's wrap for turnaround calculation
          const previousWrapOut = index > 0 ? sortedEntries[index - 1].wrapOut : state.getPreviousWrapOut(entry.date);

          const calc = state.calculateEntry(entry, previousWrapOut);

          totalHours += calc.totalHours;
          preCallHours += calc.preCallHours;
          baseHours += calc.baseHours;
          otHours += calc.otHours;
          lateNightHours += calc.lateNightHours;
          brokenLunchHours += calc.brokenLunchHours;
          brokenTurnaroundHours += calc.brokenTurnaroundHours;

          if (entry.isSixthDay && !entry.isSeventhDay) {
            sixthDayHours += calc.totalHours;
          }
          if (entry.isSeventhDay) {
            seventhDayHours += calc.totalHours;
          }

          totalEarnings += calc.totalEarnings;
          basePay += calc.basePay;
          overtimePay += calc.overtimePay;
          preCallPay += calc.preCallEarnings;
          brokenLunchPay += calc.brokenLunchPay;
          brokenTurnaroundPay += calc.brokenTurnaroundPay;
          lateNightPay += calc.lateNightPay;

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
          brokenLunchHours: Math.round(brokenLunchHours * 10) / 10,
          brokenTurnaroundHours: Math.round(brokenTurnaroundHours * 10) / 10,
          kitRentalTotal,
          totalEarnings: Math.round(totalEarnings * 100) / 100,
          entries,
          // Pay breakdown
          basePay: Math.round(basePay * 100) / 100,
          overtimePay: Math.round(overtimePay * 100) / 100,
          preCallPay: Math.round(preCallPay * 100) / 100,
          brokenLunchPay: Math.round(brokenLunchPay * 100) / 100,
          brokenTurnaroundPay: Math.round(brokenTurnaroundPay * 100) / 100,
          lateNightPay: Math.round(lateNightPay * 100) / 100,
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
