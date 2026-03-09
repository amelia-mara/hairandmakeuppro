import { WeekSelector } from '../weekly/WeekSelector';
import { WeeklyCrewSelector } from '../weekly/WeeklyCrewSelector';
import { DayCard } from '../weekly/DayCard';
import { WeekSummaryCard } from '../weekly/WeekSummaryCard';
import { addDays, getDayName, formatShortDate } from '@/utils/bectuCalculations';
import type {
  CrewMember,
  TimesheetEntry,
  TimesheetCalculation,
  WeekSummary,
  ProductionSettings,
} from '@/stores/timesheetStore';

interface WeeklyViewTabProps {
  crew: CrewMember[];
  selectedCrewId: string | null;
  selectedWeekStart: string;
  production: ProductionSettings;
  onSelectCrew: (crewId: string | null) => void;
  onSetWeekStart: (date: string) => void;
  onNavigateWeek: (direction: 'prev' | 'next') => void;
  getEntry: (crewId: string, date: string) => TimesheetEntry;
  saveEntry: (crewId: string, entry: TimesheetEntry) => void;
  calculateEntry: (crewId: string, entry: TimesheetEntry, previousWrapOut?: string) => TimesheetCalculation;
  getPreviousWrapOut: (crewId: string, date: string) => string | undefined;
  getCrewWeekSummary: (crewId: string, weekStartDate: string) => WeekSummary;
}

export function WeeklyViewTab({
  crew,
  selectedCrewId,
  selectedWeekStart,
  production,
  onSelectCrew,
  onNavigateWeek,
  getEntry,
  saveEntry,
  calculateEntry,
  getPreviousWrapOut,
  getCrewWeekSummary,
}: WeeklyViewTabProps) {
  const selectedCrew = crew.find(c => c.id === selectedCrewId);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(selectedWeekStart, i);
    return { date, dayName: getDayName(date), shortDate: formatShortDate(date) };
  });

  const weekSummary = selectedCrewId ? getCrewWeekSummary(selectedCrewId, selectedWeekStart) : null;
  const isEmpty = crew.length === 0;

  return (
    <div className="ts-weekly-tab">
      <div className="ts-weekly-header">
        <WeekSelector
          weekStart={selectedWeekStart}
          onNavigate={onNavigateWeek}
        />
        {!isEmpty && (
          <WeeklyCrewSelector
            crew={crew}
            selectedCrewId={selectedCrewId}
            onSelectCrew={onSelectCrew}
          />
        )}
      </div>

      {isEmpty ? (
        <div className="ts-weekly-grid ts-preview-grid">
          {days.map(day => {
            const isWeekend = day.dayName === 'Sat' || day.dayName === 'Sun';
            return (
              <div key={day.date} className={`ts-day-card ${isWeekend ? 'ts-day-card-weekend' : ''} ts-day-card-preview`}>
                <div className="ts-day-header">
                  <div className="ts-day-info">
                    <span className="ts-day-name">{day.dayName}</span>
                    <span className="ts-day-date">{day.shortDate}</span>
                  </div>
                </div>
                <div className="ts-day-fields">
                  <div className="ts-time-row">
                    <div className="ts-time-field">
                      <label className="ts-time-label">Pre-Call</label>
                      <input className="ts-time-input" type="time" disabled />
                    </div>
                    <div className="ts-time-field">
                      <label className="ts-time-label">Unit Call</label>
                      <input className="ts-time-input" type="time" disabled />
                    </div>
                    <div className="ts-time-field">
                      <label className="ts-time-label">Lunch</label>
                      <input className="ts-time-input" type="time" disabled />
                    </div>
                    <div className="ts-time-field">
                      <label className="ts-time-label">Out of Chair</label>
                      <input className="ts-time-input" type="time" disabled />
                    </div>
                    <div className="ts-time-field">
                      <label className="ts-time-label">Wrap Out</label>
                      <input className="ts-time-input" type="time" disabled />
                    </div>
                  </div>
                  <div className="ts-day-options">
                    <select className="ts-select ts-select-sm" disabled><option>SWD</option></select>
                    <label className="ts-checkbox-label"><input type="checkbox" disabled /> 6th Day</label>
                    <label className="ts-checkbox-label"><input type="checkbox" disabled /> 7th Day</label>
                  </div>
                </div>
                <div className="ts-day-notes">
                  <input className="ts-notes-input" type="text" disabled placeholder="Notes..." />
                </div>
              </div>
            );
          })}
          <div className="ts-preview-overlay ts-preview-overlay-weekly">
            <p>Add crew members in the Crew & Settings tab to start logging time</p>
          </div>
        </div>
      ) : selectedCrew ? (
        <div className="ts-weekly-grid">
          {days.map(day => {
            const entry = getEntry(selectedCrew.id, day.date);
            const prevWrap = getPreviousWrapOut(selectedCrew.id, day.date);
            const calc = calculateEntry(selectedCrew.id, entry, prevWrap);
            return (
              <DayCard
                key={day.date}
                dayName={day.dayName}
                shortDate={day.shortDate}
                entry={entry}
                calculation={calc}
                currency={production.currency}
                onSave={(updated) => saveEntry(selectedCrew.id, updated)}
              />
            );
          })}
          {weekSummary && (
            <WeekSummaryCard
              summary={weekSummary}
              currency={production.currency}
              crewName={selectedCrew.name}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
