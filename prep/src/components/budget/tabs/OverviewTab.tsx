import { StatCards } from '../overview/StatCards';
import { CategorySpendBars } from '../overview/CategorySpendBars';
import { CrewCostCard } from '../overview/CrewCostCard';
import { LTDToggleCard } from '../overview/LTDToggleCard';
import type { BudgetCategory, CurrencyCode } from '@/stores/budgetStore';

interface OverviewTabProps {
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  percentUsed: number;
  categories: BudgetCategory[];
  perCategoryBudget: Record<string, number>;
  perCategorySpend: Record<string, number>;
  isLTD: boolean;
  onToggleLTD: (val: boolean) => void;
  currency: CurrencyCode;
}

export function OverviewTab({
  totalBudget,
  totalSpent,
  remaining,
  percentUsed,
  categories,
  perCategoryBudget,
  perCategorySpend,
  isLTD,
  onToggleLTD,
  currency,
}: OverviewTabProps) {
  return (
    <div className="budget-overview">
      <StatCards
        totalBudget={totalBudget}
        totalSpent={totalSpent}
        remaining={remaining}
        percentUsed={percentUsed}
        currency={currency}
      />

      <div className="budget-overview-columns">
        <div className="budget-overview-left">
          <CategorySpendBars
            categories={categories}
            perCategoryBudget={perCategoryBudget}
            perCategorySpend={perCategorySpend}
            currency={currency}
          />
        </div>

        <div className="budget-overview-right">
          <CrewCostCard
            currency={currency}
            totalCrewCost={0}
            hasTimesheetData={false}
            onGoToTimesheets={() => {}}
          />
          <LTDToggleCard
            isLTD={isLTD}
            onToggle={onToggleLTD}
            wageImpact={0}
            currency={currency}
          />
        </div>
      </div>
    </div>
  );
}
