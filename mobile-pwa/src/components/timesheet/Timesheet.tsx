import { useState } from 'react';
import { useTimesheetStore, getWeekStart, addDays } from '@/stores/timesheetStore';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
import { TimesheetDocument } from './TimesheetDocument';
import { SummaryCard } from './SummaryCard';
import { ExportModal } from './ExportModal';
import { RateCardSettings } from './RateCardSettings';

export function Timesheet() {
  const {
    viewMode,
    setViewMode,
    selectedDate,
    setSelectedDate,
    getWeekSummary,
    rateCard,
  } = useTimesheetStore();

  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(selectedDate));
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = new Date(selectedDate);
    return { year: date.getFullYear(), month: date.getMonth() };
  });
  const [showExportModal, setShowExportModal] = useState(false);
  const [rateCardExpanded, setRateCardExpanded] = useState(false);

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

  // Handle day selection (for month view)
  const handleDaySelect = (date: string) => {
    setSelectedDate(date);
    // Switch to week view and navigate to that week
    setViewMode('week');
    setCurrentWeekStart(getWeekStart(date));
  };

  const weekSummary = getWeekSummary(currentWeekStart);

  // Format rate card summary
  const formatRateCardSummary = () => {
    const parts = [];
    if (rateCard.dailyRate > 0) {
      parts.push(`£${rateCard.dailyRate}/day`);
    }
    parts.push(`${rateCard.baseDayHours}+1`);
    if (rateCard.kitRental > 0) {
      parts.push(`Kit £${rateCard.kitRental}`);
    }
    return parts.join(' · ');
  };

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
            <div className="flex bg-input-bg rounded-pill p-1 border border-border">
              <button
                onClick={() => setViewMode('week')}
                className={`flex-1 py-2 px-3 rounded-pill text-sm font-medium transition-all ${
                  viewMode === 'week'
                    ? 'bg-card text-text-primary border-2 border-gold'
                    : 'text-text-muted'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setViewMode('sheet')}
                className={`flex-1 py-2 px-3 rounded-pill text-sm font-medium transition-all ${
                  viewMode === 'sheet'
                    ? 'bg-card text-text-primary border-2 border-gold'
                    : 'text-text-muted'
                }`}
              >
                Sheet
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`flex-1 py-2 px-3 rounded-pill text-sm font-medium transition-all ${
                  viewMode === 'month'
                    ? 'bg-card text-text-primary border-2 border-gold'
                    : 'text-text-muted'
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
        {/* Collapsible Rate Card */}
        <div className="mx-4 mt-4 mb-3">
          <div
            className={`rounded-xl border overflow-hidden transition-all ${
              rateCardExpanded ? 'border-gold' : 'border-border'
            }`}
            style={{ backgroundColor: 'var(--color-card)' }}
          >
            {/* Rate Card Header - Always visible */}
            <div
              onClick={() => setRateCardExpanded(!rateCardExpanded)}
              className="px-4 py-3 flex items-center justify-between cursor-pointer"
              style={{ backgroundColor: 'var(--color-input-bg)' }}
            >
              <span className="text-xs font-medium flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
                <span>💰</span> Rate Card
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--color-text-placeholder)' }}>
                  {formatRateCardSummary()}
                </span>
                <svg
                  className={`w-2.5 h-2.5 transition-transform ${rateCardExpanded ? 'rotate-180' : ''}`}
                  style={{ color: 'var(--color-text-muted)' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Rate Card Content - Expandable & Editable */}
            {rateCardExpanded && (
              <div className="px-4 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                <RateCardSettings />
              </div>
            )}
          </div>
        </div>

        {viewMode === 'week' && (
          <WeekView
            weekStartDate={currentWeekStart}
            onNavigate={navigateWeek}
            selectedDate={selectedDate}
          />
        )}
        {viewMode === 'sheet' && (
          <TimesheetDocument
            weekStartDate={currentWeekStart}
            onNavigate={navigateWeek}
          />
        )}
        {viewMode === 'month' && (
          <MonthView
            year={currentMonth.year}
            month={currentMonth.month}
            onNavigate={navigateMonth}
            onDaySelect={handleDaySelect}
            selectedDate={selectedDate}
          />
        )}

        {/* Week Summary Card */}
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
