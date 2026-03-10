import { useState, useCallback, useRef } from 'react';
import { BudgetTabs } from '@/components/budget/BudgetTabs';
import { BudgetSummarySidebar } from '@/components/budget/BudgetSummarySidebar';
import { OverviewTab } from '@/components/budget/tabs/OverviewTab';
import { ProposalTab } from '@/components/budget/tabs/ProposalTab';
import { ReceiptsAndSpendTab, type ReceiptsAndSpendTabHandle } from '@/components/budget/tabs/ReceiptsAndSpendTab';
import { CompareTab } from '@/components/budget/tabs/CompareTab';
import { ReceiptConfirmPanel, type ConfirmData } from '@/components/budget/receipts/ReceiptConfirmPanel';
import { useBudgetStore, type BudgetLineItem } from '@/stores/budgetStore';
import { useTimesheetStore } from '@/stores/timesheetStore';

interface BudgetProps {
  projectId: string;
}

export function Budget({ projectId }: BudgetProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarExpenseOpen, setSidebarExpenseOpen] = useState(false);
  const receiptsTabRef = useRef<ReceiptsAndSpendTabHandle>(null);

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

  // Timesheet store for crew cost data
  const tsStore = useTimesheetStore(projectId);
  const crew = tsStore(s => s.crew);
  const selectedWeekStart = tsStore(s => s.selectedWeekStart);
  const getTotalLabourCost = tsStore(s => s.getTotalLabourCost);
  const hasTimesheetData = crew.length > 0;
  const totalCrewCost = hasTimesheetData ? getTotalLabourCost(selectedWeekStart) : 0;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const handleUpdateItem = useCallback((categoryId: string, itemId: string, field: string, value: string | number) => {
    updateLineItem(categoryId, itemId, { [field]: value } as Partial<BudgetLineItem>);
  }, [updateLineItem]);

  // Sidebar: Add Expense opens confirm panel without switching tabs
  const handleSidebarAddExpense = useCallback(() => {
    setSidebarExpenseOpen(true);
  }, []);

  // Sidebar: Upload Receipt switches to receipts tab and triggers upload
  const handleSidebarUploadReceipt = useCallback(() => {
    setActiveTab('receipts');
    // Slight delay to allow the tab to render before triggering upload
    setTimeout(() => {
      receiptsTabRef.current?.triggerUpload();
    }, 100);
  }, []);

  const handleSidebarExpenseConfirm = useCallback((data: ConfirmData) => {
    addExpense({
      date: data.date,
      supplier: data.supplier,
      category: data.category,
      lineItemId: data.lineItemId,
      vat: data.vat,
      amount: data.amount,
      receiptImageUri: data.imageUri,
    });
    setSidebarExpenseOpen(false);
  }, [addExpense]);

  return (
    <div className="budget-page">
      <BudgetTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="budget-page-body">
        <BudgetSummarySidebar
          totalBudget={totalBudget}
          totalSpent={totalSpent}
          remaining={remaining}
          percentUsed={percentUsed}
          categories={categories}
          perCategoryBudget={perCategoryBudget}
          perCategorySpend={perCategorySpend}
          currency={currency}
          isLTD={isLTD}
          totalCrewCost={totalCrewCost}
          hasTimesheetData={hasTimesheetData}
          onAddExpense={handleSidebarAddExpense}
          onUploadReceipt={handleSidebarUploadReceipt}
        />

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
              ref={receiptsTabRef}
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
      </div>

      {/* Sidebar Add Expense panel — opens from any tab */}
      <ReceiptConfirmPanel
        open={sidebarExpenseOpen}
        onClose={() => setSidebarExpenseOpen(false)}
        onConfirm={handleSidebarExpenseConfirm}
        onDiscard={() => setSidebarExpenseOpen(false)}
        categories={categories}
        currency={currency}
        isManual
      />

      {/* Toast notification */}
      {toast && (
        <div className="budget-toast">
          {toast}
        </div>
      )}
    </div>
  );
}
