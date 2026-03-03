import { useState, useMemo } from 'react';
import {
  Clock,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button, Card, Badge } from '@/components/ui';
import { useTimesheetStore } from '@/stores';
import { formatCurrency } from '@/utils/helpers';
import { getWeekDates, formatDayShort, getISOWeekStart } from '@/utils/formatters';

export default function Timesheet() {
  const { entries, getWeekSummary } = useTimesheetStore();

  const [weekStart, setWeekStart] = useState(() => getISOWeekStart(new Date()));

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const summary = useMemo(
    () => getWeekSummary(weekStart),
    [weekStart, entries, getWeekSummary]
  );

  const navigateWeek = (direction: -1 | 1) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + direction * 7);
    setWeekStart(d.toISOString().split('T')[0]);
  };

  const weekEnd = weekDates[6];
  const formatWeekRange = () => {
    const s = new Date(weekStart);
    const e = new Date(weekEnd);
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
    return `${fmt(s)} \u2013 ${fmt(e)}, ${s.getFullYear()}`;
  };

  /* Get unique people for this week */
  const weekEntries = entries.filter((e) => weekDates.includes(e.date));
  const people = useMemo(() => {
    const names = new Set(weekEntries.map((e) => e.personName));
    return Array.from(names);
  }, [weekEntries]);

  const getEntryForPersonDay = (person: string, date: string) =>
    weekEntries.find((e) => e.personName === person && e.date === date);

  const getPersonTotal = (person: string) => {
    const personEntries = weekEntries.filter((e) => e.personName === person);
    return {
      hours: personEntries.reduce((s, e) => s + e.hoursWorked, 0),
      overtime: personEntries.reduce((s, e) => s + e.overtime, 0),
      cost: personEntries.reduce(
        (s, e) =>
          s + e.hoursWorked * e.hourlyRate + e.overtime * e.hourlyRate * 1.5,
        0
      ),
    };
  };

  const handleExport = () => {
    /* TODO: Wire up export service */
  };

  /* Day column labels with highlighting for today */
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary tracking-wide">
          TIMESHEET
        </h1>
        <Button
          variant="secondary"
          icon={<Download className="w-4 h-4" />}
          onClick={handleExport}
        >
          Export
        </Button>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => navigateWeek(-1)}
          className="p-2 text-text-secondary hover:text-text-primary rounded hover:bg-surface-hover transition-colors-fast"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-lg font-medium text-text-primary min-w-[280px] text-center">
          {formatWeekRange()}
        </span>
        <button
          onClick={() => navigateWeek(1)}
          className="p-2 text-text-secondary hover:text-text-primary rounded hover:bg-surface-hover transition-colors-fast"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Timesheet grid */}
      <Card padding="sm" className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="text-left py-3 px-3 text-text-muted font-medium text-xs uppercase tracking-wider w-44">
                Team Member
              </th>
              {weekDates.map((date) => (
                <th
                  key={date}
                  className={`text-center py-3 px-2 font-medium text-xs uppercase tracking-wider w-16 ${
                    date === today
                      ? 'text-gold'
                      : 'text-text-muted'
                  }`}
                >
                  <div>{formatDayShort(date)}</div>
                  <div className="text-[10px] font-normal mt-0.5 normal-case">
                    {new Date(date).getDate()}
                  </div>
                </th>
              ))}
              <th className="text-right py-3 px-3 text-text-muted font-medium text-xs uppercase tracking-wider w-20">
                Total
              </th>
              <th className="text-right py-3 px-3 text-text-muted font-medium text-xs uppercase tracking-wider w-24">
                Cost
              </th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => {
              const totals = getPersonTotal(person);
              const role =
                weekEntries.find((e) => e.personName === person)?.role || '';
              return (
                <tr
                  key={person}
                  className="border-b border-border-subtle hover:bg-surface-hover transition-colors-fast"
                >
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-text-primary">
                      {person}
                    </div>
                    {role && (
                      <div className="text-xs text-text-muted">{role}</div>
                    )}
                  </td>
                  {weekDates.map((date) => {
                    const entry = getEntryForPersonDay(person, date);
                    return (
                      <td
                        key={date}
                        className={`text-center py-2.5 px-2 ${
                          date === today ? 'bg-gold/5' : ''
                        }`}
                      >
                        {entry ? (
                          <div>
                            <span className="text-text-primary font-medium">
                              {entry.hoursWorked}
                            </span>
                            {entry.overtime > 0 && (
                              <div className="text-[10px] text-warning">
                                +{entry.overtime} OT
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-text-muted">&mdash;</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-right py-2.5 px-3">
                    <span className="font-medium text-text-primary">
                      {totals.hours}h
                    </span>
                    {totals.overtime > 0 && (
                      <div className="text-[10px] text-warning">
                        +{totals.overtime}h OT
                      </div>
                    )}
                  </td>
                  <td className="text-right py-2.5 px-3 font-medium text-text-primary">
                    {formatCurrency(totals.cost)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {people.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted">
            <Clock className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">No timesheet entries for this week.</p>
            <p className="text-xs mt-1">
              Add entries to begin tracking team hours.
            </p>
          </div>
        )}
      </Card>

      {/* Week summary */}
      {people.length > 0 && (
        <Card padding="lg">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
            Week Summary
          </p>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-text-muted mb-1">Total Hours</p>
              <p className="text-2xl font-bold text-text-primary">
                {summary.totalHours}h
              </p>
              {summary.totalOvertime > 0 && (
                <p className="text-xs text-warning mt-0.5">
                  {summary.totalOvertime}h overtime
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">Total Cost</p>
              <p className="text-2xl font-bold text-gold">
                {formatCurrency(summary.totalCost)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-1">Team Members</p>
              <p className="text-2xl font-bold text-text-primary">
                {people.length}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
