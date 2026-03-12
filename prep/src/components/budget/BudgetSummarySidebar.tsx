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
  onToggleLTD: (val: boolean) => void;
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
  onToggleLTD,
  onAddExpense,
  onUploadReceipt,
}: BudgetSummarySidebarProps) {
  const sym = CURRENCY_SYMBOLS[currency];

  // Colour states
  const remainingColor = percentUsed >= 100 ? '#ef4444' : percentUsed >= 75 ? '#f59e0b' : 'var(--gold-primary)';
  const spentColor = percentUsed >= 100 ? '#ef4444' : percentUsed >= 75 ? '#f59e0b' : 'var(--text-primary)';
  const progressFill = percentUsed >= 100 ? '#ef4444' : percentUsed >= 75 ? '#f59e0b' : 'var(--gold-primary)';

  const formatAmount = (n: number) =>
    n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Categories with a budget set
  const activeCategories = categories.filter(c => (perCategoryBudget[c.id] || 0) > 0);

  return (
    <aside className="budget-summary-sidebar">
      {/* Section 1: Key Stats */}
      <div className="budget-sidebar-section">
        <div className="budget-sidebar-stat-row">
          <span className="budget-sidebar-stat-label">Total Budget</span>
          <span className="budget-sidebar-stat-value">{sym}{formatAmount(totalBudget)}</span>
        </div>
        <div className="budget-sidebar-stat-row">
          <span className="budget-sidebar-stat-label">Spent to Date</span>
          <span className="budget-sidebar-stat-value" style={{ color: spentColor }}>{sym}{formatAmount(totalSpent)}</span>
        </div>
        <div className="budget-sidebar-stat-row">
          <span className="budget-sidebar-stat-label">Remaining</span>
          <span className="budget-sidebar-stat-value" style={{ color: remainingColor }}>
            {remaining < 0 ? '-' : ''}{sym}{formatAmount(Math.abs(remaining))}
          </span>
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

      {/* Section 2: Category Breakdown */}
      <div className="budget-sidebar-section">
        <div className="budget-sidebar-label">CATEGORY BREAKDOWN</div>
        {activeCategories.length === 0 ? (
          <div className="budget-sidebar-empty">
            No categories yet. Add items in the Budget Proposal tab.
          </div>
        ) : (
          activeCategories.map(cat => {
            const budget = perCategoryBudget[cat.id] || 0;
            const spent = perCategorySpend[cat.id] || 0;
            const percent = budget > 0 ? (spent / budget) * 100 : 0;
            const isOver = percent >= 100;
            const isAtRisk = percent >= 75 && percent < 100;
            const barColor = isOver ? '#ef4444' : isAtRisk ? '#f59e0b' : 'var(--gold-primary)';

            return (
              <div key={cat.id} className="budget-sidebar-category">
                <div className="budget-sidebar-category-header">
                  <span className="budget-sidebar-category-name">
                    {cat.name}
                    {isOver && <span className="budget-sidebar-cat-badge budget-sidebar-cat-badge--over">OVER</span>}
                    {isAtRisk && <span className="budget-sidebar-cat-badge budget-sidebar-cat-badge--risk">AT RISK</span>}
                  </span>
                  <span className="budget-sidebar-category-amount">{sym}{formatAmount(spent)}</span>
                </div>
                <div className="budget-sidebar-progress-track">
                  <div
                    className="budget-sidebar-progress-fill"
                    style={{ width: `${Math.min(percent, 100)}%`, background: barColor }}
                  />
                </div>
                <div className="budget-sidebar-category-meta">
                  {percent.toFixed(0)}% of {sym}{formatAmount(budget)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Section 3: Crew Costs */}
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

      {/* Section 4: Employment Settings */}
      <div className="budget-sidebar-section">
        <div className="budget-sidebar-label">EMPLOYMENT</div>
        <div className="budget-sidebar-ltd-row">
          <span className="budget-sidebar-ltd-text">LTD Company</span>
          <button
            className={`budget-sidebar-toggle ${isLTD ? 'active' : ''}`}
            onClick={() => onToggleLTD(!isLTD)}
            role="switch"
            aria-checked={isLTD}
          >
            <span className="budget-sidebar-toggle-thumb" />
          </button>
        </div>
        <div className="budget-sidebar-ltd-hint">
          {isLTD ? 'Wages billed separately' : 'Wages affect budget'}
        </div>
      </div>

      {/* Section 5: Quick Actions */}
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
