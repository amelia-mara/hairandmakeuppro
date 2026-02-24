import { useTimesheetStore, addDays } from '@/stores/timesheetStore';
import { formatCurrency } from '@/types';

interface TimesheetDocumentProps {
  weekStartDate: string;
  onNavigate: (direction: 'prev' | 'next') => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function TimesheetDocument({ weekStartDate, onNavigate }: TimesheetDocumentProps) {
  const { entries, calculateEntry, getWeekSummary, getPreviousWrapOut, rateCard } = useTimesheetStore();

  const weekSummary = getWeekSummary(weekStartDate);

  // Format date range for header
  const formatDateRange = () => {
    const start = new Date(weekStartDate);
    const end = new Date(addDays(weekStartDate, 6));
    const startDay = start.getDate();
    const endDay = end.getDate();
    const startMonth = start.toLocaleDateString('en-GB', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-GB', { month: 'short' });
    const year = end.getFullYear();

    if (startMonth === endMonth) {
      return `${startDay} - ${endDay} ${startMonth} ${year}`;
    }
    return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`;
  };

  // Generate week days with entries and calculations
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStartDate, i);
    const entry = entries[date];
    const previousWrapOut = getPreviousWrapOut(date);
    const calc = entry ? calculateEntry(entry, previousWrapOut) : null;
    const today = new Date().toISOString().split('T')[0];

    return {
      date,
      dayLabel: DAY_LABELS[i],
      dayNumber: new Date(date).getDate(),
      entry,
      calc,
      isToday: date === today,
      hasData: !!(entry?.unitCall && entry?.wrapOut),
    };
  });

  // Count days worked
  const daysWorked = weekDays.filter((d) => d.hasData).length;

  // Format time for display (handles empty/undefined)
  const formatTime = (time?: string) => {
    if (!time) return '—';
    return time;
  };

  // Get day type badge color
  const getDayTypeBg = (dayType?: string) => {
    switch (dayType) {
      case 'CWD':
        return 'bg-blue-100 text-blue-700';
      case 'SCWD':
        return 'bg-pink-100 text-pink-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="px-4 py-4">
      {/* Week Navigation Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => onNavigate('prev')}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text-muted)' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center">
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {formatDateRange()}
          </h2>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {daysWorked} day{daysWorked !== 1 ? 's' : ''} logged
          </p>
        </div>

        <button
          onClick={() => onNavigate('next')}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text-muted)' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Timesheet Document */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
      >
        {/* Document Header */}
        <div className="gold-gradient px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold text-sm">WEEKLY TIMESHEET</h3>
              <p className="text-white/70 text-xs">{formatDateRange()}</p>
            </div>
            <div className="text-right">
              <div className="text-white/70 text-xs">Week Total</div>
              <div className="text-white font-bold text-lg">{weekSummary.totalHours.toFixed(1)} hrs</div>
            </div>
          </div>
        </div>

        {/* Scrollable Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-xs">
            {/* Day Headers */}
            <thead>
              <tr style={{ backgroundColor: 'var(--color-input-bg)' }}>
                <th
                  className="text-left py-2 px-3 font-medium sticky left-0 z-10"
                  style={{ backgroundColor: 'var(--color-input-bg)', color: 'var(--color-text-muted)', minWidth: '80px' }}
                >
                  &nbsp;
                </th>
                {weekDays.map((day) => (
                  <th
                    key={day.date}
                    className={`text-center py-2 px-2 font-medium ${day.isToday ? 'text-gold' : ''}`}
                    style={{ color: day.isToday ? undefined : 'var(--color-text-muted)', minWidth: '70px' }}
                  >
                    <div className="font-semibold">{day.dayLabel}</div>
                    <div className={`text-lg ${day.isToday ? 'text-gold' : ''}`} style={{ color: day.isToday ? undefined : 'var(--color-text-primary)' }}>
                      {day.dayNumber}
                    </div>
                  </th>
                ))}
                <th
                  className="text-center py-2 px-3 font-semibold"
                  style={{ backgroundColor: 'var(--color-gold-light)', color: 'var(--color-gold)', minWidth: '70px' }}
                >
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {/* Day Type Row */}
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td
                  className="py-2 px-3 font-medium sticky left-0"
                  style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text-muted)' }}
                >
                  Day Type
                </td>
                {weekDays.map((day) => (
                  <td key={day.date} className="text-center py-2 px-2">
                    {day.entry?.dayType ? (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getDayTypeBg(day.entry.dayType)}`}>
                        {day.entry.dayType}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text-placeholder)' }}>—</span>
                    )}
                  </td>
                ))}
                <td className="text-center py-2 px-3" style={{ backgroundColor: 'var(--color-input-bg)' }}>
                  —
                </td>
              </tr>

              {/* Pre-Call Row */}
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td
                  className="py-2 px-3 font-medium sticky left-0"
                  style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text-muted)' }}
                >
                  <span className="text-gold">Pre-Call</span>
                </td>
                {weekDays.map((day) => (
                  <td key={day.date} className="text-center py-2 px-2" style={{ color: 'var(--color-text-primary)' }}>
                    {formatTime(day.entry?.preCall)}
                  </td>
                ))}
                <td
                  className="text-center py-2 px-3 font-medium"
                  style={{ backgroundColor: 'var(--color-input-bg)', color: 'var(--color-gold)' }}
                >
                  {weekSummary.preCallHours > 0 ? `${weekSummary.preCallHours.toFixed(1)}h` : '—'}
                </td>
              </tr>

              {/* Unit Call Row */}
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td
                  className="py-2 px-3 font-medium sticky left-0"
                  style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text-muted)' }}
                >
                  Unit Call
                </td>
                {weekDays.map((day) => (
                  <td key={day.date} className="text-center py-2 px-2 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {formatTime(day.entry?.unitCall)}
                  </td>
                ))}
                <td className="text-center py-2 px-3" style={{ backgroundColor: 'var(--color-input-bg)' }}>
                  —
                </td>
              </tr>

              {/* Lunch Row */}
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td
                  className="py-2 px-3 font-medium sticky left-0"
                  style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text-muted)' }}
                >
                  Lunch
                </td>
                {weekDays.map((day) => (
                  <td key={day.date} className="text-center py-2 px-2" style={{ color: 'var(--color-text-muted)' }}>
                    {day.entry?.dayType === 'CWD' ? (
                      <span className="text-[10px]">W.I.H</span>
                    ) : day.entry?.lunchTaken ? (
                      `${day.entry.lunchTaken}m`
                    ) : (
                      '—'
                    )}
                  </td>
                ))}
                <td className="text-center py-2 px-3" style={{ backgroundColor: 'var(--color-input-bg)' }}>
                  —
                </td>
              </tr>

              {/* Wrap Out Row */}
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td
                  className="py-2 px-3 font-medium sticky left-0"
                  style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text-muted)' }}
                >
                  Wrap Out
                </td>
                {weekDays.map((day) => (
                  <td key={day.date} className="text-center py-2 px-2 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {formatTime(day.entry?.wrapOut)}
                  </td>
                ))}
                <td className="text-center py-2 px-3" style={{ backgroundColor: 'var(--color-input-bg)' }}>
                  —
                </td>
              </tr>

              {/* Divider */}
              <tr>
                <td colSpan={9} className="py-1" style={{ backgroundColor: 'var(--color-input-bg)' }}></td>
              </tr>

              {/* Base Hours Row */}
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td
                  className="py-2 px-3 font-medium sticky left-0"
                  style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text-muted)' }}
                >
                  Base Hrs
                </td>
                {weekDays.map((day) => (
                  <td key={day.date} className="text-center py-2 px-2" style={{ color: 'var(--color-text-primary)' }}>
                    {day.calc?.baseHours ? day.calc.baseHours.toFixed(1) : '—'}
                  </td>
                ))}
                <td
                  className="text-center py-2 px-3 font-semibold"
                  style={{ backgroundColor: 'var(--color-input-bg)', color: 'var(--color-text-primary)' }}
                >
                  {weekSummary.baseHours.toFixed(1)}
                </td>
              </tr>

              {/* Overtime Row */}
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td
                  className="py-2 px-3 font-medium sticky left-0"
                  style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text-muted)' }}
                >
                  <span className="text-orange-500">Overtime</span>
                </td>
                {weekDays.map((day) => (
                  <td key={day.date} className="text-center py-2 px-2 text-orange-500">
                    {day.calc?.otHours ? `+${day.calc.otHours.toFixed(1)}` : '—'}
                  </td>
                ))}
                <td
                  className="text-center py-2 px-3 font-semibold text-orange-500"
                  style={{ backgroundColor: 'var(--color-input-bg)' }}
                >
                  {weekSummary.otHours > 0 ? `+${weekSummary.otHours.toFixed(1)}` : '—'}
                </td>
              </tr>

              {/* Total Hours Row */}
              <tr style={{ backgroundColor: 'var(--color-input-bg)' }}>
                <td
                  className="py-3 px-3 font-semibold sticky left-0"
                  style={{ backgroundColor: 'var(--color-input-bg)', color: 'var(--color-text-primary)' }}
                >
                  Total Hrs
                </td>
                {weekDays.map((day) => (
                  <td key={day.date} className="text-center py-3 px-2 font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {day.calc?.totalHours ? day.calc.totalHours.toFixed(1) : '—'}
                  </td>
                ))}
                <td className="text-center py-3 px-3 font-bold text-gold" style={{ backgroundColor: 'var(--color-gold-light)' }}>
                  {weekSummary.totalHours.toFixed(1)}
                </td>
              </tr>

              {/* 6th/7th Day Indicators */}
              {(weekSummary.sixthDayHours > 0 || weekSummary.seventhDayHours > 0) && (
                <tr style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td
                    className="py-2 px-3 font-medium sticky left-0"
                    style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text-muted)' }}
                  >
                    Premium
                  </td>
                  {weekDays.map((day) => (
                    <td key={day.date} className="text-center py-2 px-2">
                      {day.entry?.isSeventhDay ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600">7th</span>
                      ) : day.entry?.isSixthDay ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-600">6th</span>
                      ) : (
                        <span style={{ color: 'var(--color-text-placeholder)' }}>—</span>
                      )}
                    </td>
                  ))}
                  <td className="text-center py-2 px-3" style={{ backgroundColor: 'var(--color-input-bg)' }}>
                    —
                  </td>
                </tr>
              )}

              {/* Earnings Row */}
              <tr className="gold-gradient">
                <td className="py-3 px-3 font-semibold text-white sticky left-0" style={{ background: 'inherit' }}>
                  Earnings
                </td>
                {weekDays.map((day) => (
                  <td key={day.date} className="text-center py-3 px-2 text-white font-medium">
                    {day.calc?.totalEarnings ? formatCurrency(day.calc.totalEarnings) : '—'}
                  </td>
                ))}
                <td className="text-center py-3 px-3 font-bold text-white text-base">
                  {formatCurrency(weekSummary.totalEarnings)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Earnings Breakdown Card */}
      {weekSummary.totalEarnings > 0 && (
        <div
          className="mt-4 rounded-xl border p-4"
          style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
        >
          <h4 className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Earnings Breakdown
          </h4>
          <div className="space-y-2">
            <BreakdownRow label="Base Pay" value={weekSummary.basePay} />
            {weekSummary.preCallPay > 0 && <BreakdownRow label={`Pre-Call (${rateCard.preCallMultiplier}x)`} value={weekSummary.preCallPay} highlight="gold" />}
            {weekSummary.overtimePay > 0 && <BreakdownRow label={`Overtime (${rateCard.otMultiplier}x)`} value={weekSummary.overtimePay} highlight="orange" />}
            {weekSummary.brokenLunchPay > 0 && <BreakdownRow label="Broken Lunch" value={weekSummary.brokenLunchPay} highlight="amber" />}
            {weekSummary.brokenTurnaroundPay > 0 && <BreakdownRow label="Broken Turnaround" value={weekSummary.brokenTurnaroundPay} highlight="purple" />}
            {weekSummary.lateNightPay > 0 && <BreakdownRow label={`Late Night (${rateCard.lateNightMultiplier}x)`} value={weekSummary.lateNightPay} highlight="red" />}
            {weekSummary.kitRentalTotal > 0 && <BreakdownRow label="Kit Rental" value={weekSummary.kitRentalTotal} />}

            <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
              <div className="flex justify-between items-center">
                <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Week Total</span>
                <span className="text-lg font-bold text-gold">{formatCurrency(weekSummary.totalEarnings)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {daysWorked === 0 && (
        <div className="mt-6 text-center py-8">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'var(--color-input-bg)' }}
          >
            <svg className="w-8 h-8" style={{ color: 'var(--color-text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>No hours logged this week</h3>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Switch to Day view to log your hours
          </p>
        </div>
      )}
    </div>
  );
}

// Breakdown row component
function BreakdownRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: 'gold' | 'orange' | 'amber' | 'red' | 'purple';
}) {
  const textColors = {
    gold: 'text-gold',
    orange: 'text-orange-500',
    amber: 'text-amber-500',
    red: 'text-red-500',
    purple: 'text-purple-500',
  };

  return (
    <div className="flex justify-between items-center text-sm">
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span className={`font-medium ${highlight ? textColors[highlight] : ''}`} style={!highlight ? { color: 'var(--color-text-primary)' } : undefined}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}
