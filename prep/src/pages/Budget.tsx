import { useState, useCallback } from 'react';
import { BudgetTopBar } from '@/components/budget/BudgetTopBar';
import { BudgetTabs } from '@/components/budget/BudgetTabs';
import { OverviewTab } from '@/components/budget/tabs/OverviewTab';
import { ProposalTab } from '@/components/budget/tabs/ProposalTab';
import { ReceiptsAndSpendTab } from '@/components/budget/tabs/ReceiptsAndSpendTab';
import { CompareTab } from '@/components/budget/tabs/CompareTab';
import { useBudgetStore, type BudgetLineItem } from '@/stores/budgetStore';

interface BudgetProps {
  projectId: string;
}

export function Budget({ projectId }: BudgetProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [toast, setToast] = useState<string | null>(null);

  const store = useBudgetStore(projectId);
  const categories = store(s => s.categories);
  const expenses = store(s => s.expenses);
  const isLTD = store(s => s.isLTD);
  const currency = store(s => s.currency);
  const setIsLTD = store(s => s.setIsLTD);
  const addCategory = store(s => s.addCategory);
  const addLineItem = store(s => s.addLineItem);
  const updateLineItem = store(s => s.updateLineItem);
  const removeLineItem = store(s => s.removeLineItem);
  const copyLineItem = store(s => s.copyLineItem);
  const addExpense = store(s => s.addExpense);
  const updateExpense = store(s => s.updateExpense);
  const deleteExpense = store(s => s.deleteExpense);
  const getLineItemTotal = store(s => s.getLineItemTotal);
  const getTotalBudget = store(s => s.getTotalBudget);
  const getTotalSpent = store(s => s.getTotalSpent);
  const getRemaining = store(s => s.getRemaining);
  const getBudgetUsedPercent = store(s => s.getBudgetUsedPercent);
  const getPerCategoryBudget = store(s => s.getPerCategoryBudget);
  const getPerCategorySpend = store(s => s.getPerCategorySpend);

  const totalBudget = getTotalBudget();
  const totalSpent = getTotalSpent();
  const remaining = getRemaining();
  const percentUsed = getBudgetUsedPercent();
  const perCategoryBudget = getPerCategoryBudget();
  const perCategorySpend = getPerCategorySpend();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const handleUpdateItem = useCallback((categoryId: string, itemId: string, field: string, value: string | number) => {
    updateLineItem(categoryId, itemId, { [field]: value } as Partial<BudgetLineItem>);
  }, [updateLineItem]);

  return (
    <div className="budget-page">
      <BudgetTopBar
        currency={currency}
        onImportCSV={() => {}}
        onExport={() => {}}
      />
      <BudgetTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="budget-content">
        {activeTab === 'overview' && (
          <OverviewTab
            totalBudget={totalBudget}
            totalSpent={totalSpent}
            remaining={remaining}
            percentUsed={percentUsed}
            categories={categories}
            perCategoryBudget={perCategoryBudget}
            perCategorySpend={perCategorySpend}
            isLTD={isLTD}
            onToggleLTD={setIsLTD}
            currency={currency}
          />
        )}
        {activeTab === 'proposal' && (
          <ProposalTab
            categories={categories}
            currency={currency}
            totalBudget={totalBudget}
            perCategoryBudget={perCategoryBudget}
            perCategorySpend={perCategorySpend}
            getItemTotal={getLineItemTotal}
            onAddCategory={addCategory}
            onAddItem={addLineItem}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={removeLineItem}
            onCopyItem={copyLineItem}
            onShowToast={showToast}
          />
        )}
        {activeTab === 'receipts' && (
          <ReceiptsAndSpendTab
            expenses={expenses}
            categories={categories}
            currency={currency}
            onAddExpense={addExpense}
            onUpdateExpense={updateExpense}
            onDeleteExpense={deleteExpense}
          />
        )}
        {activeTab === 'compare' && (
          <CompareTab
            categories={categories}
            perCategoryBudget={perCategoryBudget}
            perCategorySpend={perCategorySpend}
            totalBudget={totalBudget}
            totalSpent={totalSpent}
            currency={currency}
          />
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="budget-toast">
          {toast}
        </div>
      )}
    </div>
  );
}
