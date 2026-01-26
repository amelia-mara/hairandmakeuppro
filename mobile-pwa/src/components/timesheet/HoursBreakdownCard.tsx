import type { TimesheetCalculation, TimesheetEntry } from '@/types';
import { useTimesheetStore } from '@/stores/timesheetStore';
import { formatCurrency } from '@/types';

interface HoursBreakdownCardProps {
  calculation: TimesheetCalculation;
  entry: TimesheetEntry;
  previousWrapOut?: string;
}

export function HoursBreakdownCard({ calculation, entry, previousWrapOut }: HoursBreakdownCardProps) {
  const { rateCard } = useTimesheetStore();
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

  // Check for BECTU warnings
  const hasBrokenLunch = calculation.hasBrokenLunch || calculation.brokenLunch;
  const hasBrokenTurnaround = calculation.hasBrokenTurnaround || calculation.brokenTurnaround;

  return (
    <div className="card overflow-hidden">
      {/* Header - Total Earnings prominent display */}
      <div className="bg-gradient-to-r from-gold to-gold-dark p-4 -m-4 mb-4">
        <div className="text-center">
          <div className="text-white/80 text-xs uppercase tracking-wide">Total Earnings</div>
          <div className="text-white text-4xl font-bold mt-1">
            {formatCurrency(calculation.totalEarnings)}
          </div>
          <div className="text-white/70 text-sm mt-1">
            {calculation.totalHours.toFixed(1)} hrs worked
          </div>
          {dayBadge && (
            <span className={`${dayBadge.color} text-white text-xs px-2 py-0.5 rounded-full mt-2 inline-block`}>
              {dayBadge.label}
            </span>
          )}
        </div>
      </div>

      {/* BECTU Warnings */}
      {(hasBrokenLunch || hasBrokenTurnaround) && (
        <div className="space-y-2 mb-4">
          {hasBrokenLunch && (
            <WarningBanner
              icon="clock"
              title="Broken Lunch"
              message={`Lunch taken ${calculation.brokenLunchHours?.toFixed(1) || '?'}hrs late (+${formatCurrency(calculation.brokenLunchPay || 0)})`}
            />
          )}
          {hasBrokenTurnaround && (
            <WarningBanner
              icon="moon"
              title="Broken Turnaround"
              message={`Less than 11hr rest (${calculation.brokenTurnaroundHours?.toFixed(1) || '?'}hrs short, +${formatCurrency(calculation.brokenTurnaroundPay || 0)})`}
              previousWrap={previousWrapOut}
            />
          )}
        </div>
      )}

      {/* Hours breakdown */}
      <div className="space-y-2">
        {/* Contracted Hours Info */}
        <div
          className="flex justify-between items-center py-2 px-3 rounded-lg text-sm"
          style={{ backgroundColor: 'var(--color-input-bg)' }}
        >
          <span style={{ color: 'var(--color-text-muted)' }}>Contracted Hours</span>
          <span style={{ color: 'var(--color-text-primary)' }} className="font-medium">
            {calculation.contractedHours?.toFixed(1) || calculation.baseHours?.toFixed(1)} hrs
          </span>
        </div>

        {/* Pre-Call Hours - Gold highlight */}
        {calculation.preCallHours > 0 && (
          <HourRow
            label="Pre-Call"
            hours={calculation.preCallHours}
            earnings={calculation.preCallEarnings}
            badge={{ label: '1.5x', color: 'gold' }}
          />
        )}

        {/* Base Pay (Day Rate Guarantee) */}
        <HourRow
          label="Base Pay (Day Rate)"
          hours={calculation.contractedHours || calculation.baseHours}
          earnings={calculation.basePay || calculation.dailyEarnings}
          isBase
        />

        {/* Overtime Hours - Orange highlight */}
        {calculation.otHours > 0 && (
          <HourRow
            label="Overtime"
            hours={calculation.otHours}
            earnings={calculation.overtimePay || calculation.otEarnings}
            badge={{ label: '1.5x', color: 'orange' }}
          />
        )}

        {/* Broken Lunch Hours - Amber highlight */}
        {(calculation.brokenLunchHours || 0) > 0 && (
          <HourRow
            label="Broken Lunch Penalty"
            hours={calculation.brokenLunchHours || 0}
            earnings={calculation.brokenLunchPay || 0}
            badge={{ label: '1.5x', color: 'amber' }}
          />
        )}

        {/* Broken Turnaround Hours - Purple highlight */}
        {(calculation.brokenTurnaroundHours || 0) > 0 && (
          <HourRow
            label="Broken Turnaround"
            hours={calculation.brokenTurnaroundHours || 0}
            earnings={calculation.brokenTurnaroundPay || 0}
            badge={{ label: '1.5x', color: 'purple' }}
          />
        )}

        {/* Late Night Hours - Red highlight */}
        {calculation.lateNightHours > 0 && (
          <HourRow
            label="Late Night (after 23:00)"
            hours={calculation.lateNightHours}
            earnings={calculation.lateNightPay || calculation.lateNightEarnings}
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

        {/* Kit Rental if applicable */}
        {rateCard.kitRental > 0 && (
          <div
            className="flex justify-between items-center py-2 px-3 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--color-input-bg)' }}
          >
            <span style={{ color: 'var(--color-text-muted)' }}>Kit Rental</span>
            <span style={{ color: 'var(--color-text-primary)' }} className="font-medium">
              +{formatCurrency(rateCard.kitRental)}
            </span>
          </div>
        )}
      </div>

      {/* Day type and rate info */}
      <div
        className="mt-4 pt-4 space-y-2"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        <div className="flex justify-between items-center text-sm">
          <span style={{ color: 'var(--color-text-muted)' }}>Day Type</span>
          <span style={{ color: 'var(--color-text-primary)' }} className="font-medium">
            {entry.dayType}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span style={{ color: 'var(--color-text-muted)' }}>Hourly Rate</span>
          <span style={{ color: 'var(--color-text-primary)' }} className="font-medium">
            {formatCurrency(calculation.hourlyRate || (rateCard.dailyRate / rateCard.baseDayHours))}/hr
          </span>
        </div>
        {calculation.dayMultiplier && calculation.dayMultiplier > 1 && (
          <div className="flex justify-between items-center text-sm">
            <span style={{ color: 'var(--color-text-muted)' }}>Day Multiplier</span>
            <span className="font-medium text-gold">
              {calculation.dayMultiplier}x applied
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Warning banner for BECTU violations
interface WarningBannerProps {
  icon: 'clock' | 'moon';
  title: string;
  message: string;
  previousWrap?: string;
}

function WarningBanner({ icon, title, message, previousWrap }: WarningBannerProps) {
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
      <div className="flex items-start gap-2">
        <div className="text-amber-500 flex-shrink-0 mt-0.5">
          {icon === 'clock' ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">{title}</div>
          <div className="text-xs text-amber-600 dark:text-amber-300">{message}</div>
          {previousWrap && (
            <div className="text-[10px] text-amber-500 dark:text-amber-400 mt-1">
              Previous wrap: {previousWrap}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface HourRowProps {
  label: string;
  hours: number;
  earnings?: number;
  badge?: {
    label: string;
    color: 'gold' | 'orange' | 'red' | 'amber' | 'purple';
  };
  isBase?: boolean;
}

function HourRow({ label, hours, earnings, badge, isBase }: HourRowProps) {
  const badgeColors = {
    gold: 'bg-gold/20 text-gold',
    orange: 'bg-orange-500/20 text-orange-500',
    red: 'bg-red-500/20 text-red-500',
    amber: 'bg-amber-500/20 text-amber-500',
    purple: 'bg-purple-500/20 text-purple-500',
  };

  const rowColors = {
    gold: 'border-l-gold',
    orange: 'border-l-orange-500',
    red: 'border-l-red-500',
    amber: 'border-l-amber-500',
    purple: 'border-l-purple-500',
  };

  const textColors = {
    gold: 'text-gold',
    orange: 'text-orange-500',
    red: 'text-red-500',
    amber: 'text-amber-500',
    purple: 'text-purple-500',
  };

  return (
    <div
      className={`flex justify-between items-center py-2 px-3 rounded-lg ${
        badge ? `border-l-4 ${rowColors[badge.color]}` : ''
      } ${isBase ? 'bg-gold/5' : ''}`}
      style={{ backgroundColor: isBase ? undefined : 'var(--color-input-bg)' }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--color-text-primary)' }} className={isBase ? 'font-medium' : ''}>{label}</span>
        {badge && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeColors[badge.color]}`}>
            {badge.label}
          </span>
        )}
      </div>
      <div className="text-right">
        <div
          className="font-semibold"
          style={{ color: badge ? undefined : 'var(--color-text-primary)' }}
        >
          <span className={badge ? textColors[badge.color] : isBase ? 'text-gold' : ''}>
            {hours.toFixed(1)}
          </span>
          <span className="text-sm font-normal ml-0.5" style={{ color: 'var(--color-text-muted)' }}>hrs</span>
        </div>
        {earnings !== undefined && earnings > 0 && (
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {formatCurrency(earnings)}
          </div>
        )}
      </div>
    </div>
  );
}
