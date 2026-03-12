import { CURRENCY_SYMBOLS, type CurrencyCode, type BudgetCategory } from '@/stores/budgetStore';

interface CategorySpendBarsProps {
  categories: BudgetCategory[];
  perCategoryBudget: Record<string, number>;
  perCategorySpend: Record<string, number>;
  currency: CurrencyCode;
}

export function CategorySpendBars({ categories, perCategoryBudget, perCategorySpend, currency }: CategorySpendBarsProps) {
  const sym = CURRENCY_SYMBOLS[currency];

  // Only show categories that have a budget
  const activeCategories = categories.filter(c => (perCategoryBudget[c.id] || 0) > 0);

  if (activeCategories.length === 0) {
    return (
      <div>
        <div className="budget-section-label">CATEGORY BREAKDOWN</div>
        <div style={{ padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          No budget categories set up yet. Add items in the Budget Proposal tab.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="budget-section-label">CATEGORY BREAKDOWN</div>
      {activeCategories.map((cat, i) => {
        const budget = perCategoryBudget[cat.id] || 0;
        const spent = perCategorySpend[cat.id] || 0;
        const percent = budget > 0 ? (spent / budget) * 100 : 0;
        const isOver = percent >= 100;
        const isAtRisk = percent >= 75 && percent < 100;

        const barColor = isOver ? '#ef4444' : isAtRisk ? '#f59e0b' : 'var(--gold-primary)';

        return (
          <div
            key={cat.id}
            className="budget-category-row"
            style={{
              borderBottom: i < activeCategories.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {cat.name}
                </span>
                {isOver && (
                  <span className="budget-flag-badge budget-flag-over">OVER</span>
                )}
                {isAtRisk && (
                  <span className="budget-flag-badge budget-flag-risk">AT RISK</span>
                )}
              </div>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {sym}{spent.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="budget-progress-track">
              <div
                className="budget-progress-fill"
                style={{
                  width: `${Math.min(percent, 100)}%`,
                  backgroundColor: barColor,
                }}
              />
            </div>
            <div style={{
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
              marginTop: 4,
            }}>
              {percent.toFixed(0)}% of {sym}{budget.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
