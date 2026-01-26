import { useState, useEffect, useRef } from 'react';
import { useTimesheetStore } from '@/stores/timesheetStore';
import type { DayType, TimesheetEntry as TimesheetEntryType } from '@/types';
import { DAY_TYPE_LABELS, createEmptyTimesheetEntry, getLunchDurationForDayType } from '@/types';
import { HoursBreakdownCard } from './HoursBreakdownCard';

// Debounce helper with flush capability
function debounce<T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number
): { debounced: (...args: T) => void; flush: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: T | null = null;

  const debounced = (...args: T) => {
    lastArgs = args;
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
      lastArgs = null;
    }, delay);
  };

  const flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (lastArgs) {
      fn(...lastArgs);
      lastArgs = null;
    }
  };

  return { debounced, flush };
}

interface TimesheetEntryProps {
  onBack: () => void;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_TYPES: DayType[] = ['SWD', 'CWD', 'SCWD'];

export function TimesheetEntry({ onBack }: TimesheetEntryProps) {
  const {
    selectedDate,
    navigateDay,
    getEntry,
    saveEntry,
    calculateEntry,
    getPreviousWrapOut,
  } = useTimesheetStore();

  const [entry, setEntry] = useState<TimesheetEntryType>(() =>
    getEntry(selectedDate) || createEmptyTimesheetEntry(selectedDate)
  );

  // Create debounced save function (300ms delay)
  const { debounced: debouncedSave, flush: flushSave } = useRef(
    debounce((entryToSave: TimesheetEntryType) => {
      saveEntry(entryToSave);
    }, 300)
  ).current;

  // Track if entry has been modified to avoid unnecessary saves
  const isInitialMount = useRef(true);

  // Auto-save when entry changes (after initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    debouncedSave(entry);
  }, [entry, debouncedSave]);

  // Flush pending save and update entry when selectedDate changes
  useEffect(() => {
    flushSave(); // Save any pending changes for the previous date
    isInitialMount.current = true; // Reset to avoid auto-save on date change load
    setEntry(getEntry(selectedDate) || createEmptyTimesheetEntry(selectedDate));
  }, [selectedDate, getEntry, flushSave]);

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      flushSave();
    };
  }, [flushSave]);

  // Get previous wrap time for turnaround calculation
  const previousWrapOut = getPreviousWrapOut(selectedDate);

  // Calculate values with BECTU logic
  const calculation = calculateEntry(entry, previousWrapOut);

  // Format date for display
  const formatDate = () => {
    const date = new Date(selectedDate);
    const dayName = DAY_NAMES[date.getDay()];
    const day = date.getDate();
    const month = date.toLocaleDateString('en-GB', { month: 'long' });
    const year = date.getFullYear();
    return { dayName, formatted: `${day} ${month} ${year}` };
  };

  const { dayName, formatted } = formatDate();

  // Handle field updates - auto-update lunch duration when day type changes
  const updateField = <K extends keyof TimesheetEntryType>(
    field: K,
    value: TimesheetEntryType[K]
  ) => {
    setEntry((prev) => {
      const updates: Partial<TimesheetEntryType> = { [field]: value };

      // Auto-update lunch duration when day type changes (BECTU standard)
      if (field === 'dayType') {
        const newDayType = value as DayType;
        updates.lunchTaken = getLunchDurationForDayType(newDayType);
      }

      return { ...prev, ...updates };
    });
  };

  // Handle save button - flush any pending auto-save and navigate back
  const handleSave = () => {
    flushSave();
    onBack();
  };

  // Check if auto-filled from call sheet
  const isAutoFilled = !!entry.autoFilledFrom;

  // Check if time differs from call sheet
  const hasCallSheetDiff = (field: 'unitCall' | 'wrapOut'): boolean => {
    if (!isAutoFilled) return false;
    const callSheetValue = field === 'unitCall' ? entry.callSheetUnitCall : entry.callSheetWrap;
    return !!(callSheetValue && entry[field] !== callSheetValue);
  };

  return (
    <div className="min-h-screen pb-safe-bottom" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Header with date navigation */}
      <div className="gold-gradient safe-top">
        <div className="mobile-container">
          {/* Back button and title */}
          <div className="h-14 px-4 flex items-center">
            <button
              onClick={onBack}
              className="p-2 -ml-2 text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-white ml-2">Log Hours</h1>
          </div>

          {/* Date navigation */}
          <div className="px-4 pb-4 flex items-center justify-between">
            <button
              onClick={() => navigateDay('prev')}
              className="p-2 text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="text-center">
              <div className="text-white/80 text-sm">{dayName}</div>
              <div className="text-white text-lg font-semibold">{formatted}</div>
              {entry.productionDay && (
                <div className="text-white/80 text-xs mt-0.5">Day {entry.productionDay}</div>
              )}
            </div>

            <button
              onClick={() => navigateDay('next')}
              className="p-2 text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Form content */}
      <div className="mobile-container px-4 py-4 space-y-4">
        {/* Call sheet auto-fill indicator */}
        {isAutoFilled && (
          <div className="bg-gold/10 border border-gold/30 rounded-card p-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-gold flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm text-gold">Auto-filled from Call Sheet</span>
          </div>
        )}

        {/* Day Type Pills */}
        <div className="card">
          <label className="field-label block mb-3">DAY TYPE</label>
          <div className="flex gap-2">
            {DAY_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => updateField('dayType', type)}
                className={`flex-1 py-2 px-3 rounded-pill text-sm font-medium border transition-all ${
                  entry.dayType === type
                    ? 'pill-active border-gold'
                    : 'pill-inactive hover:border-gold/50'
                }`}
              >
                <div className="font-semibold">{type}</div>
                <div className="text-[9px] opacity-70 mt-0.5">{DAY_TYPE_LABELS[type].replace(' Working Day', '')}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Time inputs - Core times for production */}
        <div className="card">
          <h3 className="field-label mb-3">CALL TIMES</h3>
          <div className="grid grid-cols-2 gap-3">
            <TimeInput
              label="PRE-CALL"
              value={entry.preCall}
              onChange={(v) => updateField('preCall', v)}
              placeholder="05:30"
              highlight="gold"
              hint="1.5x"
            />
            <TimeInput
              label="UNIT CALL"
              value={entry.unitCall}
              onChange={(v) => updateField('unitCall', v)}
              placeholder="06:00"
              hasCallSheetDiff={hasCallSheetDiff('unitCall')}
              callSheetValue={entry.callSheetUnitCall}
            />
          </div>
        </div>

        {/* Wrap times */}
        <div className="card">
          <h3 className="field-label mb-3">WRAP TIMES</h3>
          <div className="grid grid-cols-2 gap-3">
            {entry.dayType !== 'CWD' ? (
              <>
                <TimeInput
                  label="LUNCH START"
                  value={entry.lunchStart || ''}
                  onChange={(v) => updateField('lunchStart', v)}
                  placeholder="13:00"
                />
                <TimeInput
                  label="LUNCH END"
                  value={entry.lunchEnd || ''}
                  onChange={(v) => updateField('lunchEnd', v)}
                  placeholder="14:00"
                />
              </>
            ) : (
              <div className="col-span-2 py-2 px-3 rounded-lg text-sm text-center" style={{ backgroundColor: 'var(--color-input-bg)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>No lunch break on Continuous Working Day</span>
              </div>
            )}
            <TimeInput
              label="OUT OF CHAIR"
              value={entry.outOfChair}
              onChange={(v) => updateField('outOfChair', v)}
              placeholder="17:00"
            />
            <TimeInput
              label="WRAP OUT"
              value={entry.wrapOut}
              onChange={(v) => updateField('wrapOut', v)}
              placeholder="18:00"
              hasCallSheetDiff={hasCallSheetDiff('wrapOut')}
              callSheetValue={entry.callSheetWrap}
            />
          </div>
        </div>

        {/* Lunch & Day multipliers */}
        <div className="card">
          <div className="flex flex-wrap items-center gap-4">
            {/* Lunch duration - disabled for CWD */}
            <div className="flex items-center gap-2">
              <label className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Lunch</label>
              {entry.dayType === 'CWD' ? (
                <span className="input-field text-sm py-1.5 px-2 bg-gray-100 dark:bg-gray-800 text-text-muted cursor-not-allowed">
                  Working in hand
                </span>
              ) : (
                <select
                  value={entry.lunchTaken}
                  onChange={(e) => updateField('lunchTaken', parseInt(e.target.value))}
                  className="input-field text-sm py-1.5 px-2"
                >
                  {entry.dayType === 'SWD' ? (
                    <>
                      <option value={60}>1 hour</option>
                      <option value={45}>45 min</option>
                      <option value={30}>30 min</option>
                    </>
                  ) : (
                    <>
                      <option value={30}>30 min</option>
                      <option value={45}>45 min</option>
                      <option value={60}>1 hour</option>
                    </>
                  )}
                </select>
              )}
            </div>

            <div className="flex-1" />

            {/* 6th Day toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={entry.isSixthDay}
                onChange={(e) => {
                  updateField('isSixthDay', e.target.checked);
                  if (e.target.checked) updateField('isSeventhDay', false);
                }}
                className="w-5 h-5 rounded border-border text-gold focus:ring-gold"
              />
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>6th Day</span>
              <span className="text-xs text-gold font-semibold">(1.5x)</span>
            </label>

            {/* 7th Day toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={entry.isSeventhDay}
                onChange={(e) => {
                  updateField('isSeventhDay', e.target.checked);
                  if (e.target.checked) updateField('isSixthDay', false);
                }}
                className="w-5 h-5 rounded border-border text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>7th Day</span>
              <span className="text-xs text-orange-500 font-semibold">(2x)</span>
            </label>
          </div>
        </div>

        {/* Hours Breakdown Card - BECTU Calculations */}
        <HoursBreakdownCard calculation={calculation} entry={entry} previousWrapOut={previousWrapOut} />

        {/* Notes - OT justification for production */}
        <div className="card">
          <label className="field-label block mb-2">
            NOTES / OT JUSTIFICATION
            {calculation.otHours > 0 && (
              <span className="text-orange-500 ml-2">(Required for OT)</span>
            )}
          </label>
          <textarea
            value={entry.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder={calculation.otHours > 0
              ? "Explain overtime reason for production accounting..."
              : "Add any notes for this day..."
            }
            rows={3}
            className={`input-field w-full resize-none ${
              calculation.otHours > 0 && !entry.notes
                ? 'border-orange-500/50 focus:border-orange-500'
                : ''
            }`}
          />
        </div>

        {/* Production day */}
        <div className="card">
          <label className="field-label block mb-2">PRODUCTION DAY</label>
          <input
            type="number"
            value={entry.productionDay || ''}
            onChange={(e) => updateField('productionDay', e.target.value ? parseInt(e.target.value, 10) : undefined)}
            placeholder="e.g., 4"
            min="1"
            className="input-field w-24"
          />
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          className="w-full py-3.5 rounded-button gold-gradient text-white font-semibold shadow-md active:scale-[0.98] transition-transform"
        >
          Save Entry
        </button>
      </div>
    </div>
  );
}

// Time input component with call sheet diff indicator
interface TimeInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  highlight?: 'gold' | 'orange';
  hasCallSheetDiff?: boolean;
  callSheetValue?: string;
}

function TimeInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
  highlight,
  hasCallSheetDiff,
  callSheetValue
}: TimeInputProps) {
  const highlightClass = highlight === 'gold'
    ? 'text-gold'
    : highlight === 'orange'
    ? 'text-orange-500'
    : '';

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className={`field-label ${highlightClass}`}>{label}</label>
        {hint && (
          <span className={`text-[9px] font-semibold ${
            highlight === 'gold' ? 'text-gold' :
            highlight === 'orange' ? 'text-orange-500' : 'text-gold'
          }`}>
            {hint}
          </span>
        )}
      </div>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`input-field w-full ${
          highlight === 'gold' ? 'border-gold/30 focus:border-gold' :
          highlight === 'orange' ? 'border-orange-500/30 focus:border-orange-500' : ''
        }`}
      />
      {hasCallSheetDiff && callSheetValue && (
        <div className="text-[10px] text-warning mt-1 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
          </svg>
          <span>Call sheet: {callSheetValue}</span>
        </div>
      )}
    </div>
  );
}
