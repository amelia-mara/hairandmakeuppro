import {
  CURRENCY_SYMBOLS,
  type CrewMember,
  type CurrencyCode,
  type TimesheetCalculation,
  type TimesheetEntry,
} from '@/stores/timesheetStore';

/* ━━━ shared helpers ━━━ */

function addDaysIso(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function fmtDec(amount: number, currency: CurrencyCode): string {
  const sym = CURRENCY_SYMBOLS[currency] || '£';
  return `${sym}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface DayRow {
  date: string;
  entry: TimesheetEntry | null;
  calc: TimesheetCalculation | null;
  isToday: boolean;
}

function buildDay(
  crewId: string,
  date: string,
  entries: TimesheetEntry[],
  calculate: (crewId: string, entry: TimesheetEntry, previousWrapOut?: string) => TimesheetCalculation,
  todayIso: string,
): DayRow {
  const entry = entries.find((e) => e.date === date) ?? null;
  const calc =
    entry && entry.unitCall && entry.wrapOut
      ? calculate(crewId, entry, entry.previousWrapOut)
      : null;
  return { date, entry, calc, isToday: date === todayIso };
}

interface CommonProps {
  crew: CrewMember;
  weekStartDate: string;
  entries: TimesheetEntry[];
  calculateEntry: (
    crewId: string,
    entry: TimesheetEntry,
    previousWrapOut?: string,
  ) => TimesheetCalculation;
  currency: CurrencyCode;
  onAdd: (date: string) => void;
  onEdit: (entry: TimesheetEntry) => void;
}

export function WeekTimesheet({
  crew,
  weekStartDate,
  entries,
  calculateEntry,
  currency,
  onPrevWeek,
  onNextWeek,
  onJumpToToday,
  onAdd,
  onEdit,
}: CommonProps & {
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onJumpToToday: () => void;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const days = Array.from({ length: 7 }, (_, i) =>
    buildDay(crew.id, addDaysIso(weekStartDate, i), entries, calculateEntry, todayIso),
  );

  const weekEnd = addDaysIso(weekStartDate, 6);
  const startLabel = new Date(weekStartDate + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
  const endLabel = new Date(weekEnd + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const totals = days.reduce(
    (acc, d) => {
      if (d.calc) {
        acc.hours += d.calc.totalHours;
        acc.otHours += d.calc.otHours;
        acc.earnings += d.calc.totalPay;
      }
      if (d.entry?.unitCall) acc.daysLogged += 1;
      return acc;
    },
    { hours: 0, otHours: 0, earnings: 0, daysLogged: 0 },
  );

  return (
    <div className="tsr-card flush tsr-wts-card">
      {/* Week navigator */}
      <div className="tsr-wts-nav">
        <button type="button" className="tsr-wts-nav-btn" onClick={onPrevWeek} aria-label="Previous week">‹</button>
        <div className="tsr-wts-nav-label">
          <div className="tsr-wts-nav-range">{startLabel} – {endLabel}</div>
          <div className="tsr-wts-nav-sub">
            {totals.daysLogged} {totals.daysLogged === 1 ? 'day' : 'days'} ·{' '}
            {totals.hours.toFixed(1)}h · {fmtDec(totals.earnings, currency)}
          </div>
        </div>
        <button type="button" className="tsr-wts-nav-btn" onClick={onNextWeek} aria-label="Next week">›</button>
        <button type="button" className="tsr-wts-today" onClick={onJumpToToday}>Today</button>
      </div>

      {/* Header */}
      <div className="tsr-wts-table">
        <div className="tsr-wts-head">
          <div className="tsr-wts-c-date">Date</div>
          <div className="tsr-wts-c-type">Type</div>
          <div className="tsr-wts-c-pre">Pre-call</div>
          <div className="tsr-wts-c-call">Call</div>
          <div className="tsr-wts-c-lunch">Lunch</div>
          <div className="tsr-wts-c-wrap">Wrap</div>
          <div className="tsr-wts-c-hrs">Hours</div>
          <div className="tsr-wts-c-ot">OT</div>
          <div className="tsr-wts-c-earn">Earnings</div>
          <div className="tsr-wts-c-status">Status</div>
        </div>

        {days.map(({ date, entry, calc, isToday }) => {
          const d = new Date(date + 'T12:00:00');
          const dayName = d.toLocaleDateString('en-GB', { weekday: 'short' });
          const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          const filled = !!(entry && entry.unitCall);
          const lunch =
            entry?.lunchStart && entry?.lunchEnd
              ? `${entry.lunchStart}–${entry.lunchEnd}`
              : entry?.lunchTaken
              ? `${entry.lunchTaken} mins`
              : '—';
          const status =
            entry?.status === 'approved' ? 'Approved' :
            entry?.status === 'submitted' ? 'Pending' : 'Draft';
          const statusClass =
            entry?.status === 'approved' ? 'is-approved' :
            entry?.status === 'submitted' ? 'is-pending' : '';
          const dayTypeLabel =
            entry?.dayType === 'SCWD' ? 'Semi-cont' :
            entry?.dayType === 'CWD' ? 'Continuous' :
            'Shoot';

          return (
            <div
              key={date}
              className={`tsr-wts-row${isToday ? ' is-today' : ''}${filled ? ' is-filled' : ''}`}
              onClick={() => (filled && entry ? onEdit(entry) : onAdd(date))}
            >
              <div className="tsr-wts-c-date">
                <span className="tsr-wts-day-name">{dayName}</span>
                <span className="tsr-wts-day-date">{dateStr}</span>
              </div>
              <div className="tsr-wts-c-type">
                {filled ? (
                  <>
                    <span className="tsr-tag orange">{dayTypeLabel}</span>
                    {entry?.rateType === 'prep' && (
                      <span className="tsr-tag gold tsr-wts-prep-tag">Prep</span>
                    )}
                  </>
                ) : <span className="tsr-wts-muted">—</span>}
              </div>
              <div className="tsr-wts-c-pre">{entry?.preCall || <span className="tsr-wts-muted">—</span>}</div>
              <div className="tsr-wts-c-call">{entry?.unitCall || <span className="tsr-wts-muted">—</span>}</div>
              <div className="tsr-wts-c-lunch">{filled ? lunch : <span className="tsr-wts-muted">—</span>}</div>
              <div className="tsr-wts-c-wrap">{entry?.wrapOut || <span className="tsr-wts-muted">—</span>}</div>
              <div className="tsr-wts-c-hrs">
                {calc ? <strong>{calc.totalHours.toFixed(1)}</strong> : <span className="tsr-wts-muted">—</span>}
              </div>
              <div className="tsr-wts-c-ot">
                {calc && calc.otHours > 0 ? calc.otHours.toFixed(1) : <span className="tsr-wts-muted">—</span>}
              </div>
              <div className="tsr-wts-c-earn">
                {calc ? <strong>{fmtDec(calc.totalPay, currency)}</strong> : <span className="tsr-wts-muted">—</span>}
              </div>
              <div className="tsr-wts-c-status">
                {filled ? (
                  <span className={`tsr-wts-status ${statusClass}`}>{status}</span>
                ) : (
                  <span className="tsr-wts-add">+ Log</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Footer totals */}
        <div className="tsr-wts-foot">
          <div className="tsr-wts-c-date">
            <span className="tsr-wts-day-name">Total</span>
            <span className="tsr-wts-day-date">{totals.daysLogged} days</span>
          </div>
          <div className="tsr-wts-c-type" />
          <div className="tsr-wts-c-pre" />
          <div className="tsr-wts-c-call" />
          <div className="tsr-wts-c-lunch" />
          <div className="tsr-wts-c-wrap" />
          <div className="tsr-wts-c-hrs"><strong>{totals.hours.toFixed(1)}</strong></div>
          <div className="tsr-wts-c-ot">{totals.otHours > 0 ? totals.otHours.toFixed(1) : '—'}</div>
          <div className="tsr-wts-c-earn"><strong>{fmtDec(totals.earnings, currency)}</strong></div>
          <div className="tsr-wts-c-status" />
        </div>
      </div>

      <div className="tsr-wts-signoff">
        <div className="tsr-wts-signoff-line">
          <span className="tsr-wts-signoff-label">Crew Member</span>
          <span className="tsr-wts-signoff-value">{crew.name}</span>
        </div>
        <div className="tsr-wts-signoff-line">
          <span className="tsr-wts-signoff-label">Department</span>
          <span className="tsr-wts-signoff-value">{crew.department}</span>
        </div>
        <div className="tsr-wts-signoff-line">
          <span className="tsr-wts-signoff-label">Approved by</span>
          <span className="tsr-wts-signoff-blank">______________________</span>
        </div>
      </div>
    </div>
  );
}

export function MonthGrid({
  crew,
  weekStartDate,
  entries,
  calculateEntry,
  currency,
  onJumpToWeek,
  onJumpToToday,
  onAdd,
  onEdit,
}: CommonProps & {
  onJumpToWeek: (mondayIso: string) => void;
  onJumpToToday: () => void;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  // Anchor on the middle of the visible week so a back/forward jump
  // doesn't accidentally flip into a neighbouring month.
  const anchor = new Date(addDaysIso(weekStartDate, 3) + 'T00:00:00');
  const year = anchor.getFullYear();
  const month = anchor.getMonth();

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const firstDay = first.getDay();
  const startOffset = firstDay === 0 ? -6 : 1 - firstDay;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() + startOffset);
  const lastDay = last.getDay();
  const endOffset = lastDay === 0 ? 0 : 7 - lastDay;
  const gridEnd = new Date(last);
  gridEnd.setDate(last.getDate() + endOffset);
  const totalDays = Math.round((gridEnd.getTime() - gridStart.getTime()) / 86_400_000) + 1;
  const startIso = gridStart.toISOString().slice(0, 10);

  const days = Array.from({ length: totalDays }, (_, i) =>
    buildDay(crew.id, addDaysIso(startIso, i), entries, calculateEntry, todayIso),
  );

  const monthLabel = anchor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const weeks: DayRow[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const monthTotals = days.reduce(
    (acc, d) => {
      if (d.calc) {
        acc.hours += d.calc.totalHours;
        acc.earnings += d.calc.totalPay;
      }
      if (d.entry?.unitCall) acc.daysLogged += 1;
      return acc;
    },
    { hours: 0, earnings: 0, daysLogged: 0 },
  );

  const stepMonth = (delta: -1 | 1) => {
    const next = new Date(year, month + delta, 1);
    const day = next.getDay();
    const off = day === 0 ? -6 : 1 - day;
    const monday = new Date(next);
    monday.setDate(next.getDate() + off);
    onJumpToWeek(monday.toISOString().slice(0, 10));
  };

  return (
    <div className="tsr-card flush tsr-mth-card">
      <div className="tsr-wts-nav">
        <button type="button" className="tsr-wts-nav-btn" onClick={() => stepMonth(-1)} aria-label="Previous month">‹</button>
        <div className="tsr-wts-nav-label">
          <div className="tsr-wts-nav-range">{monthLabel}</div>
          <div className="tsr-wts-nav-sub">
            {monthTotals.daysLogged} {monthTotals.daysLogged === 1 ? 'day' : 'days'} ·{' '}
            {monthTotals.hours.toFixed(1)}h · {fmtDec(monthTotals.earnings, currency)}
          </div>
        </div>
        <button type="button" className="tsr-wts-nav-btn" onClick={() => stepMonth(1)} aria-label="Next month">›</button>
        <button type="button" className="tsr-wts-today" onClick={onJumpToToday}>Today</button>
      </div>

      {/* Weekday header */}
      <div className="tsr-mth-head">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="tsr-mth-head-cell">{d}</div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((week, wi) => {
        const weekStart = week[0]?.date;
        return (
          <div key={wi} className="tsr-mth-week">
            {week.map(({ date, entry, calc, isToday }) => {
              const d = new Date(date + 'T12:00:00');
              const dayNumber = d.getDate();
              const inMonth = d.getMonth() === month;
              const filled = !!(entry && entry.unitCall);
              const status = entry?.status;
              return (
                <button
                  key={date}
                  type="button"
                  className={`tsr-mth-day${isToday ? ' is-today' : ''}${filled ? ' is-filled' : ''}${inMonth ? '' : ' is-outside'}`}
                  onClick={() => (filled && entry ? onEdit(entry) : onAdd(date))}
                  title={d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                >
                  <div className="tsr-mth-day-num">{dayNumber}</div>
                  {filled && entry ? (
                    <div className="tsr-mth-day-body">
                      <div className="tsr-mth-day-times">
                        {entry.unitCall}–{entry.wrapOut || '—'}
                      </div>
                      {calc && (
                        <div className="tsr-mth-day-hrs">{calc.totalHours.toFixed(1)}h</div>
                      )}
                      <span className={`tsr-mth-status ${
                        status === 'approved' ? 'is-approved' :
                        status === 'submitted' ? 'is-pending' : ''
                      }`} />
                    </div>
                  ) : null}
                </button>
              );
            })}
            {/* Quick jump back to Week view for this row */}
            {weekStart && (
              <button
                type="button"
                className="tsr-mth-week-jump"
                title="Open week in Week view"
                onClick={() => onJumpToWeek(weekStart)}
              >
                ›
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
