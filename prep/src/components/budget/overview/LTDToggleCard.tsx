import { CURRENCY_SYMBOLS, type CurrencyCode } from '@/stores/budgetStore';

interface LTDToggleCardProps {
  isLTD: boolean;
  onToggle: (val: boolean) => void;
  wageImpact: number;
  currency: CurrencyCode;
}

export function LTDToggleCard({ isLTD, onToggle, wageImpact, currency }: LTDToggleCardProps) {
  const sym = CURRENCY_SYMBOLS[currency];

  return (
    <div className="budget-overview-card">
      <h3 className="budget-card-title"><span className="heading-italic">Employment</span> Settings</h3>

      <div className="budget-ltd-toggle-row">
        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
          Working as LTD Company
        </span>
        <button
          className={`budget-toggle ${isLTD ? 'active' : ''}`}
          onClick={() => onToggle(!isLTD)}
          role="switch"
          aria-checked={isLTD}
        >
          <span className="budget-toggle-thumb" />
        </button>
      </div>

      <div style={{
        fontSize: '0.8125rem',
        color: 'var(--text-muted)',
        marginTop: 4,
      }}>
        {isLTD ? 'Wages billed separately' : 'Wages affect budget'}
      </div>

      {!isLTD && wageImpact > 0 && (
        <div className="budget-impact-warning">
          Your wages are currently reducing your available budget by {sym}{wageImpact.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      )}

      {isLTD && (
        <div className="budget-impact-success">
          LTD mode: wages billed separately and do not affect your department budget
        </div>
      )}
    </div>
  );
}
