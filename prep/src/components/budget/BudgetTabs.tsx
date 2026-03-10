import { useState, useEffect } from 'react';
import { onSaveStatusChange } from '@/stores/budgetStore';

interface BudgetTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'proposal', label: 'Budget Proposal' },
  { id: 'receipts', label: 'Receipts & Spend' },
  { id: 'compare', label: 'Compare' },
];

export function BudgetTabs({ activeTab, onTabChange }: BudgetTabsProps) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    return onSaveStatusChange(setSaveStatus);
  }, []);

  return (
    <div className="budget-tabs">
      <h3 className="budget-tabs-title">Budget System</h3>
      <div className="budget-tabs-nav">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`budget-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="budget-tabs-actions">
        <button className="btn-ghost" onClick={() => {}}>
          <ImportIcon />
          Import CSV
        </button>
        <button className="btn-ghost" onClick={() => {}}>
          <ExportIcon />
          Export
        </button>
        {saveStatus !== 'idle' && (
          <div className="budget-save-indicator" style={{ opacity: 1, transition: 'opacity 0.3s ease' }}>
            {saveStatus === 'saving' && (
              <>
                <span className="budget-save-spinner" />
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

function ImportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
