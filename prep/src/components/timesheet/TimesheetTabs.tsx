interface TimesheetTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TABS = [
  { id: 'crew', label: 'Crew & Settings' },
  { id: 'weekly', label: 'Weekly View' },
  { id: 'export', label: 'Export' },
];

export function TimesheetTabs({ activeTab, onTabChange }: TimesheetTabsProps) {
  return (
    <div className="ts-tabs">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`ts-tab ${activeTab === tab.id ? 'ts-tab-active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
