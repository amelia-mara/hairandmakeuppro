import { useState } from 'react';
import { useTimesheetStore, getWeekStart, addDays } from '@/stores/timesheetStore';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
import { TimesheetEntry } from './TimesheetEntry';
import { SummaryCard } from './SummaryCard';
import { ExportModal } from './ExportModal';

export function Timesheet() {
  const {
    viewMode,
    setViewMode,
    selectedDate,
    setSelectedDate,
    editingEntry,
    setEditingEntry,
    getWeekSummary,
  } = useTimesheetStore();

  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(selectedDate));
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = new Date(selectedDate);
    return { year: date.getFullYear(), month: date.getMonth() };
  });
  const [showExportModal, setShowExportModal] = useState(false);

  // Navigate weeks
  const navigateWeek = (direction: 'prev' | 'next') => {
    const newStart = addDays(currentWeekStart, direction === 'next' ? 7 : -7);
    setCurrentWeekStart(newStart);
  };

  // Navigate months
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev) => {
      let newMonth = prev.month + (direction === 'next' ? 1 : -1);
      let newYear = prev.year;
      if (newMonth > 11) {
        newMonth = 0;
        newYear++;
      } else if (newMonth < 0) {
        newMonth = 11;
        newYear--;
      }
      return { year: newYear, month: newMonth };
    });
  };

  // Handle day selection
  const handleDaySelect = (date: string) => {
    setSelectedDate(date);
    setEditingEntry(true);
  };

  // Handle back from entry
  const handleBack = () => {
    setEditingEntry(false);
  };

  // If editing an entry, show the entry form
  if (editingEntry) {
    return <TimesheetEntry onBack={handleBack} />;
  }

  const weekSummary = getWeekSummary(currentWeekStart);

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-text-primary">Timesheet</h1>
            <button
              onClick={() => setShowExportModal(true)}
              className="p-2 text-text-muted hover:text-gold transition-colors"
              aria-label="Export"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            </button>
          </div>

          {/* View toggle */}
          <div className="px-4 pb-3">
            <div className="flex bg-input-bg rounded-pill p-1">
              <button
                onClick={() => setViewMode('week')}
                className={`flex-1 py-2 px-4 rounded-pill text-sm font-medium transition-all ${
                  viewMode === 'week' ? 'bg-card shadow text-text-primary' : 'text-text-muted'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`flex-1 py-2 px-4 rounded-pill text-sm font-medium transition-all ${
                  viewMode === 'month' ? 'bg-card shadow text-text-primary' : 'text-text-muted'
                }`}
              >
                Month
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mobile-container">
        {viewMode === 'week' ? (
          <WeekView
            weekStartDate={currentWeekStart}
            onNavigate={navigateWeek}
            onDaySelect={handleDaySelect}
            selectedDate={selectedDate}
          />
        ) : (
          <MonthView
            year={currentMonth.year}
            month={currentMonth.month}
            onNavigate={navigateMonth}
            onDaySelect={handleDaySelect}
            selectedDate={selectedDate}
          />
        )}

        {/* Summary Card */}
        <div className="px-4 pb-24">
          <SummaryCard summary={weekSummary} />
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        weekSummary={weekSummary}
        weekStartDate={currentWeekStart}
      />
    </div>
  );
}
