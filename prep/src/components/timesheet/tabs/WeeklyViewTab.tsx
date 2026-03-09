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

  if (crew.length === 0) {
    return (
      <div className="ts-empty-state">
        <p>Add crew members in the Crew & Settings tab to begin</p>
      </div>
    );
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(selectedWeekStart, i);
    return { date, dayName: getDayName(date), shortDate: formatShortDate(date) };
  });

  const weekSummary = selectedCrewId ? getCrewWeekSummary(selectedCrewId, selectedWeekStart) : null;

  return (
    <div className="ts-weekly-tab">
      <div className="ts-weekly-header">
        <WeekSelector
          weekStart={selectedWeekStart}
          onNavigate={onNavigateWeek}
        />
        <WeeklyCrewSelector
          crew={crew}
          selectedCrewId={selectedCrewId}
          onSelectCrew={onSelectCrew}
        />
      </div>

      {selectedCrew && (
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
      )}
    </div>
  );
}
