import { CURRENCY_SYMBOLS, type CurrencyCode, type BudgetCategory } from '@/stores/budgetStore';

interface BudgetSummarySidebarProps {
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  percentUsed: number;
  categories: BudgetCategory[];
  perCategoryBudget: Record<string, number>;
  perCategorySpend: Record<string, number>;
  currency: CurrencyCode;
  isLTD: boolean;
  totalCrewCost: number;
  hasTimesheetData: boolean;
  onAddExpense: () => void;
  onUploadReceipt: () => void;
}

export function BudgetSummarySidebar({
  totalBudget,
  totalSpent,
  remaining,
  percentUsed,
  categories,
  perCategoryBudget,
  perCategorySpend,
  currency,
  isLTD,
  totalCrewCost,
  hasTimesheetData,
  onAddExpense,
  onUploadReceipt,
}: BudgetSummarySidebarProps) {
  const sym = CURRENCY_SYMBOLS[currency];

  // Colour states: healthy (gold), at risk (amber), over budget (red)
  const remainingColor = percentUsed >= 100 ? '#ef4444' : percentUsed >= 75 ? '#f59e0b' : 'var(--gold-primary)';
  const progressFill = percentUsed >= 100 ? '#ef4444' : percentUsed >= 75 ? '#f59e0b' : 'var(--gold-primary)';

  // Over-budget categories
  const overBudgetCategories = categories
    .filter(cat => {
      const budgeted = perCategoryBudget[cat.id] || 0;
      const spent = perCategorySpend[cat.id] || 0;
      return budgeted > 0 && spent > budgeted;
    })
    .map(cat => ({
      name: cat.name,
      overBy: (perCategorySpend[cat.id] || 0) - (perCategoryBudget[cat.id] || 0),
    }));

  const formatAmount = (n: number) =>
    n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <aside className="budget-summary-sidebar">
      {/* Section 1: Remaining Budget */}
      <div className="budget-sidebar-section">
        <div className="budget-sidebar-label">REMAINING</div>
        <div className="budget-sidebar-value" style={{ color: remainingColor }}>
          {remaining < 0 ? '-' : ''}{sym}{formatAmount(Math.abs(remaining))}
        </div>
        <div className="budget-sidebar-fraction">
          {sym}{formatAmount(totalSpent)} spent of {sym}{formatAmount(totalBudget)}
        </div>
        <div className="budget-sidebar-progress-track">
          <div
            className="budget-sidebar-progress-fill"
            style={{
              width: `${Math.min(percentUsed, 100)}%`,
              background: progressFill,
            }}
          />
        </div>
      </div>

      {/* Section 2: Over-Budget Flags */}
      {overBudgetCategories.length > 0 && (
        <div className="budget-sidebar-section">
          <div className="budget-sidebar-label" style={{ color: '#ef4444' }}>OVER BUDGET</div>
          {overBudgetCategories.map(cat => (
            <div key={cat.name} className="budget-sidebar-flag-row">
              <span className="budget-sidebar-flag-name">{cat.name}</span>
              <span className="budget-sidebar-flag-amount">+{sym}{formatAmount(cat.overBy)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Section 3: Crew Cost Impact */}
      <div className="budget-sidebar-section">
        <div className="budget-sidebar-label">CREW COSTS</div>
        {hasTimesheetData ? (
          <>
            <div className="budget-sidebar-crew-value">
              {sym}{formatAmount(totalCrewCost)}
            </div>
            <div className="budget-sidebar-ltd-indicator">
              {isLTD ? (
                <>
                  <span className="budget-sidebar-indicator-dot budget-sidebar-indicator-dot--positive" />
                  <span className="budget-sidebar-indicator-text">LTD: not affecting budget</span>
                </>
              ) : (
                <>
                  <span className="budget-sidebar-indicator-dot budget-sidebar-indicator-dot--warning" />
                  <span className="budget-sidebar-indicator-text">PAYE: reducing budget</span>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="budget-sidebar-empty">No crew data yet</div>
        )}
      </div>

      {/* Section 4: Quick Actions */}
      <div className="budget-sidebar-section">
        <div className="budget-sidebar-label">QUICK ACTIONS</div>
        <button className="budget-sidebar-action-btn" onClick={onAddExpense}>
          <PlusCircleIcon />
          <span>Add Expense</span>
        </button>
        <button className="budget-sidebar-action-btn" onClick={onUploadReceipt}>
          <UploadIcon />
          <span>Upload Receipt</span>
        </button>
      </div>
    </aside>
  );
}

function PlusCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
