import { useState } from 'react';
import { useTimesheetStore, addDays } from '@/stores/timesheetStore';
import { SmartTimeInput } from './SmartTimeInput';
import type { DayType, RateCard, TimesheetEntry as TimesheetEntryType, TimesheetCalculation } from '@/types';
import { DAY_TYPE_LABELS, createEmptyTimesheetEntry, getLunchDurationForDayType } from '@/types';

interface WeekViewProps {
  weekStartDate: string;
  onNavigate: (direction: 'prev' | 'next') => void;
  selectedDate?: string;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_TYPES: DayType[] = ['SWD', 'CWD', 'SCWD'];

export function WeekView({ weekStartDate, onNavigate }: WeekViewProps) {
  const { entries, calculateEntry, saveEntry, getEntry, rateCard } = useTimesheetStore();
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimesheetEntryType | null>(null);

  // Format date range for header
  const formatDateRange = () => {
    const start = new Date(weekStartDate);
    const end = new Date(addDays(weekStartDate, 6));

    const startDay = start.getDate();
    const endDay = end.getDate();
    const startMonth = start.toLocaleDateString('en-GB', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-GB', { month: 'short' });

    // Format: M 13 - S 19 Jan
    const startDayLetter = DAY_LABELS[0][0];
    const endDayLetter = DAY_LABELS[6][0];

    if (startMonth === endMonth) {
      return `${startDayLetter} ${startDay} - ${endDayLetter} ${endDay} ${startMonth}`;
    }
    return `${startDayLetter} ${startDay} ${startMonth} - ${endDayLetter} ${endDay} ${endMonth}`;
  };

  // Generate week days
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStartDate, i);
    const entry = entries[date];
    const calc = entry ? calculateEntry(entry) : null;
    const today = new Date().toISOString().split('T')[0];

    return {
      date,
      dayLabel: DAY_LABELS[i],
      dayNumber: new Date(date).getDate(),
      entry,
      calc,
      isToday: date === today,
      isWeekend: i >= 5,
    };
  });

  // Handle day card click - toggle expand
  const handleDayClick = (date: string) => {
    if (expandedDate === date) {
      // Save any changes before closing
      if (editingEntry && editingEntry.date === date) {
        saveEntry(editingEntry);
      }
      setExpandedDate(null);
      setEditingEntry(null);
    } else {
      // Save previous entry if any
      if (editingEntry) {
        saveEntry(editingEntry);
      }
      setExpandedDate(date);
      setEditingEntry(getEntry(date) || createEmptyTimesheetEntry(date));
    }
  };

  // Update editing entry field
  const updateField = <K extends keyof TimesheetEntryType>(
    field: K,
    value: TimesheetEntryType[K]
  ) => {
    if (!editingEntry) return;

    // Build updates object
    const updates: Partial<TimesheetEntryType> = { [field]: value };

    // Auto-update lunch duration when day type changes (BECTU standard)
    if (field === 'dayType') {
      const newDayType = value as DayType;
      updates.lunchTaken = getLunchDurationForDayType(newDayType);
    }

    const updated = { ...editingEntry, ...updates };
    setEditingEntry(updated);
    // Auto-save on each change
    saveEntry(updated);
  };

  // Format time display
  const formatTimeRange = (entry: TimesheetEntryType | undefined) => {
    if (!entry?.unitCall || !entry?.wrapOut) return null;
    const startTime = entry.preCall || entry.unitCall;
    return `${startTime} → ${entry.wrapOut}`;
  };

  return (
    <div className="px-4 py-4">
      {/* Week navigation header */}
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

        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {formatDateRange()}
        </h2>

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

      {/* Day cards */}
      <div className="space-y-2">
        {weekDays.map(({ date, dayLabel, dayNumber, entry, calc, isToday, isWeekend }) => {
          const hasEntry = entry && entry.unitCall && entry.wrapOut;
          const isExpanded = expandedDate === date;
          const timeRange = formatTimeRange(entry);

          // Build concise detail fragments
          const details: string[] = [];
          if (hasEntry) {
            if (entry.dayType !== 'SWD') details.push(entry.dayType);
            if (calc && calc.preCallHours > 0) details.push(`${calc.preCallHours.toFixed(1)}h pre`);
            if (calc && calc.otHours > 0) details.push(`${calc.otHours.toFixed(1)}h OT`);
            if (entry.isSixthDay && !entry.isSeventhDay) details.push('6th day');
            if (entry.isSeventhDay) details.push('7th day');
          }

          return (
            <div
              key={date}
              className={`rounded-xl overflow-hidden border transition-all ${
                isToday
                  ? 'border-2 border-gold'
                  : 'border-border'
              }`}
              style={{ backgroundColor: 'var(--color-card)' }}
            >
              {/* Day Card Header */}
              <div
                onClick={() => handleDayClick(date)}
                className="px-3.5 py-3 flex items-center cursor-pointer"
              >
                {/* Date column */}
                <div className="flex-shrink-0 w-11 text-center mr-3">
                  <div
                    className={`text-[10px] font-medium uppercase ${
                      isToday || isWeekend ? 'text-gold' : ''
                    }`}
                    style={{ color: isToday || isWeekend ? undefined : 'var(--color-text-muted)' }}
                  >
                    {dayLabel}
                  </div>
                  <div
                    className={`text-xl font-bold ${isToday ? 'text-gold' : ''}`}
                    style={{ color: isToday ? undefined : 'var(--color-text-primary)' }}
                  >
                    {dayNumber}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {hasEntry ? (
                    <>
                      <div className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {timeRange}
                      </div>
                      {details.length > 0 && (
                        <div
                          className="text-[11px] mt-0.5 truncate"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          {details.join(' · ')}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div
                        className={`text-[14px] font-medium ${isToday ? 'text-gold' : ''}`}
                        style={{ color: isToday ? undefined : 'var(--color-text-muted)' }}
                      >
                        {isToday ? 'Today' : '—'}
                      </div>
                      <div className="text-[12px] text-gold font-medium mt-0.5">+ Add hours</div>
                    </>
                  )}
                </div>

                {/* Hours + earnings */}
                {calc && calc.totalHours > 0 && (
                  <div className="text-right ml-3 flex-shrink-0">
                    <div className="text-[17px] font-bold text-gold leading-tight">
                      {calc.totalHours.toFixed(calc.totalHours % 1 === 0 ? 0 : 1)}h
                    </div>
                    {calc.totalEarnings > 0 && (
                      <div className="text-[11px] font-medium leading-tight" style={{ color: 'var(--color-text-muted)' }}>
                        £{calc.totalEarnings.toFixed(0)}
                      </div>
                    )}
                  </div>
                )}

                {/* Chevron */}
                <svg
                  className={`w-3 h-3 ml-2.5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  style={{ color: 'var(--color-text-muted)' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Expanded Content */}
              {isExpanded && editingEntry && (
                <ExpandedDayContent
                  entry={editingEntry}
                  updateField={updateField}
                  calculation={calculateEntry(editingEntry)}
                  rateCard={rateCard}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Expanded day content component
interface ExpandedDayContentProps {
  entry: TimesheetEntryType;
  updateField: <K extends keyof TimesheetEntryType>(field: K, value: TimesheetEntryType[K]) => void;
  calculation: TimesheetCalculation;
  rateCard: RateCard;
}

function ExpandedDayContent({ entry, updateField, calculation, rateCard }: ExpandedDayContentProps) {
  const isAutoFilled = !!entry.autoFilledFrom;

  return (
    <div
      className="px-4 pb-4 pt-3 space-y-3"
      style={{ borderTop: '1px solid var(--color-border)' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Auto-filled indicator */}
      {isAutoFilled && (
        <div className="flex items-center gap-2 text-[11px] text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
          <span>📋</span>
          <span>Times auto-filled from Day {entry.productionDay} call sheet</span>
        </div>
      )}

      {/* Day Type Selector */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide font-medium min-w-[70px]" style={{ color: 'var(--color-text-muted)' }}>
          Day Type
        </span>
        <select
          value={entry.dayType}
          onChange={(e) => updateField('dayType', e.target.value as DayType)}
          className="flex-1 py-2.5 px-3 rounded-lg text-sm font-medium appearance-none bg-no-repeat"
          style={{
            backgroundColor: 'var(--color-input-bg)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundPosition: 'right 12px center',
          }}
        >
          {DAY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type} - {DAY_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      {/* 6th/7th Day Checkboxes */}
      <div className="flex gap-3">
        <label
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg cursor-pointer border ${
            entry.isSixthDay
              ? 'bg-orange-50 border-orange-400'
              : ''
          }`}
          style={!entry.isSixthDay ? { backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)' } : undefined}
        >
          <div
            className={`w-[18px] h-[18px] rounded flex items-center justify-center text-xs ${
              entry.isSixthDay
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'border-2'
            }`}
            style={!entry.isSixthDay ? { borderColor: '#ccc' } : undefined}
          >
            {entry.isSixthDay && '✓'}
          </div>
          <span className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>6th Day</span>
          <span className="text-[11px] text-orange-500">({rateCard.sixthDayMultiplier}x)</span>
          <input
            type="checkbox"
            checked={entry.isSixthDay}
            onChange={(e) => {
              updateField('isSixthDay', e.target.checked);
              if (e.target.checked) updateField('isSeventhDay', false);
            }}
            className="sr-only"
          />
        </label>

        <label
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg cursor-pointer border ${
            entry.isSeventhDay
              ? 'bg-red-50 border-red-400'
              : ''
          }`}
          style={!entry.isSeventhDay ? { backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)' } : undefined}
        >
          <div
            className={`w-[18px] h-[18px] rounded flex items-center justify-center text-xs ${
              entry.isSeventhDay
                ? 'bg-red-600 border-red-600 text-white'
                : 'border-2'
            }`}
            style={!entry.isSeventhDay ? { borderColor: '#ccc' } : undefined}
          >
            {entry.isSeventhDay && '✓'}
          </div>
          <span className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>7th Day</span>
          <span className="text-[11px] text-red-600">({rateCard.seventhDayMultiplier}x)</span>
          <input
            type="checkbox"
            checked={entry.isSeventhDay}
            onChange={(e) => {
              updateField('isSeventhDay', e.target.checked);
              if (e.target.checked) updateField('isSixthDay', false);
            }}
            className="sr-only"
          />
        </label>
      </div>

      {/* Time Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <TimeInputCell
          label="Pre-Call"
          value={entry.preCall}
          onChange={(v) => updateField('preCall', v)}
          highlight="gold"
          hint={`@ ${rateCard.preCallMultiplier}x`}
        />
        <TimeInputCell
          label="Unit Call"
          value={entry.unitCall}
          onChange={(v) => updateField('unitCall', v)}
        />
        <TimeInputCell
          label="Lunch"
          value={entry.lunchStart || ''}
          onChange={(v) => updateField('lunchStart', v)}
        />
        <div
          className="p-2.5 rounded-lg"
          style={{ backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border)' }}
        >
          <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Lunch Duration
          </div>
          <select
            value={entry.lunchTaken}
            onChange={(e) => updateField('lunchTaken', parseInt(e.target.value))}
            className="text-[15px] font-semibold bg-transparent w-full appearance-none"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>1 hr</option>
            <option value={0}>None</option>
          </select>
        </div>
        <TimeInputCell
          label="Unit Wrap"
          value={entry.outOfChair}
          onChange={(v) => updateField('outOfChair', v)}
        />
        <TimeInputCell
          label="Wrap Out"
          value={entry.wrapOut}
          onChange={(v) => updateField('wrapOut', v)}
          highlight={calculation.otHours > 0 ? 'orange' : undefined}
          hint={calculation.otHours > 0 ? 'OT' : undefined}
        />
      </div>

      {/* Hours Breakdown */}
      {calculation.totalHours > 0 && (
        <div
          className="rounded-lg p-3.5"
          style={{ backgroundColor: 'var(--color-input-bg)' }}
        >
          <div className="text-[10px] uppercase tracking-wide font-medium mb-2.5" style={{ color: 'var(--color-text-muted)' }}>
            Hours Breakdown
          </div>
          <div className="space-y-1.5">
            {calculation.preCallHours > 0 && (
              <BreakdownRow label="Pre-Call" hours={calculation.preCallHours} rate={`@ ${rateCard.preCallMultiplier}x`} />
            )}
            <BreakdownRow label="Base Hours" hours={calculation.baseHours} rate="@ 1x" />
            {calculation.otHours > 0 && (
              <BreakdownRow label="Overtime" hours={calculation.otHours} rate={`@ ${rateCard.otMultiplier}x`} />
            )}
            {calculation.lateNightHours > 0 && (
              <BreakdownRow label="Late Night" hours={calculation.lateNightHours} rate={`@ ${rateCard.lateNightMultiplier}x`} />
            )}
            <BreakdownRow label="Lunch (unpaid)" hours={-(entry.lunchTaken / 60)} />
            <div
              className="flex justify-between items-center pt-2.5 mt-2.5"
              style={{ borderTop: '1px solid var(--color-border)' }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Total Worked</span>
              <span className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {calculation.totalHours.toFixed(1)} hrs
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Earnings Row */}
      {calculation.totalEarnings > 0 && (
        <div className="flex justify-between items-center p-3 rounded-lg gold-gradient text-white">
          <span className="text-[11px] uppercase tracking-wide opacity-90">Day Earnings</span>
          <span className="text-lg font-bold">£{calculation.totalEarnings.toFixed(2)}</span>
        </div>
      )}

      {/* Notes */}
      <div>
        <div className="text-[10px] uppercase tracking-wide font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
          Notes / OT Reason
          {calculation.otHours > 0 && (
            <span className="text-orange-500 ml-1">(Required for OT)</span>
          )}
        </div>
        <textarea
          value={entry.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="e.g., Extended for reshoots, rain delay..."
          rows={2}
          className="w-full p-3 rounded-lg text-[13px] resize-none"
          style={{
            backgroundColor: 'var(--color-input-bg)',
            border: `1px solid ${calculation.otHours > 0 && !entry.notes ? 'rgba(249, 115, 22, 0.5)' : 'var(--color-border)'}`,
            color: 'var(--color-text-primary)',
          }}
        />
      </div>
    </div>
  );
}

// Time input cell component
interface TimeInputCellProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  highlight?: 'gold' | 'orange';
  hint?: string;
}

function TimeInputCell({ label, value, onChange, highlight, hint }: TimeInputCellProps) {
  const bgStyle = highlight === 'gold'
    ? { backgroundColor: '#fffbeb', border: '1px solid var(--color-gold)' }
    : highlight === 'orange'
    ? { backgroundColor: '#fff7ed', border: '1px solid #f97316' }
    : { backgroundColor: 'var(--color-input-bg)', border: '1px solid var(--color-border)' };

  return (
    <div className="p-2.5 rounded-lg" style={bgStyle}>
      <div className="flex justify-between items-center">
        <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </span>
        {hint && (
          <span
            className="text-[9px] font-semibold"
            style={{ color: highlight === 'orange' ? '#f97316' : 'var(--color-gold)' }}
          >
            {hint}
          </span>
        )}
      </div>
      <SmartTimeInput
        value={value}
        onChange={onChange}
        className="text-[15px] font-semibold bg-transparent w-full outline-none"
        style={{ color: value ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
      />
    </div>
  );
}

// Breakdown row component
function BreakdownRow({ label, hours, rate }: { label: string; hours: number; rate?: string }) {
  return (
    <div className="flex justify-between items-center text-[13px]">
      <span className="flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
        {label}
        {rate && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ backgroundColor: 'var(--color-card)', color: 'var(--color-text-muted)' }}
          >
            {rate}
          </span>
        )}
      </span>
      <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        {hours > 0 ? '' : ''}{hours.toFixed(1)} hrs
      </span>
    </div>
  );
}
