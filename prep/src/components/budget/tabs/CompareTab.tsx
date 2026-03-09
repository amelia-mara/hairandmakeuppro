import { CompareTable } from '../compare/CompareTable';
import { VarianceAnalysis } from '../compare/VarianceAnalysis';
import type { BudgetCategory, CurrencyCode } from '@/stores/budgetStore';

interface CompareTabProps {
  categories: BudgetCategory[];
  perCategoryBudget: Record<string, number>;
  perCategorySpend: Record<string, number>;
  totalBudget: number;
  totalSpent: number;
  currency: CurrencyCode;
}

export function CompareTab({
  categories,
  perCategoryBudget,
  perCategorySpend,
  totalBudget,
  totalSpent,
  currency,
}: CompareTabProps) {
  return (
    <div className="budget-compare">
      <CompareTable
        categories={categories}
        perCategoryBudget={perCategoryBudget}
        perCategorySpend={perCategorySpend}
        totalBudget={totalBudget}
        totalSpent={totalSpent}
        currency={currency}
      />
      <VarianceAnalysis
        categories={categories}
        perCategoryBudget={perCategoryBudget}
        perCategorySpend={perCategorySpend}
        totalBudget={totalBudget}
        totalSpent={totalSpent}
        currency={currency}
      />
    </div>
  );
}
