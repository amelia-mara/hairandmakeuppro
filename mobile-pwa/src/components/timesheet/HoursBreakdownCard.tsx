import type { TimesheetCalculation, TimesheetEntry } from '@/types';

interface HoursBreakdownCardProps {
  calculation: TimesheetCalculation;
  entry: TimesheetEntry;
}

export function HoursBreakdownCard({ calculation, entry }: HoursBreakdownCardProps) {
  const hasData = calculation.totalHours > 0;

  if (!hasData) {
    return (
      <div className="card text-center py-6">
        <svg
          className="w-10 h-10 mx-auto mb-2"
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
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Enter call and wrap times to see hours breakdown
        </p>
      </div>
    );
  }

  // Get multiplier badge info
  const getDayMultiplierBadge = () => {
    if (entry.isSeventhDay) {
      return { label: '7th Day (2x)', color: 'bg-orange-500' };
    }
    if (entry.isSixthDay) {
      return { label: '6th Day (1.5x)', color: 'bg-gold' };
    }
    return null;
  };

  const dayBadge = getDayMultiplierBadge();

  return (
    <div className="card overflow-hidden">
      {/* Header - Total Hours prominent display */}
      <div className="bg-gradient-to-r from-gold to-gold-dark p-4 -m-4 mb-4">
        <div className="text-center">
          <div className="text-white/80 text-xs uppercase tracking-wide">Total Hours</div>
          <div className="text-white text-4xl font-bold mt-1">
            {calculation.totalHours.toFixed(1)}
            <span className="text-xl font-normal ml-1">hrs</span>
          </div>
          {dayBadge && (
            <span className={`${dayBadge.color} text-white text-xs px-2 py-0.5 rounded-full mt-2 inline-block`}>
              {dayBadge.label}
            </span>
          )}
        </div>
      </div>

      {/* Hours breakdown */}
      <div className="space-y-2">
        {/* Pre-Call Hours - Gold highlight */}
        {calculation.preCallHours > 0 && (
          <HourRow
            label="Pre-Call"
            hours={calculation.preCallHours}
            badge={{ label: '1.5x', color: 'gold' }}
          />
        )}

        {/* Base Hours */}
        <HourRow
          label="Base Hours"
          hours={calculation.baseHours}
        />

        {/* Overtime Hours - Orange highlight */}
        {calculation.otHours > 0 && (
          <HourRow
            label="Overtime"
            hours={calculation.otHours}
            badge={{ label: '1.5x', color: 'orange' }}
          />
        )}

        {/* Late Night Hours - Red highlight */}
        {calculation.lateNightHours > 0 && (
          <HourRow
            label="Late Night (after 23:00)"
            hours={calculation.lateNightHours}
            badge={{ label: '2x', color: 'red' }}
          />
        )}

        {/* Lunch deducted */}
        <div
          className="flex justify-between items-center py-2 px-3 rounded-lg text-sm"
          style={{ backgroundColor: 'var(--color-input-bg)' }}
        >
          <span style={{ color: 'var(--color-text-muted)' }}>Lunch Deducted</span>
          <span style={{ color: 'var(--color-text-muted)' }}>
            -{(entry.lunchTaken / 60).toFixed(1)} hrs
          </span>
        </div>
      </div>

      {/* Day type info */}
      <div
        className="mt-4 pt-4"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        <div className="flex justify-between items-center text-sm">
          <span style={{ color: 'var(--color-text-muted)' }}>Day Type</span>
          <span style={{ color: 'var(--color-text-primary)' }} className="font-medium">
            {entry.dayType}
          </span>
        </div>
      </div>
    </div>
  );
}

interface HourRowProps {
  label: string;
  hours: number;
  badge?: {
    label: string;
    color: 'gold' | 'orange' | 'red';
  };
}

function HourRow({ label, hours, badge }: HourRowProps) {
  const badgeColors = {
    gold: 'bg-gold/20 text-gold',
    orange: 'bg-orange-500/20 text-orange-500',
    red: 'bg-red-500/20 text-red-500',
  };

  const rowColors = {
    gold: 'border-l-gold',
    orange: 'border-l-orange-500',
    red: 'border-l-red-500',
  };

  return (
    <div
      className={`flex justify-between items-center py-2 px-3 rounded-lg ${
        badge ? `border-l-4 ${rowColors[badge.color]}` : ''
      }`}
      style={{ backgroundColor: 'var(--color-input-bg)' }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--color-text-primary)' }}>{label}</span>
        {badge && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeColors[badge.color]}`}>
            {badge.label}
          </span>
        )}
      </div>
      <span
        className="font-semibold"
        style={{ color: badge ? undefined : 'var(--color-text-primary)' }}
      >
        <span className={badge?.color === 'gold' ? 'text-gold' : badge?.color === 'orange' ? 'text-orange-500' : badge?.color === 'red' ? 'text-red-500' : ''}>
          {hours.toFixed(1)}
        </span>
        <span className="text-sm font-normal ml-0.5" style={{ color: 'var(--color-text-muted)' }}>hrs</span>
      </span>
    </div>
  );
}
