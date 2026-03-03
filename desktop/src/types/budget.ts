export interface BudgetCategory {
  id: string;
  name: string;
  order: number;
}

export interface BudgetEntry {
  id: string;
  categoryId: string;
  description: string;
  quantity: number;
  rate: number;
  total: number;
  notes?: string;
}

export interface BudgetTotals {
  byCategory: Record<string, number>;
  grandTotal: number;
}
