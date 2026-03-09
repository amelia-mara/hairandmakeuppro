import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types — aligned with mobile budgetStore for future Supabase sync
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ProjectInfo {
  name: string;
  code: string;
  designer: string;
  type: string;
  duration: string;
  budgetLimit: number;
}

export interface BudgetLineItem {
  id: string;
  description: string;
  qty: number;
  price: number;
  markup: number;
  supplier: string;
  notes: string;
}

export interface BudgetCategory {
  id: string;
  name: string;
  items: BudgetLineItem[];
}

export interface Receipt {
  id: string;
  date: string;
  vendor: string;
  amount: number;
  vat: number;
  category: string;
  description: string;
  imageUri?: string;
  synced: boolean;
}

export interface Expense {
  id: string;
  date: string;
  supplier: string;
  category: string;
  lineItemId?: string;
  vat: string;
  amount: number;
  receiptId?: string;
  receiptImageUri?: string;
}

export type CurrencyCode = 'GBP' | 'USD' | 'EUR' | 'CAD' | 'AUD';

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  CAD: 'C$',
  AUD: 'A$',
};

export const DEFAULT_CATEGORIES: BudgetCategory[] = [
  { id: 'disposables', name: 'Disposables', items: [] },
  { id: 'hygiene', name: 'Hygiene', items: [] },
  { id: 'makeup', name: 'Makeup', items: [] },
  { id: 'hair', name: 'Hair', items: [] },
  { id: 'prosthetics', name: 'Prosthetics', items: [] },
  { id: 'mouldmaking', name: 'Mould Making', items: [] },
  { id: 'sfxmakeup', name: 'SFX Makeup', items: [] },
  { id: 'accessories', name: 'Accessories', items: [] },
  { id: 'actoressentials', name: 'Actor Essentials', items: [] },
  { id: 'departmentsupplies', name: 'Department Supplies', items: [] },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Store interface
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface BudgetState {
  // Data — matches mobile data shape for sync compatibility
  projectInfo: ProjectInfo;
  categories: BudgetCategory[];
  expenses: Expense[];
  receipts: Receipt[];
  isLTD: boolean;
  currency: CurrencyCode;
  lastSaved: string | null;

  // Actions — aligned with mobile naming conventions
  setProjectInfo: (info: Partial<ProjectInfo>) => void;
  setBudgetLimit: (amount: number) => void;
  setCurrency: (currency: CurrencyCode) => void;
  setIsLTD: (isLTD: boolean) => void;

  // Category actions
  addCategory: (name: string) => void;
  removeCategory: (id: string) => void;
  renameCategory: (id: string, name: string) => void;

  // Line item actions
  addLineItem: (categoryId: string) => void;
  updateLineItem: (categoryId: string, itemId: string, updates: Partial<BudgetLineItem>) => void;
  removeLineItem: (categoryId: string, itemId: string) => void;
  copyLineItem: (fromCategoryId: string, itemId: string, toCategoryId: string) => void;

  // Expense actions
  addExpense: (expense: Omit<Expense, 'id'>) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;

  // Receipt actions
  addReceipt: (receipt: Omit<Receipt, 'id' | 'synced'>) => void;
  updateReceipt: (id: string, updates: Partial<Receipt>) => void;
  deleteReceipt: (id: string) => void;

  // Computed getters
  getTotalBudget: () => number;
  getTotalSpent: () => number;
  getRemaining: () => number;
  getBudgetUsedPercent: () => number;
  getPerCategoryBudget: () => Record<string, number>;
  getPerCategorySpend: () => Record<string, number>;
  getOverBudgetCategories: () => string[];
  getCategoryById: (id: string) => BudgetCategory | undefined;
  getLineItemTotal: (item: BudgetLineItem) => number;

  // Clear
  clearBudget: () => void;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Auto-save debounce
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let _saveTimer: ReturnType<typeof setTimeout> | null = null;
let _saveStatus: 'idle' | 'saving' | 'saved' = 'idle';
let _saveListeners: Set<(status: 'idle' | 'saving' | 'saved') => void> = new Set();

export function onSaveStatusChange(listener: (status: 'idle' | 'saving' | 'saved') => void) {
  _saveListeners.add(listener);
  return () => { _saveListeners.delete(listener); };
}

export function getSaveStatus() { return _saveStatus; }

function setSaveStatus(status: 'idle' | 'saving' | 'saved') {
  _saveStatus = status;
  _saveListeners.forEach(fn => fn(status));
}

function triggerAutoSave() {
  if (_saveTimer) clearTimeout(_saveTimer);
  setSaveStatus('saving');
  _saveTimer = setTimeout(() => {
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, 800);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Store factory — per-project store via key
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const storeCache: Record<string, ReturnType<typeof createBudgetStore>> = {};

function createBudgetStore(projectId: string) {
  return create<BudgetState>()(
    persist(
      (set, get) => ({
        // Initial state
        projectInfo: {
          name: '',
          code: '',
          designer: '',
          type: '',
          duration: '',
          budgetLimit: 0,
        },
        categories: DEFAULT_CATEGORIES.map(c => ({ ...c, items: [] })),
        expenses: [],
        receipts: [],
        isLTD: false,
        currency: 'GBP' as CurrencyCode,
        lastSaved: null,

        // ── Project info ──────────────────────────────
        setProjectInfo: (info) => {
          set((s) => ({ projectInfo: { ...s.projectInfo, ...info }, lastSaved: new Date().toISOString() }));
          triggerAutoSave();
        },
        setBudgetLimit: (amount) => {
          set((s) => ({ projectInfo: { ...s.projectInfo, budgetLimit: amount }, lastSaved: new Date().toISOString() }));
          triggerAutoSave();
        },
        setCurrency: (currency) => {
          set({ currency, lastSaved: new Date().toISOString() });
          triggerAutoSave();
        },
        setIsLTD: (isLTD) => {
          set({ isLTD, lastSaved: new Date().toISOString() });
          triggerAutoSave();
        },

        // ── Category actions ──────────────────────────
        addCategory: (name) => {
          const id = `cat-${Date.now()}`;
          set((s) => ({
            categories: [...s.categories, { id, name, items: [] }],
            lastSaved: new Date().toISOString(),
          }));
          triggerAutoSave();
        },
        removeCategory: (id) => {
          set((s) => ({
            categories: s.categories.filter(c => c.id !== id),
            lastSaved: new Date().toISOString(),
          }));
          triggerAutoSave();
        },
        renameCategory: (id, name) => {
          set((s) => ({
            categories: s.categories.map(c => c.id === id ? { ...c, name } : c),
            lastSaved: new Date().toISOString(),
          }));
          triggerAutoSave();
        },

        // ── Line item actions ─────────────────────────
        addLineItem: (categoryId) => {
          const newItem: BudgetLineItem = {
            id: `li-${Date.now()}`,
            description: '',
            qty: 1,
            price: 0,
            markup: 0,
            supplier: '',
            notes: '',
          };
          set((s) => ({
            categories: s.categories.map(c =>
              c.id === categoryId ? { ...c, items: [...c.items, newItem] } : c
            ),
            lastSaved: new Date().toISOString(),
          }));
          triggerAutoSave();
        },
        updateLineItem: (categoryId, itemId, updates) => {
          set((s) => ({
            categories: s.categories.map(c =>
              c.id === categoryId
                ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, ...updates } : i) }
                : c
            ),
            lastSaved: new Date().toISOString(),
          }));
          triggerAutoSave();
        },
        removeLineItem: (categoryId, itemId) => {
          set((s) => ({
            categories: s.categories.map(c =>
              c.id === categoryId
                ? { ...c, items: c.items.filter(i => i.id !== itemId) }
                : c
            ),
            lastSaved: new Date().toISOString(),
          }));
          triggerAutoSave();
        },
        copyLineItem: (fromCategoryId, itemId, toCategoryId) => {
          const state = get();
          const fromCat = state.categories.find(c => c.id === fromCategoryId);
          const item = fromCat?.items.find(i => i.id === itemId);
          if (!item) return;
          const copy: BudgetLineItem = { ...item, id: `li-${Date.now()}` };
          set((s) => ({
            categories: s.categories.map(c =>
              c.id === toCategoryId ? { ...c, items: [...c.items, copy] } : c
            ),
            lastSaved: new Date().toISOString(),
          }));
          triggerAutoSave();
        },

        // ── Expense actions ───────────────────────────
        addExpense: (expense) => {
          const newExpense: Expense = { ...expense, id: `exp-${Date.now()}` };
          set((s) => ({
            expenses: [newExpense, ...s.expenses],
            lastSaved: new Date().toISOString(),
          }));
          triggerAutoSave();
        },
        updateExpense: (id, updates) => {
          set((s) => ({
            expenses: s.expenses.map(e => e.id === id ? { ...e, ...updates } : e),
            lastSaved: new Date().toISOString(),
          }));
          triggerAutoSave();
        },
        deleteExpense: (id) => {
          set((s) => ({
            expenses: s.expenses.filter(e => e.id !== id),
            lastSaved: new Date().toISOString(),
          }));
          triggerAutoSave();
        },

        // ── Receipt actions ───────────────────────────
        addReceipt: (receipt) => {
          const newReceipt: Receipt = { ...receipt, id: `r-${Date.now()}`, synced: false };
          set((s) => ({
            receipts: [newReceipt, ...s.receipts],
            lastSaved: new Date().toISOString(),
          }));
          triggerAutoSave();
        },
        updateReceipt: (id, updates) => {
          set((s) => ({
            receipts: s.receipts.map(r => r.id === id ? { ...r, ...updates } : r),
            lastSaved: new Date().toISOString(),
          }));
          triggerAutoSave();
        },
        deleteReceipt: (id) => {
          set((s) => ({
            receipts: s.receipts.filter(r => r.id !== id),
            lastSaved: new Date().toISOString(),
          }));
          triggerAutoSave();
        },

        // ── Computed getters ──────────────────────────
        getLineItemTotal: (item) => {
          const base = (item.qty || 0) * (item.price || 0);
          return base + base * ((item.markup || 0) / 100);
        },
        getTotalBudget: () => {
          const state = get();
          return state.categories.reduce((sum, cat) =>
            sum + cat.items.reduce((s, item) => {
              const base = (item.qty || 0) * (item.price || 0);
              return s + base + base * ((item.markup || 0) / 100);
            }, 0),
          0);
        },
        getTotalSpent: () => get().expenses.reduce((sum, e) => sum + e.amount, 0),
        getRemaining: () => get().getTotalBudget() - get().getTotalSpent(),
        getBudgetUsedPercent: () => {
          const total = get().getTotalBudget();
          return total > 0 ? (get().getTotalSpent() / total) * 100 : 0;
        },
        getPerCategoryBudget: () => {
          const result: Record<string, number> = {};
          get().categories.forEach(cat => {
            result[cat.id] = cat.items.reduce((s, item) => {
              const base = (item.qty || 0) * (item.price || 0);
              return s + base + base * ((item.markup || 0) / 100);
            }, 0);
          });
          return result;
        },
        getPerCategorySpend: () => {
          const result: Record<string, number> = {};
          get().categories.forEach(cat => { result[cat.id] = 0; });
          get().expenses.forEach(e => {
            if (result[e.category] !== undefined) {
              result[e.category] += e.amount;
            }
          });
          return result;
        },
        getOverBudgetCategories: () => {
          const budgets = get().getPerCategoryBudget();
          const spends = get().getPerCategorySpend();
          return Object.keys(budgets).filter(id => budgets[id] > 0 && spends[id] > budgets[id]);
        },
        getCategoryById: (id) => get().categories.find(c => c.id === id),

        // ── Clear ─────────────────────────────────────
        clearBudget: () => {
          set({
            categories: DEFAULT_CATEGORIES.map(c => ({ ...c, items: [] })),
            expenses: [],
            receipts: [],
            lastSaved: new Date().toISOString(),
          });
          triggerAutoSave();
        },
      }),
      {
        name: `prep-happy-budget-${projectId}`,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          projectInfo: state.projectInfo,
          categories: state.categories,
          expenses: state.expenses,
          receipts: state.receipts,
          isLTD: state.isLTD,
          currency: state.currency,
          lastSaved: state.lastSaved,
        }),
      }
    )
  );
}

export function useBudgetStore(projectId: string) {
  if (!storeCache[projectId]) {
    storeCache[projectId] = createBudgetStore(projectId);
  }
  return storeCache[projectId];
}
