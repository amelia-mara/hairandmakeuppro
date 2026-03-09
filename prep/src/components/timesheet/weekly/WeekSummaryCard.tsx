import { CURRENCY_SYMBOLS, type WeekSummary, type CurrencyCode } from '@/stores/timesheetStore';

interface WeekSummaryCardProps {
  summary: WeekSummary;
  currency: CurrencyCode;
  crewName: string;
}

export function WeekSummaryCard({ summary, currency, crewName }: WeekSummaryCardProps) {
  const sym = CURRENCY_SYMBOLS[currency];
  const fmt = (n: number) => sym + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="ts-week-summary">
      <div className="ts-week-summary-header">
        <h3 className="ts-card-title">Week Summary — {crewName}</h3>
      </div>
      <div className="ts-week-summary-body">
        <div className="ts-summary-grid">
          <div className="ts-summary-item">
            <span className="ts-summary-label">Days Worked</span>
            <span className="ts-summary-value">{summary.entries.length}</span>
          </div>
          <div className="ts-summary-item">
            <span className="ts-summary-label">Total Hours</span>
            <span className="ts-summary-value">{summary.totalHours}h</span>
          </div>
          <div className="ts-summary-item">
            <span className="ts-summary-label">OT Hours</span>
            <span className="ts-summary-value">{summary.otHours}h</span>
          </div>
          <div className="ts-summary-item">
            <span className="ts-summary-label">Total Earnings</span>
            <span className="ts-summary-value ts-summary-total">{fmt(summary.totalEarnings)}</span>
          </div>
        </div>

        <div className="ts-summary-breakdown">
          <div className="ts-summary-break-row">
            <span>Base Pay</span>
            <span>{fmt(summary.basePay)}</span>
          </div>
          {summary.preCallPay > 0 && (
            <div className="ts-summary-break-row">
              <span>Pre-Call Pay</span>
              <span>{fmt(summary.preCallPay)}</span>
            </div>
          )}
          {summary.overtimePay > 0 && (
            <div className="ts-summary-break-row">
              <span>Overtime Pay</span>
              <span>{fmt(summary.overtimePay)}</span>
            </div>
          )}
          {summary.lateNightPay > 0 && (
            <div className="ts-summary-break-row">
              <span>Late Night Pay</span>
              <span>{fmt(summary.lateNightPay)}</span>
            </div>
          )}
          {summary.brokenLunchPay > 0 && (
            <div className="ts-summary-break-row">
              <span>Broken Lunch Pay</span>
              <span>{fmt(summary.brokenLunchPay)}</span>
            </div>
          )}
          {summary.brokenTurnaroundPay > 0 && (
            <div className="ts-summary-break-row">
              <span>Broken Turnaround Pay</span>
              <span>{fmt(summary.brokenTurnaroundPay)}</span>
            </div>
          )}
          {summary.kitRentalTotal > 0 && (
            <div className="ts-summary-break-row">
              <span>Kit Rental</span>
              <span>{fmt(summary.kitRentalTotal)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
