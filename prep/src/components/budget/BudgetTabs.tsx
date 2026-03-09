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
  return (
    <div className="budget-tabs">
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
  );
}
