import { CURRENCY_SYMBOLS, type CurrencyCode } from '@/stores/budgetStore';

interface StatCardsProps {
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  percentUsed: number;
  currency: CurrencyCode;
}

export function StatCards({ totalBudget, totalSpent, remaining, percentUsed, currency }: StatCardsProps) {
  const sym = CURRENCY_SYMBOLS[currency];

  const spentColor = percentUsed >= 100 ? '#ef4444' : percentUsed >= 75 ? '#f59e0b' : 'var(--text-primary)';
  const remainingColor = remaining < 0 ? '#ef4444' : percentUsed >= 75 ? '#f59e0b' : 'var(--gold-primary)';

  return (
    <div className="budget-stat-cards">
      <div className="budget-stat-card">
        <div className="budget-stat-label">Total Budget</div>
        <div className="budget-stat-value" style={{ color: 'var(--text-primary)' }}>
          {sym}{totalBudget.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
      <div className="budget-stat-card">
        <div className="budget-stat-label">Spent to Date</div>
        <div className="budget-stat-value" style={{ color: spentColor }}>
          {sym}{totalSpent.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
      <div className="budget-stat-card">
        <div className="budget-stat-label">Remaining</div>
        <div className="budget-stat-value" style={{ color: remainingColor }}>
          {remaining < 0 ? '-' : ''}{sym}{Math.abs(remaining).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
    </div>
  );
}
