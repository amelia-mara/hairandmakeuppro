import type { WeekSummary } from '@/types';

interface SummaryCardProps {
  summary: WeekSummary;
}

export function SummaryCard({ summary }: SummaryCardProps) {
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
    <div className="card space-y-4">
      {/* Header with total hours - Production accountability focus */}
      <div className="flex items-center justify-between">
        <h3 className="section-header">WEEKLY HOURS</h3>
        <div className="text-right">
          <span className="text-2xl font-bold text-gold">{summary.totalHours.toFixed(1)}</span>
          <span className="text-sm font-medium text-gold ml-1">hrs</span>
        </div>
      </div>

      {/* Hours breakdown - Primary focus for production */}
      <div className="grid grid-cols-2 gap-3">
        {/* Pre-Call Hours - Gold highlight */}
        {summary.preCallHours > 0 && (
          <SummaryItem
            label="Pre-Call"
            value={`${summary.preCallHours.toFixed(1)}h`}
            highlight="gold"
          />
        )}

        {/* Base Hours */}
        <SummaryItem
          label="Base Hours"
          value={`${summary.baseHours.toFixed(1)}h`}
        />

        {/* OT Hours - Orange highlight */}
        {summary.otHours > 0 && (
          <SummaryItem
            label="Overtime"
            value={`${summary.otHours.toFixed(1)}h`}
            highlight="orange"
          />
        )}

        {/* Late Night Hours */}
        {summary.lateNightHours > 0 && (
          <SummaryItem
            label="Late Night"
            value={`${summary.lateNightHours.toFixed(1)}h`}
            highlight="red"
          />
        )}

        {/* 6th Day Hours */}
        {summary.sixthDayHours > 0 && (
          <SummaryItem
            label="6th Day"
            value={`${summary.sixthDayHours.toFixed(1)}h`}
            highlight="gold"
            badge="1.5x"
          />
        )}

        {/* 7th Day Hours */}
        {summary.seventhDayHours > 0 && (
          <SummaryItem
            label="7th Day"
            value={`${summary.seventhDayHours.toFixed(1)}h`}
            highlight="orange"
            badge="2x"
          />
        )}
      </div>

      {/* Days worked */}
      <div
        className="flex items-center justify-between py-3 px-3 rounded-lg"
        style={{ backgroundColor: 'var(--color-gold-soft)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
          Days Worked
        </span>
        <span className="text-lg font-bold text-gold">{summary.entries.length}</span>
      </div>

      {/* Optional: Earnings section (collapsed by default for production focus) */}
      {summary.totalEarnings > 0 && (
        <details className="group">
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
  highlight?: 'gold' | 'orange' | 'red';
  badge?: string;
}

function SummaryItem({ label, value, highlight, badge }: SummaryItemProps) {
  const highlightColors = {
    gold: 'border-l-gold',
    orange: 'border-l-orange-500',
    red: 'border-l-red-500',
  };

  const textColors = {
    gold: 'text-gold',
    orange: 'text-orange-500',
    red: 'text-red-500',
  };

  const badgeColors = {
    gold: 'bg-gold/20 text-gold',
    orange: 'bg-orange-500/20 text-orange-500',
    red: 'bg-red-500/20 text-red-500',
  };

  return (
    <div
      className={`rounded-lg p-3 ${highlight ? `border-l-4 ${highlightColors[highlight]}` : ''}`}
      style={{ backgroundColor: 'var(--color-input-bg)' }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </span>
        {badge && highlight && (
          <span className={`text-[9px] px-1 py-0.5 rounded font-semibold ${badgeColors[highlight]}`}>
            {badge}
          </span>
        )}
      </div>
      <div className={`text-lg font-semibold ${highlight ? textColors[highlight] : ''}`}
           style={{ color: highlight ? undefined : 'var(--color-text-primary)' }}>
        {value}
      </div>
    </div>
  );
}
