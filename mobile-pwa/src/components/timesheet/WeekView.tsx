import { useTimesheetStore, addDays } from '@/stores/timesheetStore';
import type { EntryStatus } from '@/types';

interface WeekViewProps {
  weekStartDate: string;
  onNavigate: (direction: 'prev' | 'next') => void;
  onDaySelect: (date: string) => void;
  selectedDate: string;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function WeekView({ weekStartDate, onNavigate, onDaySelect, selectedDate }: WeekViewProps) {
  const { entries, calculateEntry } = useTimesheetStore();

  // Format date range for header
  const formatDateRange = () => {
    const start = new Date(weekStartDate);
    const end = new Date(addDays(weekStartDate, 6));

    const startDay = start.getDate();
    const endDay = end.getDate();
    const startMonth = start.toLocaleDateString('en-GB', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-GB', { month: 'short' });

    if (startMonth === endMonth) {
      return `${startDay} - ${endDay} ${startMonth}`;
    }
    return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
  };

  // Generate week days
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStartDate, i);
    const entry = entries[date];
    const calc = entry ? calculateEntry(entry) : null;

    return {
      date,
      dayLabel: DAY_LABELS[i],
      dayNumber: new Date(date).getDate(),
      entry,
      calc,
    };
  });

  return (
    <div className="px-4 py-4">
      {/* Week navigation header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => onNavigate('prev')}
          className="p-2 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {formatDateRange()}
        </h2>

        <button
          onClick={() => onNavigate('next')}
          className="p-2 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day cards */}
      <div className="space-y-2">
        {weekDays.map(({ date, dayLabel, dayNumber, entry, calc }) => {
          const hasEntry = entry && entry.unitCall && entry.wrapOut;
          const isSelected = date === selectedDate;
          const isWeekend = dayLabel === 'S';
          const hasOT = calc && calc.otHours > 0;
          const hasPreCall = calc && calc.preCallHours > 0;
          const is6thDay = entry?.isSixthDay;
          const is7thDay = entry?.isSeventhDay;

          return (
            <button
              key={date}
              onClick={() => onDaySelect(date)}
              className={`w-full p-3 rounded-card flex items-center gap-3 transition-all active:scale-[0.98] ${
                isSelected
                  ? 'bg-gold-50 border-2 border-gold'
                  : 'card hover:border-gold/50'
              }`}
            >
              {/* Date column */}
              <div className="flex-shrink-0 w-12 text-center">
                <div
                  className={`text-xs font-bold ${
                    isWeekend ? 'text-gold' : ''
                  }`}
                  style={{ color: isWeekend ? undefined : 'var(--color-text-muted)' }}
                >
                  {dayLabel}
                </div>
                <div className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {dayNumber}
                </div>
              </div>

              {/* Hours breakdown - Production accountability focus */}
              <div className="flex-1 text-left">
                {hasEntry ? (
                  <>
                    {/* Total hours - primary display */}
                    <div className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                      {calc?.totalHours.toFixed(1)} hrs
                    </div>

                    {/* Hours breakdown badges */}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {hasPreCall && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/20 text-gold font-medium">
                          Pre {calc.preCallHours.toFixed(1)}h
                        </span>
                      )}
                      {calc && calc.baseHours > 0 && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{
                            backgroundColor: 'var(--color-input-bg)',
                            color: 'var(--color-text-muted)'
                          }}
                        >
                          Base {calc.baseHours.toFixed(1)}h
                        </span>
                      )}
                      {hasOT && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-500 font-medium">
                          OT {calc.otHours.toFixed(1)}h
                        </span>
                      )}
                      {is7thDay && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/30 text-orange-600 font-semibold">
                          7th
                        </span>
                      )}
                      {is6thDay && !is7thDay && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold/30 text-gold font-semibold">
                          6th
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-sm" style={{ color: 'var(--color-text-placeholder)' }}>
                    —
                  </div>
                )}
              </div>

              {/* Status indicator */}
              <div className="flex-shrink-0">
                <StatusIndicator status={entry?.status || 'draft'} hasEntry={!!hasEntry} />
              </div>

              {/* Chevron */}
              <svg
                className="w-4 h-4 flex-shrink-0"
                style={{ color: 'var(--color-text-muted)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatusIndicator({ status, hasEntry }: { status: EntryStatus; hasEntry: boolean }) {
  if (!hasEntry) {
    return (
      <div className="w-2 h-2 rounded-full bg-gray-300" title="No entry" />
    );
  }

  const colors: Record<EntryStatus, string> = {
    draft: 'bg-warning',
    pending: 'bg-gold',
    approved: 'bg-success',
  };

  const labels: Record<EntryStatus, string> = {
    draft: 'Draft',
    pending: 'Pending',
    approved: 'Approved',
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${colors[status]}`} title={labels[status]} />
    </div>
  );
}
