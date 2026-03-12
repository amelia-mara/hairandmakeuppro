import { useState, useEffect } from 'react';
import { onTimesheetSaveStatusChange } from '@/stores/timesheetStore';

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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    return onTimesheetSaveStatusChange(setSaveStatus);
  }, []);

  return (
    <div className="ts-tabs">
      <div className="ts-tabs-sidebar-section">
        <h3 className="ts-tabs-overview-title">Overview</h3>
        <span className="ts-tabs-week-label">This Week</span>
      </div>
      <div className="ts-tabs-separator" />
      <div className="ts-tabs-nav">
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
      <div className="ts-tabs-actions">
        {saveStatus !== 'idle' && (
          <div className="ts-save-indicator" style={{ opacity: 1, transition: 'opacity 0.3s ease' }}>
            {saveStatus === 'saving' && (
              <>
                <span className="ts-save-spinner" />
                <span>Saving...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Saved</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
