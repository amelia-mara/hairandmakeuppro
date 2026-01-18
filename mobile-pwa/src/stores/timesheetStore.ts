import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  RateCard,
  TimesheetEntry,
  TimesheetCalculation,
  WeekSummary,
  TimesheetView,
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

      // Calculations
      calculateEntry: (entry) => {
        const { rateCard } = get();

        // Empty entry
        if (!entry.unitCall || !entry.wrap) {
          return {
            preCallHours: 0,
            workingHours: 0,
            totalHours: 0,
            baseHours: 0,
            otHours: 0,
            dailyEarnings: 0,
            otEarnings: 0,
            sixthDayBonus: 0,
            kitRental: 0,
            totalEarnings: 0,
          };
        }

        // 1. Pre-call time = unitCall - preCall
        const preCallHours = entry.preCall ? getHoursDiff(entry.preCall, entry.unitCall) : 0;

        // 2. Working time = wrap - unitCall - lunch break
        const lunchDeduction = entry.brokenLunch ? 0.5 : 1;
        const rawWorkingHours = getHoursDiff(entry.unitCall, entry.wrap);
        const workingHours = Math.max(0, rawWorkingHours - lunchDeduction);

        // 3. Total hours
        const totalHours = preCallHours + workingHours;

        // 4. Base hours from rate card
        const baseHours = Math.min(totalHours, rateCard.baseDayHours);

        // 5. OT hours
        const otHours = Math.max(0, totalHours - rateCard.baseDayHours);

        // 6. Calculate hourly rate
        const hourlyRate = rateCard.dailyRate / rateCard.baseDayHours;

        // 7. Daily earnings (base)
        let dailyEarnings = baseHours * hourlyRate;

        // 8. OT earnings (at 1.5x)
        const otEarnings = otHours * hourlyRate * rateCard.otMultiplier;

        // 9. Sixth day bonus (entire day at 1.5x, so add 0.5x to base)
        let sixthDayBonus = 0;
        if (entry.isSixthDay) {
          sixthDayBonus = (dailyEarnings + otEarnings) * (rateCard.sixthDayMultiplier - 1);
        }

        // 10. Kit rental
        const kitRental = rateCard.kitRental;

        // Total
        const totalEarnings = dailyEarnings + otEarnings + sixthDayBonus + kitRental;

        return {
          preCallHours: Math.round(preCallHours * 10) / 10,
          workingHours: Math.round(workingHours * 10) / 10,
          totalHours: Math.round(totalHours * 10) / 10,
          baseHours: Math.round(baseHours * 10) / 10,
          otHours: Math.round(otHours * 10) / 10,
          dailyEarnings: Math.round(dailyEarnings * 100) / 100,
          otEarnings: Math.round(otEarnings * 100) / 100,
          sixthDayBonus: Math.round(sixthDayBonus * 100) / 100,
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
        let baseHours = 0;
        let otHours = 0;
        let sixthDayHours = 0;
        let totalEarnings = 0;
        let kitRentalTotal = 0;

        entries.forEach((entry) => {
          const calc = get().calculateEntry(entry);
          totalHours += calc.totalHours;
          baseHours += calc.baseHours;
          otHours += calc.otHours;
          if (entry.isSixthDay) {
            sixthDayHours += calc.totalHours;
          }
          totalEarnings += calc.totalEarnings;
          if (entry.unitCall && entry.wrap) {
            kitRentalTotal += state.rateCard.kitRental;
          }
        });

        return {
          startDate: weekStartDate,
          endDate: addDays(weekStartDate, 6),
          totalHours: Math.round(totalHours * 10) / 10,
          baseHours: Math.round(baseHours * 10) / 10,
          otHours: Math.round(otHours * 10) / 10,
          sixthDayHours: Math.round(sixthDayHours * 10) / 10,
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
