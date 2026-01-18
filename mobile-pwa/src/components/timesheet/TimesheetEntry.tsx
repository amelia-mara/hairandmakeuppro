import { useState, useEffect } from 'react';
import { useTimesheetStore } from '@/stores/timesheetStore';
import type { DayType, TimesheetEntry as TimesheetEntryType } from '@/types';
import { DAY_TYPE_LABELS, createEmptyTimesheetEntry } from '@/types';
import { CalculationCard } from './CalculationCard';

interface TimesheetEntryProps {
  onBack: () => void;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function TimesheetEntry({ onBack }: TimesheetEntryProps) {
  const {
    selectedDate,
    navigateDay,
    getEntry,
    saveEntry,
    calculateEntry,
    rateCard,
  } = useTimesheetStore();

  const [entry, setEntry] = useState<TimesheetEntryType>(() =>
    getEntry(selectedDate) || createEmptyTimesheetEntry(selectedDate)
  );

  // Update entry when selectedDate changes
  useEffect(() => {
    setEntry(getEntry(selectedDate) || createEmptyTimesheetEntry(selectedDate));
  }, [selectedDate, getEntry]);

  // Calculate values
  const calculation = calculateEntry(entry);

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

  // Handle field updates
  const updateField = <K extends keyof TimesheetEntryType>(
    field: K,
    value: TimesheetEntryType[K]
  ) => {
    setEntry((prev) => ({ ...prev, [field]: value }));
  };

  // Handle save
  const handleSave = () => {
    saveEntry(entry);
    onBack();
  };

  // Check if rate card is configured
  const rateCardConfigured = rateCard.dailyRate > 0;

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      {/* Gold gradient header with date navigation */}
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
            <h1 className="text-lg font-semibold text-white ml-2">Edit Entry</h1>
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
                <div className="text-white/80 text-xs">Day {entry.productionDay}</div>
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
        {/* Rate card warning */}
        {!rateCardConfigured && (
          <div className="bg-warning/10 border border-warning/30 rounded-card p-3 flex gap-2">
            <svg className="w-5 h-5 text-warning flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-sm text-warning">
              Configure your rate card in Settings to see earnings calculations.
            </div>
          </div>
        )}

        {/* Day Type */}
        <div className="card">
          <label className="field-label block mb-2">DAY TYPE</label>
          <select
            value={entry.dayType}
            onChange={(e) => updateField('dayType', e.target.value as DayType)}
            className="input-field w-full"
          >
            {(Object.keys(DAY_TYPE_LABELS) as DayType[]).map((type) => (
              <option key={type} value={type}>
                {type} - {DAY_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        {/* Time inputs */}
        <div className="card">
          <h3 className="field-label mb-3">TIME INPUTS</h3>
          <div className="grid grid-cols-2 gap-3">
            <TimeInput
              label="PRE-CALL"
              value={entry.preCall}
              onChange={(v) => updateField('preCall', v)}
              placeholder="05:30"
            />
            <TimeInput
              label="UNIT CALL"
              value={entry.unitCall}
              onChange={(v) => updateField('unitCall', v)}
              placeholder="06:00"
            />
            <TimeInput
              label="OUT OF CHAIR"
              value={entry.outOfChair}
              onChange={(v) => updateField('outOfChair', v)}
              placeholder="17:00"
            />
            <TimeInput
              label="WRAP"
              value={entry.wrap}
              onChange={(v) => updateField('wrap', v)}
              placeholder="18:00"
            />
          </div>
        </div>

        {/* Checkboxes */}
        <div className="card">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={entry.isSixthDay}
                onChange={(e) => updateField('isSixthDay', e.target.checked)}
                className="w-5 h-5 rounded border-border text-gold focus:ring-gold"
              />
              <span className="text-sm text-text-primary">6th Day</span>
              <span className="text-xs text-gold">(1.5x)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={entry.brokenLunch}
                onChange={(e) => updateField('brokenLunch', e.target.checked)}
                className="w-5 h-5 rounded border-border text-gold focus:ring-gold"
              />
              <span className="text-sm text-text-primary">Broken Lunch</span>
            </label>
          </div>
        </div>

        {/* Calculation summary */}
        <CalculationCard calculation={calculation} rateCard={rateCard} />

        {/* Notes */}
        <div className="card">
          <label className="field-label block mb-2">NOTES</label>
          <textarea
            value={entry.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="Add notes..."
            rows={3}
            className="input-field w-full resize-none"
          />
        </div>

        {/* Production day (optional) */}
        <div className="card">
          <label className="field-label block mb-2">PRODUCTION DAY (OPTIONAL)</label>
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

// Time input component
interface TimeInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function TimeInput({ label, value, onChange, placeholder }: TimeInputProps) {
  return (
    <div>
      <label className="field-label block mb-1.5">{label}</label>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field w-full"
      />
    </div>
  );
}
