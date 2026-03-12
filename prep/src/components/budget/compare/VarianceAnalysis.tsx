import { CURRENCY_SYMBOLS, type BudgetCategory, type CurrencyCode } from '@/stores/budgetStore';

interface VarianceAnalysisProps {
  categories: BudgetCategory[];
  perCategoryBudget: Record<string, number>;
  perCategorySpend: Record<string, number>;
  totalBudget: number;
  totalSpent: number;
  currency: CurrencyCode;
}

export function VarianceAnalysis({
  categories,
  perCategoryBudget,
  perCategorySpend,
  totalBudget,
  totalSpent,
  currency,
}: VarianceAnalysisProps) {
  const sym = CURRENCY_SYMBOLS[currency];
  const fmt = (n: number) => sym + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const overBudget = categories.filter(c => {
    const b = perCategoryBudget[c.id] || 0;
    const s = perCategorySpend[c.id] || 0;
    return b > 0 && s > b;
  });

  const atRisk = categories.filter(c => {
    const b = perCategoryBudget[c.id] || 0;
    const s = perCategorySpend[c.id] || 0;
    return b > 0 && s >= b * 0.75 && s <= b;
  });

  const underBudget = categories.filter(c => {
    const b = perCategoryBudget[c.id] || 0;
    const s = perCategorySpend[c.id] || 0;
    return b > 0 && s < b * 0.75;
  });

  const remaining = totalBudget - totalSpent;

  return (
    <div className="budget-compare-section" style={{ marginTop: 24 }}>
      <div className="budget-compare-header">
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}><span className="heading-italic">Variance</span> Analysis</h3>
      </div>
      <div style={{ padding: 24 }}>
        {totalBudget === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No budget data to analyse. Add items in the Budget Proposal tab.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="budget-analysis-card" style={{
              background: remaining >= 0 ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
              border: `1px solid ${remaining >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
            }}>
              <span style={{ fontWeight: 600, color: remaining >= 0 ? '#22c55e' : '#ef4444' }}>
                {remaining >= 0 ? 'Under budget' : 'Over budget'} by {fmt(Math.abs(remaining))}
              </span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {((totalSpent / totalBudget) * 100).toFixed(1)}% of total budget used
              </span>
            </div>

            {overBudget.length > 0 && (
              <div>
                <div className="budget-section-label" style={{ color: '#ef4444' }}>OVER BUDGET ({overBudget.length})</div>
                {overBudget.map(c => (
                  <div key={c.id} style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', padding: '4px 0' }}>
                    {c.name}: {fmt(perCategorySpend[c.id] || 0)} spent of {fmt(perCategoryBudget[c.id] || 0)} budgeted
                  </div>
                ))}
              </div>
            )}

            {atRisk.length > 0 && (
              <div>
                <div className="budget-section-label" style={{ color: '#f59e0b' }}>AT RISK ({atRisk.length})</div>
                {atRisk.map(c => (
                  <div key={c.id} style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', padding: '4px 0' }}>
                    {c.name}: {fmt(perCategorySpend[c.id] || 0)} spent of {fmt(perCategoryBudget[c.id] || 0)} budgeted
                  </div>
                ))}
              </div>
            )}

            {underBudget.length > 0 && (
              <div>
                <div className="budget-section-label" style={{ color: '#22c55e' }}>ON TRACK ({underBudget.length})</div>
                {underBudget.map(c => (
                  <div key={c.id} style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', padding: '4px 0' }}>
                    {c.name}: {fmt(perCategorySpend[c.id] || 0)} spent of {fmt(perCategoryBudget[c.id] || 0)} budgeted
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
