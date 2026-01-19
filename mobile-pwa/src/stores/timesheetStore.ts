import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  RateCard,
  TimesheetEntry,
  TimesheetCalculation,
  WeekSummary,
  TimesheetView,
  CallSheet,
} from '@/types';
import { createDefaultRateCard, createEmptyTimesheetEntry } from '@/types';

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

      // Navigation actions
      setSelectedDate: (date) => set({ selectedDate: date }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setEditingEntry: (editing) => set({ editingEntry: editing }),

      navigateDay: (direction) => {
        const state = get();
        const newDate = addDays(state.selectedDate, direction === 'next' ? 1 : -1);
        set({ selectedDate: newDate });
      },

      // Call sheet auto-fill
      autoFillFromCallSheet: (date, callSheet) => {
        const existingEntry = get().entries[date] || createEmptyTimesheetEntry(date);

        const autoFilledEntry: TimesheetEntry = {
          ...existingEntry,
          unitCall: callSheet.unitCallTime || existingEntry.unitCall,
          wrapOut: callSheet.wrapEstimate || existingEntry.wrapOut,
          lunchTaken: 60, // Default 1 hour lunch from call sheet
          productionDay: callSheet.productionDay,
          autoFilledFrom: callSheet.id,
          callSheetUnitCall: callSheet.unitCallTime,
          callSheetLunch: callSheet.lunchTime,
          callSheetWrap: callSheet.wrapEstimate,
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
        const lunchDeduction = (entry.lunchTaken ?? rateCard.lunchDuration) / 60;
        const rawWorkingHours = getHoursDiff(entry.unitCall, entry.wrapOut);
        const workingHours = Math.max(0, rawWorkingHours - lunchDeduction);

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

        // 5. Base hours (capped at base day hours)
        const baseHours = Math.min(workingHours, rateCard.baseDayHours);

        // 6. OT hours (beyond base, excluding late night)
        const otHours = Math.max(0, workingHours - rateCard.baseDayHours - lateNightHours);

        // 7. Daily earnings (base hours at standard rate)
        const dailyEarnings = baseHours * hourlyRate;

        // 8. OT earnings (at 1.5x)
        const otEarnings = otHours * hourlyRate * rateCard.otMultiplier;

        // 9. Late night earnings (at 2x)
        const lateNightEarnings = lateNightHours * hourlyRate * rateCard.lateNightMultiplier;

        // 10. Sixth day bonus (1.5x)
        let sixthDayBonus = 0;
        if (entry.isSixthDay && !entry.isSeventhDay) {
          const baseEarnings = dailyEarnings + otEarnings + lateNightEarnings + preCallEarnings;
          sixthDayBonus = baseEarnings * (rateCard.sixthDayMultiplier - 1);
        }

        // 11. Seventh day bonus (2x)
        let seventhDayBonus = 0;
        if (entry.isSeventhDay) {
          const baseEarnings = dailyEarnings + otEarnings + lateNightEarnings + preCallEarnings;
          seventhDayBonus = baseEarnings * (rateCard.seventhDayMultiplier - 1);
        }

        // 12. Kit rental
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
