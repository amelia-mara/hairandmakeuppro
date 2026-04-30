import { useEffect, useMemo, useState } from 'react';
import {
  CURRENCY_SYMBOLS,
  type CrewMember,
  type CurrencyCode,
  type TimesheetCalculation,
  type TimesheetEntry,
  createEmptyEntry,
} from '@/stores/timesheetStore';

interface LogDayModalProps {
  crew: CrewMember;
  currency: CurrencyCode;
  initialEntry?: TimesheetEntry | null;
  defaultDate?: string;
  previousWrapOut?: string;
  calculate: (entry: TimesheetEntry, previousWrapOut?: string) => TimesheetCalculation;
  onSave: (entry: TimesheetEntry) => void;
  onDelete?: (date: string) => void;
  onClose: () => void;
}

export function LogDayModal({
  crew,
  currency,
  initialEntry,
  defaultDate,
  previousWrapOut,
  calculate,
  onSave,
  onDelete,
  onClose,
}: LogDayModalProps) {
  const seedDate = defaultDate ?? new Date().toISOString().slice(0, 10);
  const [draft, setDraft] = useState<TimesheetEntry>(
    () => initialEntry ?? createEmptyEntry(seedDate),
  );

  useEffect(() => {
    if (initialEntry) setDraft(initialEntry);
  }, [initialEntry]);

  const set = <K extends keyof TimesheetEntry>(key: K, value: TimesheetEntry[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const calc = useMemo(
    () => (draft.unitCall && draft.wrapOut ? calculate(draft, previousWrapOut) : null),
    [draft, calculate, previousWrapOut],
  );

  const canSave = draft.unitCall && draft.wrapOut;
  const isExisting = !!initialEntry;
  const sym = CURRENCY_SYMBOLS[currency] || '£';

  return (
    <div className="tm-modal-overlay" onClick={onClose}>
      <div
        className="tm-modal"
        style={{ maxWidth: 640 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tm-modal-header">
          <h3 className="tm-modal-title">
            {isExisting ? 'Edit timesheet entry' : 'Log day'}
            <span className="tm-detail-meta" style={{ marginLeft: 12, fontWeight: 400 }}>
              {crew.name}
            </span>
          </h3>
          <button
            type="button"
            className="tm-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="tm-modal-body" style={{ maxHeight: '70vh', overflow: 'auto' }}>
          <Row>
            <Field label="Date" required>
              <input
                className="tm-form-input"
                type="date"
                value={draft.date}
                onChange={(e) => set('date', e.target.value)}
              />
            </Field>
            <Field label="Day type">
              <select
                className="tm-form-input"
                value={draft.dayType}
                onChange={(e) =>
                  set('dayType', e.target.value as TimesheetEntry['dayType'])
                }
              >
                <option value="SWD">SWD — Standard Working Day</option>
                <option value="SCWD">SCWD — Semi-Continuous</option>
                <option value="CWD">CWD — Continuous</option>
              </select>
            </Field>
          </Row>

          <Field label="Rate kind">
            <div role="group" aria-label="Rate kind" style={{ display: 'inline-flex', border: '1px solid var(--border-card)', borderRadius: 6, overflow: 'hidden' }}>
              {(['shoot', 'prep'] as const).map((kind) => {
                const active = (draft.rateType ?? 'shoot') === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => set('rateType', kind)}
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      padding: '7px 16px',
                      border: 'none',
                      borderLeft: kind === 'prep' ? '1px solid var(--border-card)' : 'none',
                      cursor: 'pointer',
                      background: active ? 'rgba(var(--a), 0.12)' : 'var(--bg-card)',
                      color: active ? 'var(--accent)' : 'var(--text-muted)',
                      letterSpacing: '0.04em',
                      textTransform: 'capitalize' as const,
                    }}
                  >
                    {kind === 'prep' ? 'Prep day' : 'Shoot day'}
                  </button>
                );
              })}
            </div>
          </Field>

          <Row>
            <Field label="Pre-call">
              <input
                className="tm-form-input"
                type="time"
                value={draft.preCall}
                onChange={(e) => set('preCall', e.target.value)}
              />
            </Field>
            <Field label="Unit call" required>
              <input
                className="tm-form-input"
                type="time"
                value={draft.unitCall}
                onChange={(e) => set('unitCall', e.target.value)}
              />
            </Field>
          </Row>

          <Row>
            <Field label="Lunch start">
              <input
                className="tm-form-input"
                type="time"
                value={draft.lunchStart}
                onChange={(e) => set('lunchStart', e.target.value)}
              />
            </Field>
            <Field label="Lunch end">
              <input
                className="tm-form-input"
                type="time"
                value={draft.lunchEnd}
                onChange={(e) => set('lunchEnd', e.target.value)}
              />
            </Field>
          </Row>

          <Row>
            <Field label="Out of chair">
              <input
                className="tm-form-input"
                type="time"
                value={draft.outOfChair}
                onChange={(e) => set('outOfChair', e.target.value)}
              />
            </Field>
            <Field label="Wrap out" required>
              <input
                className="tm-form-input"
                type="time"
                value={draft.wrapOut}
                onChange={(e) => set('wrapOut', e.target.value)}
              />
            </Field>
          </Row>

          <Row>
            <Field label="Lunch taken (mins)">
              <input
                className="tm-form-input"
                type="number"
                inputMode="numeric"
                min={0}
                step={5}
                value={draft.lunchTaken}
                onChange={(e) => set('lunchTaken', Number(e.target.value) || 0)}
              />
            </Field>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 22 }}>
              <Toggle
                label="6th-day rate"
                checked={draft.isSixthDay}
                onChange={(v) => set('isSixthDay', v)}
              />
              <Toggle
                label="7th-day rate"
                checked={draft.isSeventhDay}
                onChange={(v) => set('isSeventhDay', v)}
              />
            </div>
          </Row>

          <Field label="Notes">
            <textarea
              className="tm-form-input"
              rows={2}
              value={draft.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Anything the producer should know — broken lunch reason, late wrap…"
            />
          </Field>

          {/* Live calculation preview */}
          {calc && (
            <div
              style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 10,
                background: 'rgba(var(--a), 0.05)',
                border: '1px solid rgba(var(--a), 0.18)',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
              }}
            >
              <Stat label="Total hrs" value={`${calc.totalHours.toFixed(1)} hrs`} />
              <Stat label="OT hrs" value={`${calc.otHours.toFixed(1)} hrs`} />
              <Stat label="Pre-call" value={`${calc.preCallHours.toFixed(1)} hrs`} />
              <Stat
                label="Earnings"
                value={`${sym}${calc.totalPay.toFixed(2)}`}
                accent
              />
            </div>
          )}
          {!canSave && (
            <p className="tm-modal-message" style={{ margin: '4px 0 0' }}>
              Add unit call + wrap out to preview hours and earnings.
            </p>
          )}
        </div>

        <div className="tm-modal-footer">
          {isExisting && onDelete && (
            <button
              type="button"
              className="tm-modal-cancel"
              style={{ marginRight: 'auto', color: '#C4522A', borderColor: 'rgba(196, 82, 42, 0.3)' }}
              onClick={() => onDelete(draft.date)}
            >
              Delete
            </button>
          )}
          <button type="button" className="tm-modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="tm-modal-confirm"
            onClick={() => onSave(draft)}
            disabled={!canSave}
            title={canSave ? undefined : 'Unit call + wrap out are required'}
          >
            {isExisting ? 'Save changes' : 'Save day'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ━━━ small layout helpers ━━━ */

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="tm-form-group">
      <span className="tm-form-label">
        {label}
        {required && <span style={{ color: 'var(--accent)', marginLeft: 4 }}>*</span>}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
    >
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`tm-toggle ${checked ? 'tm-toggle--on' : ''}`}
        aria-pressed={checked}
        aria-label={label}
      >
        <span className="tm-toggle-knob" />
      </button>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{label}</span>
    </label>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div
        style={{
          fontSize: '0.625rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '0.9375rem',
          fontWeight: 700,
          color: accent ? 'var(--accent)' : 'var(--text-primary)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
