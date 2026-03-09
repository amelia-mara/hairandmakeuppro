import { useState, useCallback } from 'react';
import { TimesheetTopBar } from '@/components/timesheet/TimesheetTopBar';
import { TimesheetTabs } from '@/components/timesheet/TimesheetTabs';
import { TimesheetSidebar } from '@/components/timesheet/TimesheetSidebar';
import { CrewSettingsTab } from '@/components/timesheet/tabs/CrewSettingsTab';
import { WeeklyViewTab } from '@/components/timesheet/tabs/WeeklyViewTab';
import { ExportTab } from '@/components/timesheet/tabs/ExportTab';
import { useTimesheetStore } from '@/stores/timesheetStore';

interface TimesheetProps {
  projectId: string;
}

export function Timesheet({ projectId }: TimesheetProps) {
  const [activeTab, setActiveTab] = useState('crew');
  const [toast, setToast] = useState<string | null>(null);

  const store = useTimesheetStore(projectId);
  const production = store(s => s.production);
  const crew = store(s => s.crew);
  const selectedCrewId = store(s => s.selectedCrewId);
  const selectedWeekStart = store(s => s.selectedWeekStart);
  const setProduction = store(s => s.setProduction);
  const addCrew = store(s => s.addCrew);
  const updateCrew = store(s => s.updateCrew);
  const removeCrew = store(s => s.removeCrew);
  const updateCrewRateCard = store(s => s.updateCrewRateCard);
  const getEntry = store(s => s.getEntry);
  const saveEntry = store(s => s.saveEntry);
  const setSelectedCrew = store(s => s.setSelectedCrew);
  const setSelectedWeekStart = store(s => s.setSelectedWeekStart);
  const navigateWeek = store(s => s.navigateWeek);
  const calculateEntry = store(s => s.calculateEntry);
  const getPreviousWrapOut = store(s => s.getPreviousWrapOut);
  const getCrewWeekSummary = store(s => s.getCrewWeekSummary);
  const getTotalLabourCost = store(s => s.getTotalLabourCost);
  const getLTDSavings = store(s => s.getLTDSavings);
  const getBudgetImpact = store(s => s.getBudgetImpact);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  return (
    <div className="ts-page">
      <TimesheetTopBar />
      <TimesheetTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="ts-page-body">
        <TimesheetSidebar
          crew={crew}
          production={production}
          selectedWeekStart={selectedWeekStart}
          getCrewWeekSummary={getCrewWeekSummary}
        />

        <div className="ts-content">
          {activeTab === 'crew' && (
            <CrewSettingsTab
              production={production}
              crew={crew}
              selectedCrewId={selectedCrewId}
              onSetProduction={setProduction}
              onAddCrew={addCrew}
              onUpdateCrew={updateCrew}
              onRemoveCrew={removeCrew}
              onUpdateRateCard={updateCrewRateCard}
              onSelectCrew={setSelectedCrew}
              onShowToast={showToast}
            />
          )}
          {activeTab === 'weekly' && (
            <WeeklyViewTab
              crew={crew}
              selectedCrewId={selectedCrewId}
              selectedWeekStart={selectedWeekStart}
              production={production}
              onSelectCrew={setSelectedCrew}
              onSetWeekStart={setSelectedWeekStart}
              onNavigateWeek={navigateWeek}
              getEntry={getEntry}
              saveEntry={saveEntry}
              calculateEntry={calculateEntry}
              getPreviousWrapOut={getPreviousWrapOut}
              getCrewWeekSummary={getCrewWeekSummary}
            />
          )}
          {activeTab === 'export' && (
            <ExportTab
              crew={crew}
              production={production}
              selectedWeekStart={selectedWeekStart}
              getCrewWeekSummary={getCrewWeekSummary}
              getTotalLabourCost={getTotalLabourCost}
              getLTDSavings={getLTDSavings}
              getBudgetImpact={getBudgetImpact}
              onShowToast={showToast}
            />
          )}
        </div>
      </div>

      {toast && (
        <div className="ts-toast">{toast}</div>
      )}
    </div>
  );
}
