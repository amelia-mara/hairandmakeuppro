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
          className="w-12 h-12 text-gray-300 mx-auto mb-3"
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
        <p className="text-sm text-text-muted">No entries this week</p>
        <p className="text-xs text-text-placeholder mt-1">Tap a day to add your hours</p>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <h3 className="section-header">WEEKLY SUMMARY</h3>

      {/* Hours breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryItem label="Total Hours" value={`${summary.totalHours.toFixed(1)}h`} />
        <SummaryItem label="Base Hours" value={`${summary.baseHours.toFixed(1)}h`} />
        <SummaryItem label="OT Hours" value={`${summary.otHours.toFixed(1)}h`} />
        <SummaryItem label="6th Day Hours" value={`${summary.sixthDayHours.toFixed(1)}h`} highlight />
      </div>

      {/* Kit rental */}
      {summary.kitRentalTotal > 0 && (
        <div className="border-t border-border pt-3">
          <SummaryItem label="Kit Rental" value={`£${summary.kitRentalTotal.toFixed(2)}`} />
        </div>
      )}

      {/* Total earnings */}
      <div className="border-t border-border pt-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-text-secondary">Total Earnings</span>
          <span className="text-2xl font-bold text-gold">
            £{summary.totalEarnings.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Days worked indicator */}
      <div className="bg-gold-50 rounded-lg p-3 flex items-center justify-between">
        <span className="text-sm text-text-muted">Days Worked</span>
        <span className="text-lg font-bold text-gold">{summary.entries.length}</span>
      </div>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-input-bg rounded-lg p-3">
      <div className="text-xs text-text-muted uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-semibold ${highlight ? 'text-gold' : 'text-text-primary'}`}>
        {value}
      </div>
    </div>
  );
}
