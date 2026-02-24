import type { WeekSummary } from '@/types';
import { useTimesheetStore } from '@/stores/timesheetStore';

interface SummaryCardProps {
  summary: WeekSummary;
}

export function SummaryCard({ summary }: SummaryCardProps) {
  const { rateCard } = useTimesheetStore();
  const hasData = summary.entries.length > 0;

  if (!hasData) {
    return (
      <div className="card text-center py-8">
        <svg
          className="w-12 h-12 mx-auto mb-3"
          style={{ color: 'var(--color-text-placeholder)' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No entries this week</p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-placeholder)' }}>Tap a day to log your hours</p>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Compact 4-column summary grid */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <SummaryItem
          label="Days"
          value={summary.entries.length.toString()}
        />
        <SummaryItem
          label="Base Hrs"
          value={summary.baseHours.toFixed(0)}
        />
        <SummaryItem
          label="Pre-Call"
          value={summary.preCallHours.toFixed(1)}
          subtext={`@ ${rateCard.preCallMultiplier}x`}
        />
        <SummaryItem
          label="Overtime"
          value={summary.otHours.toFixed(1)}
          subtext={`@ ${rateCard.otMultiplier}x`}
          highlight
        />
      </div>

      {/* Additional breakdown for 6th/7th day and late night if present */}
      {(summary.sixthDayHours > 0 || summary.seventhDayHours > 0 || summary.lateNightHours > 0) && (
        <div
          className="grid grid-cols-3 gap-2 text-center mt-3 pt-3"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          {summary.sixthDayHours > 0 && (
            <SummaryItem
              label="6th Day"
              value={summary.sixthDayHours.toFixed(1)}
              subtext={`@ ${rateCard.sixthDayMultiplier}x`}
            />
          )}
          {summary.seventhDayHours > 0 && (
            <SummaryItem
              label="7th Day"
              value={summary.seventhDayHours.toFixed(1)}
              subtext={`@ ${rateCard.seventhDayMultiplier}x`}
            />
          )}
          {summary.lateNightHours > 0 && (
            <SummaryItem
              label="Late Night"
              value={summary.lateNightHours.toFixed(1)}
              subtext={`@ ${rateCard.lateNightMultiplier}x`}
            />
          )}
        </div>
      )}

      {/* Optional: Earnings section (collapsed by default for production focus) */}
      {summary.totalEarnings > 0 && (
        <details className="group mt-4">
          <summary
            className="flex items-center justify-between cursor-pointer py-2"
            style={{ borderTop: '1px solid var(--color-border)' }}
          >
            <span className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--color-text-muted)' }}>
              Earnings Preview
            </span>
            <svg
              className="w-4 h-4 transition-transform group-open:rotate-180"
              style={{ color: 'var(--color-text-muted)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="pt-3 space-y-2">
            {summary.kitRentalTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--color-text-muted)' }}>Kit Rental</span>
                <span style={{ color: 'var(--color-text-primary)' }}>
                  £{summary.kitRentalTotal.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Est. Total
              </span>
              <span className="text-lg font-bold text-gold">
                £{summary.totalEarnings.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

interface SummaryItemProps {
  label: string;
  value: string;
  subtext?: string;
  highlight?: boolean;
}

function SummaryItem({ label, value, subtext, highlight }: SummaryItemProps) {
  return (
    <div className="py-2 px-1">
      <div
        className="text-[9px] uppercase tracking-wide font-medium mb-1"
        style={{ color: 'var(--color-text-placeholder)' }}
      >
        {label}
      </div>
      <div
        className={`text-lg font-bold ${highlight ? 'text-gold' : ''}`}
        style={{ color: highlight ? undefined : 'var(--color-text-primary)' }}
      >
        {value}
      </div>
      {subtext && (
        <div className="text-[10px]" style={{ color: 'var(--color-text-placeholder)' }}>
          {subtext}
        </div>
      )}
    </div>
  );
}
