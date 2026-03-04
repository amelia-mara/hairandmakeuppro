import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createHybridStorage } from '@/db/zustandStorage';
import { DEFAULT_CURRENCY, type CurrencyCode } from '@/types';

import { COSTUME_BUDGET_CATEGORIES, type CostumeBudgetCategory } from '@/config/department';

// Budget expense category types (HMU default)
export type HmuExpenseCategory = 'Kit Supplies' | 'Consumables' | 'Transportation' | 'Equipment' | 'Other';

// Combined type that supports both department modes
export type ExpenseCategory = HmuExpenseCategory | CostumeBudgetCategory;

export interface Receipt {
  id: string;
  date: string;
  vendor: string;
  amount: number;
  vat: number;
  category: ExpenseCategory;
  description: string;
  imageUri?: string;
  synced: boolean;
}

export interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  byCategory: Record<string, number>;
}

// HMU expense categories (default)
export const EXPENSE_CATEGORIES: HmuExpenseCategory[] = [
  'Kit Supplies',
  'Consumables',
  'Transportation',
  'Equipment',
  'Other',
];

// Costume expense categories (re-exported for convenience)
export const COSTUME_EXPENSE_CATEGORIES: readonly CostumeBudgetCategory[] = COSTUME_BUDGET_CATEGORIES;

// Get categories for a department
export function getExpenseCategoriesForDepartment(department: 'hmu' | 'costume' = 'hmu'): readonly string[] {
  return department === 'costume' ? COSTUME_BUDGET_CATEGORIES : EXPENSE_CATEGORIES;
}

interface BudgetState {
  // Data
  budgetTotal: number;
  floatReceived: number;
  receipts: Receipt[];
  currency: CurrencyCode;

  // Actions
  setBudgetTotal: (amount: number) => void;
  setFloatReceived: (amount: number) => void;
  setCurrency: (currency: CurrencyCode) => void;
  addReceipt: (receipt: Omit<Receipt, 'id' | 'synced'>) => void;
  updateReceipt: (id: string, updates: Partial<Receipt>) => void;
  deleteReceipt: (id: string) => void;
  clearBudget: () => void;

  // Computed
  getTotalSpent: () => number;
  getTotalVat: () => number;
  getRemaining: () => number;
  getPercentUsed: () => number;
  getByCategory: () => Record<string, number>;
  getBudgetSummary: () => BudgetSummary;
}

// Legacy localStorage key used by Budget.tsx before migration
const LEGACY_STORAGE_KEY = 'hairandmakeup_budget';

/**
 * Migrate legacy localStorage budget data to the new store format.
 * Called once during store initialization via the merge callback.
 */
function migrateLegacyData(): Partial<BudgetState> | null {
  try {
    const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyData) return null;

    const parsed = JSON.parse(legacyData);
    const migrated: Partial<BudgetState> = {};

    if (typeof parsed.budgetTotal === 'number') migrated.budgetTotal = parsed.budgetTotal;
    if (typeof parsed.floatReceived === 'number') migrated.floatReceived = parsed.floatReceived;
    if (parsed.currency) migrated.currency = parsed.currency;
    if (Array.isArray(parsed.receipts)) migrated.receipts = parsed.receipts;

    // Remove legacy data after successful migration
    localStorage.removeItem(LEGACY_STORAGE_KEY);

    return migrated;
  } catch (error) {
    console.error('Failed to migrate legacy budget data:', error);
    return null;
  }
}

export const useBudgetStore = create<BudgetState>()(
  persist(
    (set, get) => ({
      // Initial state
      budgetTotal: 0,
      floatReceived: 0,
      receipts: [],
      currency: DEFAULT_CURRENCY,

      // Actions
      setBudgetTotal: (amount) => set({ budgetTotal: amount }),

      setFloatReceived: (amount) => set({ floatReceived: amount }),

      setCurrency: (currency) => set({ currency }),

      addReceipt: (receipt) => {
        const newReceipt: Receipt = {
          ...receipt,
          id: `r-${Date.now()}`,
          synced: false,
        };
        set((state) => ({
          receipts: [newReceipt, ...state.receipts],
        }));
      },

      updateReceipt: (id, updates) => {
        set((state) => ({
          receipts: state.receipts.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }));
      },

      deleteReceipt: (id) => {
        set((state) => ({
          receipts: state.receipts.filter((r) => r.id !== id),
        }));
      },

      clearBudget: () => {
        set({
          budgetTotal: 0,
          floatReceived: 0,
          receipts: [],
          currency: DEFAULT_CURRENCY,
        });
      },

      // Computed
      getTotalSpent: () => get().receipts.reduce((sum, r) => sum + r.amount, 0),

      getTotalVat: () => get().receipts.reduce((sum, r) => sum + (r.vat || 0), 0),

      getRemaining: () => get().budgetTotal - get().getTotalSpent(),

      getPercentUsed: () => {
        const { budgetTotal } = get();
        return budgetTotal > 0 ? (get().getTotalSpent() / budgetTotal) * 100 : 0;
      },

      getByCategory: () => {
        const cats: Record<string, number> = {};
        // Initialize all known categories to 0
        EXPENSE_CATEGORIES.forEach(c => { cats[c] = 0; });
        COSTUME_BUDGET_CATEGORIES.forEach(c => { cats[c] = 0; });
        // Sum receipt amounts by category
        get().receipts.forEach((r) => {
          if (cats[r.category] !== undefined) {
            cats[r.category] += r.amount;
          } else {
            cats[r.category] = r.amount;
          }
        });
        return cats;
      },

      getBudgetSummary: () => ({
        totalBudget: get().budgetTotal,
        totalSpent: get().getTotalSpent(),
        byCategory: get().getByCategory(),
      }),
    }),
    {
      name: 'hair-makeup-budget',
      storage: createHybridStorage('hair-makeup-budget'),
      partialize: (state) => ({
        budgetTotal: state.budgetTotal,
        floatReceived: state.floatReceived,
        receipts: state.receipts,
        currency: state.currency,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<BudgetState> | null;

        // If no persisted state, try migrating from legacy localStorage
        if (!persisted || (!persisted.receipts && !persisted.budgetTotal)) {
          const legacy = migrateLegacyData();
          if (legacy) {
            return {
              ...currentState,
              ...legacy,
            } as BudgetState;
          }
        }

        return {
          ...currentState,
          ...(persisted || {}),
        } as BudgetState;
      },
    }
  )
);
