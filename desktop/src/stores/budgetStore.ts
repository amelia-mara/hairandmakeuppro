import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BudgetCategory, BudgetEntry, BudgetTotals } from '@/types';
import { v4 as uuid } from 'uuid';

interface BudgetStore {
  categories: BudgetCategory[];
  entries: BudgetEntry[];

  addCategory: (name: string) => string;
  removeCategory: (id: string) => void;
  addEntry: (entry: Omit<BudgetEntry, 'id' | 'total'>) => string;
  updateEntry: (id: string, data: Partial<BudgetEntry>) => void;
  deleteEntry: (id: string) => void;
  getTotals: () => BudgetTotals;
  clearBudgetData: () => void;
}

const defaultCategories: BudgetCategory[] = [
  { id: 'cat-prep', name: 'Prep', order: 0 },
  { id: 'cat-shoot', name: 'Shoot', order: 1 },
  { id: 'cat-consumables', name: 'Consumables', order: 2 },
  { id: 'cat-additional', name: 'Additional', order: 3 },
];

export const useBudgetStore = create<BudgetStore>()(
  persist(
    (set, get) => ({
      categories: defaultCategories,
      entries: [],

      addCategory: (name: string) => {
        const id = uuid();
        set((state) => {
          const maxOrder = state.categories.reduce(
            (max, c) => Math.max(max, c.order),
            -1
          );
          return {
            categories: [
              ...state.categories,
              { id, name, order: maxOrder + 1 },
            ],
          };
        });
        return id;
      },

      removeCategory: (id: string) => {
        set((state) => ({
          categories: state.categories.filter((c) => c.id !== id),
          entries: state.entries.filter((e) => e.categoryId !== id),
        }));
      },

      addEntry: (entry: Omit<BudgetEntry, 'id' | 'total'>) => {
        const id = uuid();
        const total = entry.quantity * entry.rate;
        const newEntry: BudgetEntry = { ...entry, id, total };
        set((state) => ({
          entries: [...state.entries, newEntry],
        }));
        return id;
      },

      updateEntry: (id: string, data: Partial<BudgetEntry>) => {
        set((state) => ({
          entries: state.entries.map((e) => {
            if (e.id !== id) return e;
            const updated = { ...e, ...data };
            updated.total = updated.quantity * updated.rate;
            return updated;
          }),
        }));
      },

      deleteEntry: (id: string) => {
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        }));
      },

      getTotals: () => {
        const { entries } = get();
        const byCategory: Record<string, number> = {};
        let grandTotal = 0;

        for (const entry of entries) {
          if (!byCategory[entry.categoryId]) {
            byCategory[entry.categoryId] = 0;
          }
          byCategory[entry.categoryId] += entry.total;
          grandTotal += entry.total;
        }

        return { byCategory, grandTotal };
      },

      clearBudgetData: () => {
        set({
          categories: defaultCategories,
          entries: [],
        });
      },
    }),
    {
      name: 'prep-happy-budget',
    }
  )
);
