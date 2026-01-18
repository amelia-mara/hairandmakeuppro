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
      return `${DAY_LABELS[0]} ${startDay} - ${DAY_LABELS[6]} ${endDay} ${startMonth}`;
    }
    return `${DAY_LABELS[0]} ${startDay} ${startMonth} - ${DAY_LABELS[6]} ${endDay} ${endMonth}`;
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
          className="p-2 text-text-muted hover:text-text-primary transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h2 className="text-base font-semibold text-text-primary">{formatDateRange()}</h2>

        <button
          onClick={() => onNavigate('next')}
          className="p-2 text-text-muted hover:text-text-primary transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day cards */}
      <div className="space-y-2">
        {weekDays.map(({ date, dayLabel, dayNumber, entry, calc }) => {
          const hasEntry = entry && entry.unitCall && entry.wrap;
          const isSelected = date === selectedDate;
          const isWeekend = dayLabel === 'S';

          return (
            <button
              key={date}
              onClick={() => onDaySelect(date)}
              className={`w-full p-3 rounded-card flex items-center gap-3 transition-all active:scale-[0.98] ${
                isSelected
                  ? 'bg-gold-50 border-2 border-gold'
                  : 'bg-card border border-border hover:border-gold/50'
              }`}
            >
              {/* Date column */}
              <div className="flex-shrink-0 w-12 text-center">
                <div
                  className={`text-xs font-bold ${
                    isWeekend ? 'text-gold' : 'text-text-muted'
                  }`}
                >
                  {dayLabel}
                </div>
                <div className="text-lg font-bold text-text-primary">{dayNumber}</div>
              </div>

              {/* Hours and earnings */}
              <div className="flex-1 text-left">
                {hasEntry ? (
                  <>
                    <div className="text-sm font-semibold text-text-primary">
                      {calc?.totalHours.toFixed(1)} hours
                    </div>
                    <div className="text-xs text-text-muted">
                      £{calc?.totalEarnings.toFixed(2)}
                      {entry?.isSixthDay && (
                        <span className="ml-1 text-gold">(6th Day)</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-text-placeholder">—</div>
                )}
              </div>

              {/* Status indicator */}
              <div className="flex-shrink-0">
                <StatusIndicator status={entry?.status || 'draft'} hasEntry={!!hasEntry} />
              </div>

              {/* Chevron */}
              <svg
                className="w-4 h-4 text-text-muted flex-shrink-0"
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
    pending: 'Pending Approval',
    approved: 'Approved',
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${colors[status]}`} title={labels[status]} />
      <span className="text-xs text-text-muted hidden sm:inline">{labels[status]}</span>
    </div>
  );
}
