import { useState, useEffect } from 'react';
import { onTimesheetSaveStatusChange } from '@/stores/timesheetStore';

export function TimesheetTopBar() {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    return onTimesheetSaveStatusChange(setSaveStatus);
  }, []);

  return (
    <div className="ts-top-bar">
      <h1 className="ts-top-bar-title"><span className="heading-italic">Timesheet</span>{' '}<span className="heading-regular">System</span></h1>
      <div className="ts-top-bar-actions">
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
