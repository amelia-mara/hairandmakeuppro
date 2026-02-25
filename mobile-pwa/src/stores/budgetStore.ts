import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createHybridStorage } from '@/db/zustandStorage';
import { DEFAULT_CURRENCY, type CurrencyCode } from '@/types';

// Budget expense category types
export type ExpenseCategory = 'Kit Supplies' | 'Consumables' | 'Transportation' | 'Equipment' | 'Other';

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
  byCategory: Record<ExpenseCategory, number>;
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Kit Supplies',
  'Consumables',
  'Transportation',
  'Equipment',
  'Other',
];

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
  getByCategory: () => Record<ExpenseCategory, number>;
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
    console.log('Migrated legacy budget data from localStorage to IndexedDB store');

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
        const cats: Record<ExpenseCategory, number> = {
          'Kit Supplies': 0,
          'Consumables': 0,
          'Transportation': 0,
          'Equipment': 0,
          'Other': 0,
        };
        get().receipts.forEach((r) => {
          cats[r.category] += r.amount;
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
