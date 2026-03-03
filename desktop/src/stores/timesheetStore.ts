import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TimesheetEntry, WeekSummary } from '@/types';
import { v4 as uuid } from 'uuid';

interface TimesheetStore {
  entries: TimesheetEntry[];

  addEntry: (entry: Omit<TimesheetEntry, 'id'>) => string;
  updateEntry: (id: string, data: Partial<TimesheetEntry>) => void;
  deleteEntry: (id: string) => void;
  getWeekEntries: (weekStart: string) => TimesheetEntry[];
  getWeekSummary: (weekStart: string) => WeekSummary;
  clearTimesheetData: () => void;
}

export const useTimesheetStore = create<TimesheetStore>()(
  persist(
    (set, get) => ({
      entries: [],

      addEntry: (entry: Omit<TimesheetEntry, 'id'>) => {
        const id = uuid();
        const newEntry: TimesheetEntry = { ...entry, id };
        set((state) => ({
          entries: [...state.entries, newEntry],
        }));
        return id;
      },

      updateEntry: (id: string, data: Partial<TimesheetEntry>) => {
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === id ? { ...e, ...data } : e
          ),
        }));
      },

      deleteEntry: (id: string) => {
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        }));
      },

      getWeekEntries: (weekStart: string) => {
        const { entries } = get();
        const start = new Date(weekStart);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);

        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        return entries.filter(
          (e) => e.date >= startStr && e.date < endStr
        );
      },

      getWeekSummary: (weekStart: string) => {
        const weekEntries = get().getWeekEntries(weekStart);

        let totalHours = 0;
        let totalOvertime = 0;
        let totalCost = 0;

        for (const entry of weekEntries) {
          totalHours += entry.hoursWorked;
          totalOvertime += entry.overtime;
          totalCost +=
            entry.hoursWorked * entry.hourlyRate +
            entry.overtime * entry.hourlyRate * 1.5;
        }

        return {
          totalHours,
          totalOvertime,
          totalCost,
          entries: weekEntries,
        };
      },

      clearTimesheetData: () => {
        set({ entries: [] });
      },
    }),
    {
      name: 'prep-happy-timesheet',
    }
  )
);
