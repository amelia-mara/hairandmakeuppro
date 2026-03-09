import { useRef, useCallback } from 'react';
import {
  CURRENCY_SYMBOLS,
  type TimesheetEntry,
  type TimesheetCalculation,
  type CurrencyCode,
  type BECTUDayType,
} from '@/stores/timesheetStore';

interface DayCardProps {
  dayName: string;
  shortDate: string;
  entry: TimesheetEntry;
  calculation: TimesheetCalculation;
  currency: CurrencyCode;
  onSave: (entry: TimesheetEntry) => void;
}

export function DayCard({ dayName, shortDate, entry, calculation, currency, onSave }: DayCardProps) {
  const sym = CURRENCY_SYMBOLS[currency];
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const update = useCallback((field: string, value: string | number | boolean) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSave({ ...entry, [field]: value });
    }, 150);
  }, [entry, onSave]);

  const isWeekend = dayName === 'Sat' || dayName === 'Sun';
  const hasData = !!entry.unitCall;
  const flags: string[] = [];
  if (calculation.hasOvertime) flags.push('OT');
  if (calculation.hasBrokenLunch) flags.push('BL');
  if (calculation.hasBrokenTurnaround) flags.push('BT');
  if (calculation.hasLateNight) flags.push('LN');
  if (entry.isSixthDay) flags.push('6th');
  if (entry.isSeventhDay) flags.push('7th');

  return (
    <div className={`ts-day-card ${isWeekend ? 'ts-day-card-weekend' : ''} ${hasData ? 'ts-day-card-filled' : ''}`}>
      <div className="ts-day-header">
        <div className="ts-day-info">
          <span className="ts-day-name">{dayName}</span>
          <span className="ts-day-date">{shortDate}</span>
        </div>
        {hasData && (
          <div className="ts-day-total">
            {sym}{calculation.totalPay.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        )}
      </div>

      <div className="ts-day-fields">
        <div className="ts-time-row">
          <div className="ts-time-field">
            <label className="ts-time-label">Pre-Call</label>
            <input
              className="ts-time-input"
              type="time"
              defaultValue={entry.preCall}
              onChange={e => update('preCall', e.target.value)}
            />
          </div>
          <div className="ts-time-field">
            <label className="ts-time-label">Unit Call</label>
            <input
              className="ts-time-input"
              type="time"
              defaultValue={entry.unitCall}
              onChange={e => update('unitCall', e.target.value)}
            />
          </div>
          <div className="ts-time-field">
            <label className="ts-time-label">Lunch</label>
            <input
              className="ts-time-input"
              type="time"
              defaultValue={entry.lunchStart}
              onChange={e => update('lunchStart', e.target.value)}
            />
          </div>
          <div className="ts-time-field">
            <label className="ts-time-label">Out of Chair</label>
            <input
              className="ts-time-input"
              type="time"
              defaultValue={entry.outOfChair}
              onChange={e => update('outOfChair', e.target.value)}
            />
          </div>
          <div className="ts-time-field">
            <label className="ts-time-label">Wrap Out</label>
            <input
              className="ts-time-input"
              type="time"
              defaultValue={entry.wrapOut}
              onChange={e => update('wrapOut', e.target.value)}
            />
          </div>
        </div>

        <div className="ts-day-options">
          <select
            className="ts-select ts-select-sm"
            defaultValue={entry.dayType}
            onChange={e => update('dayType', e.target.value as BECTUDayType)}
          >
            <option value="SWD">SWD</option>
            <option value="SCWD">SCWD</option>
            <option value="CWD">CWD</option>
          </select>
          <label className="ts-checkbox-label">
            <input
              type="checkbox"
              defaultChecked={entry.isSixthDay}
              onChange={e => onSave({ ...entry, isSixthDay: e.target.checked, isSeventhDay: false })}
            />
            6th Day
          </label>
          <label className="ts-checkbox-label">
            <input
              type="checkbox"
              defaultChecked={entry.isSeventhDay}
              onChange={e => onSave({ ...entry, isSeventhDay: e.target.checked, isSixthDay: false })}
            />
            7th Day
          </label>
        </div>
      </div>

      {hasData && (
        <div className="ts-day-breakdown">
          <div className="ts-breakdown-row">
            <span>Base ({calculation.baseHours}h)</span>
            <span>{sym}{calculation.basePay.toFixed(2)}</span>
          </div>
          {calculation.preCallHours > 0 && (
            <div className="ts-breakdown-row">
              <span>Pre-Call ({calculation.preCallHours}h)</span>
              <span>{sym}{calculation.preCallPay.toFixed(2)}</span>
            </div>
          )}
          {calculation.otHours > 0 && (
            <div className="ts-breakdown-row ts-breakdown-warn">
              <span>OT ({calculation.otHours}h)</span>
              <span>{sym}{calculation.overtimePay.toFixed(2)}</span>
            </div>
          )}
          {calculation.lateNightHours > 0 && (
            <div className="ts-breakdown-row ts-breakdown-warn">
              <span>Late Night ({calculation.lateNightHours}h)</span>
              <span>{sym}{calculation.lateNightPay.toFixed(2)}</span>
            </div>
          )}
          {calculation.hasBrokenLunch && (
            <div className="ts-breakdown-row ts-breakdown-flag">
              <span>Broken Lunch ({calculation.brokenLunchHours}h)</span>
              <span>{sym}{calculation.brokenLunchPay.toFixed(2)}</span>
            </div>
          )}
          {calculation.hasBrokenTurnaround && (
            <div className="ts-breakdown-row ts-breakdown-flag">
              <span>Broken Turnaround ({calculation.brokenTurnaroundHours}h)</span>
              <span>{sym}{calculation.brokenTurnaroundPay.toFixed(2)}</span>
            </div>
          )}
          {flags.length > 0 && (
            <div className="ts-day-flags">
              {flags.map(f => (
                <span key={f} className="ts-flag-pill">{f}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="ts-day-notes">
        <input
          className="ts-notes-input"
          type="text"
          defaultValue={entry.notes}
          placeholder="Notes..."
          onChange={e => update('notes', e.target.value)}
        />
      </div>
    </div>
  );
}
