import { CURRENCY_SYMBOLS, type CurrencyCode } from '@/stores/budgetStore';

interface CrewCostCardProps {
  currency: CurrencyCode;
  totalCrewCost: number;
  hasTimesheetData: boolean;
  onGoToTimesheets: () => void;
}

export function CrewCostCard({ currency, totalCrewCost, hasTimesheetData, onGoToTimesheets }: CrewCostCardProps) {
  const sym = CURRENCY_SYMBOLS[currency];

  return (
    <div className="budget-overview-card">
      <h3 className="budget-card-title">Crew Costs</h3>
      <p className="budget-card-subtitle">Pulled from Timesheet</p>

      {hasTimesheetData ? (
        <div style={{ marginTop: 16 }}>
          <div className="budget-card-row">
            <span>Total Crew Cost</span>
            <span style={{ fontWeight: 600 }}>
              {sym}{totalCrewCost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="budget-card-row">
            <span>Budget Impact</span>
            <span style={{ fontWeight: 600, color: '#f59e0b' }}>
              -{sym}{totalCrewCost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 16, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          <p>No timesheet data yet</p>
          <button
            className="budget-link-btn"
            onClick={onGoToTimesheets}
            style={{ marginTop: 8 }}
          >
            Go to Timesheets
          </button>
        </div>
      )}
    </div>
  );
}
