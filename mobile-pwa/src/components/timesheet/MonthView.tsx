import { useMemo } from 'react';
import { useTimesheetStore, formatDateString } from '@/stores/timesheetStore';

interface MonthViewProps {
  year: number;
  month: number;
  onNavigate: (direction: 'prev' | 'next') => void;
  onDaySelect: (date: string) => void;
  selectedDate: string;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function MonthView({ year, month, onNavigate, onDaySelect, selectedDate }: MonthViewProps) {
  const { entries, calculateEntry } = useTimesheetStore();

  // Generate calendar grid
  const calendarData = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Get the day of week for the first day (0 = Sunday, adjust for Monday start)
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;

    const weeks: Array<Array<{ date: string | null; day: number | null; hours: number | null }>> = [];
    let currentWeek: Array<{ date: string | null; day: number | null; hours: number | null }> = [];

    // Add empty cells for days before the first of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      currentWeek.push({ date: null, day: null, hours: null });
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = formatDateString(new Date(year, month, day));
      const entry = entries[date];
      const calc = entry && entry.unitCall && entry.wrap ? calculateEntry(entry) : null;

      currentWeek.push({
        date,
        day,
        hours: calc?.totalHours ?? null,
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Fill remaining cells in the last week
    while (currentWeek.length > 0 && currentWeek.length < 7) {
      currentWeek.push({ date: null, day: null, hours: null });
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  }, [year, month, entries, calculateEntry]);

  // Calculate monthly totals
  const monthlyTotals = useMemo(() => {
    let totalHours = 0;
    let daysWorked = 0;

    Object.values(entries).forEach((entry) => {
      const entryDate = new Date(entry.date);
      if (entryDate.getFullYear() === year && entryDate.getMonth() === month) {
        if (entry.unitCall && entry.wrap) {
          const calc = calculateEntry(entry);
          totalHours += calc.totalHours;
          daysWorked++;
        }
      }
    });

    return { totalHours, daysWorked };
  }, [entries, year, month, calculateEntry]);

  const today = formatDateString(new Date());

  return (
    <div className="px-4 py-4">
      {/* Month navigation header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => onNavigate('prev')}
          className="p-2 text-text-muted hover:text-text-primary transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h2 className="text-base font-semibold text-text-primary">
          {MONTH_NAMES[month]} {year}
        </h2>

        <button
          onClick={() => onNavigate('next')}
          className="p-2 text-text-muted hover:text-text-primary transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Calendar grid */}
      <div className="bg-card rounded-card border border-border overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAY_LABELS.map((label, i) => (
            <div
              key={label}
              className={`py-2 text-center text-xs font-bold ${
                i >= 5 ? 'text-gold' : 'text-text-muted'
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Calendar weeks */}
        {calendarData.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {week.map((cell, dayIndex) => {
              if (!cell.date) {
                return <div key={dayIndex} className="h-16 bg-gray-50" />;
              }

              const isSelected = cell.date === selectedDate;
              const isToday = cell.date === today;
              const hasEntry = cell.hours !== null;

              return (
                <button
                  key={cell.date}
                  onClick={() => onDaySelect(cell.date!)}
                  className={`h-16 flex flex-col items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-gold-100'
                      : hasEntry
                      ? 'bg-gold-50 hover:bg-gold-100'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`text-sm font-medium ${
                      isToday
                        ? 'w-6 h-6 rounded-full bg-gold text-white flex items-center justify-center'
                        : isSelected
                        ? 'text-gold'
                        : 'text-text-primary'
                    }`}
                  >
                    {cell.day}
                  </span>
                  {hasEntry && (
                    <span className="text-[10px] text-gold font-medium mt-0.5">
                      {cell.hours?.toFixed(1)}h
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Monthly totals */}
      <div className="mt-4 p-4 bg-gold-50 rounded-card">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xs text-text-muted uppercase tracking-wide">Days Worked</div>
            <div className="text-lg font-bold text-text-primary">{monthlyTotals.daysWorked}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-text-muted uppercase tracking-wide">Total Hours</div>
            <div className="text-lg font-bold text-gold">{monthlyTotals.totalHours.toFixed(1)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
