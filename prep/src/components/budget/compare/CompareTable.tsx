import { CURRENCY_SYMBOLS, type BudgetCategory, type CurrencyCode } from '@/stores/budgetStore';

interface CompareTableProps {
  categories: BudgetCategory[];
  perCategoryBudget: Record<string, number>;
  perCategorySpend: Record<string, number>;
  totalBudget: number;
  totalSpent: number;
  currency: CurrencyCode;
}

export function CompareTable({
  categories,
  perCategoryBudget,
  perCategorySpend,
  totalBudget,
  totalSpent,
  currency,
}: CompareTableProps) {
  const sym = CURRENCY_SYMBOLS[currency];

  const fmt = (n: number) => sym + Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalVariance = totalBudget - totalSpent;
  const totalVariancePct = totalBudget > 0 ? ((totalVariance / totalBudget) * 100) : 0;

  return (
    <div className="budget-compare-section">
      <div className="budget-compare-header">
        <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 12 }}>
          Budget vs Actual Comparison
        </h3>
        <button className="btn-ghost budget-btn-sm">Export Report</button>
      </div>

      <table className="budget-compare-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Budgeted</th>
            <th>Actual Spent</th>
            <th>Variance ({sym})</th>
            <th>Variance (%)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {categories.map(cat => {
            const budgeted = perCategoryBudget[cat.id] || 0;
            const spent = perCategorySpend[cat.id] || 0;
            const variance = budgeted - spent;
            const variancePct = budgeted > 0 ? ((variance / budgeted) * 100) : 0;
            const status = spent > budgeted ? 'over' : spent >= budgeted * 0.75 ? 'risk' : 'ok';

            if (budgeted === 0 && spent === 0) return null;

            return (
              <tr key={cat.id}>
                <td style={{ fontWeight: 500 }}>{cat.name}</td>
                <td>{fmt(budgeted)}</td>
                <td>{fmt(spent)}</td>
                <td>
                  <span className={`budget-variance ${variance < 0 ? 'negative' : variance > 0 ? 'positive' : 'neutral'}`}>
                    {variance < 0 ? '-' : '+'}{fmt(Math.abs(variance))}
                  </span>
                </td>
                <td>
                  <span className={`budget-variance ${variance < 0 ? 'negative' : variance > 0 ? 'positive' : 'neutral'}`}>
                    {variancePct.toFixed(1)}%
                  </span>
                </td>
                <td>
                  <span className={`budget-status-badge budget-status-${status}`}>
                    {status === 'over' ? 'Over Budget' : status === 'risk' ? 'At Risk' : 'On Track'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="budget-compare-total-row">
            <td style={{ fontWeight: 600 }}>TOTAL</td>
            <td>{fmt(totalBudget)}</td>
            <td>{fmt(totalSpent)}</td>
            <td>
              <span className={`budget-variance ${totalVariance < 0 ? 'negative' : 'positive'}`}>
                {totalVariance < 0 ? '-' : '+'}{fmt(Math.abs(totalVariance))}
              </span>
            </td>
            <td>
              <span className={`budget-variance ${totalVariance < 0 ? 'negative' : 'positive'}`}>
                {totalVariancePct.toFixed(1)}%
              </span>
            </td>
            <td>
              <span className={`budget-status-badge budget-status-${totalSpent > totalBudget ? 'over' : 'ok'}`}>
                {totalSpent > totalBudget ? 'Over Budget' : 'On Track'}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
