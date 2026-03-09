import { useState } from 'react';
import { ReceiptUploadZone } from '../receipts/ReceiptUploadZone';
import { ReceiptConfirmPanel, type ConfirmData } from '../receipts/ReceiptConfirmPanel';
import { ExpenseTable } from '../receipts/ExpenseTable';
import { ReceiptLightbox } from '../receipts/ReceiptLightbox';
import type { Expense, BudgetCategory, CurrencyCode } from '@/stores/budgetStore';

interface ReceiptsAndSpendTabProps {
  expenses: Expense[];
  categories: BudgetCategory[];
  currency: CurrencyCode;
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onUpdateExpense: (id: string, updates: Partial<Expense>) => void;
  onDeleteExpense: (id: string) => void;
}

export function ReceiptsAndSpendTab({
  expenses,
  categories,
  currency,
  onAddExpense,
  onDeleteExpense,
}: ReceiptsAndSpendTabProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [isManual, setIsManual] = useState(false);
  const [uploadedImageUri, setUploadedImageUri] = useState<string | undefined>();
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const handleFileSelected = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImageUri(reader.result as string);
      setIsManual(false);
      setPanelOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleManualAdd = () => {
    setUploadedImageUri(undefined);
    setIsManual(true);
    setPanelOpen(true);
  };

  const handleConfirm = (data: ConfirmData) => {
    onAddExpense({
      date: data.date,
      supplier: data.supplier,
      category: data.category,
      lineItemId: data.lineItemId,
      vat: data.vat,
      amount: data.amount,
      receiptImageUri: data.imageUri,
    });
    setPanelOpen(false);
    setUploadedImageUri(undefined);
  };

  const handleDiscard = () => {
    setPanelOpen(false);
    setUploadedImageUri(undefined);
  };

  return (
    <div className="budget-receipts-tab" style={{ position: 'relative' }}>
      <ReceiptUploadZone
        onFileSelected={handleFileSelected}
        onApiSettings={() => {}}
      />

      <ExpenseTable
        expenses={expenses}
        categories={categories}
        currency={currency}
        onAddManual={handleManualAdd}
        onEdit={() => {}}
        onDelete={onDeleteExpense}
        onReceiptClick={(uri) => setLightboxImage(uri)}
      />

      <ReceiptConfirmPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onConfirm={handleConfirm}
        onDiscard={handleDiscard}
        imageUri={uploadedImageUri}
        categories={categories}
        currency={currency}
        isManual={isManual}
      />

      {lightboxImage && (
        <ReceiptLightbox
          imageUri={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
}
