import { useState } from 'react';
import { BudgetCategorySection } from '../proposal/BudgetCategory';
import { AddCategoryModal } from '../proposal/AddCategoryModal';
import { CURRENCY_SYMBOLS, type BudgetCategory, type CurrencyCode } from '@/stores/budgetStore';

interface ProposalTabProps {
  categories: BudgetCategory[];
  currency: CurrencyCode;
  totalBudget: number;
  perCategoryBudget: Record<string, number>;
  perCategorySpend: Record<string, number>;
  getItemTotal: (item: BudgetCategory['items'][0]) => number;
  onAddCategory: (name: string) => void;
  onAddItem: (categoryId: string) => void;
  onUpdateItem: (categoryId: string, itemId: string, field: string, value: string | number) => void;
  onDeleteItem: (categoryId: string, itemId: string) => void;
  onCopyItem: (fromCategoryId: string, itemId: string, toCategoryId: string) => void;
  onShowToast: (message: string) => void;
}

export function ProposalTab({
  categories,
  currency,
  totalBudget,
  perCategoryBudget,
  perCategorySpend,
  getItemTotal,
  onAddCategory,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onCopyItem,
  onShowToast,
}: ProposalTabProps) {
  const [showAddCategory, setShowAddCategory] = useState(false);
  const sym = CURRENCY_SYMBOLS[currency];

  return (
    <div className="budget-proposal">
      <div className="budget-proposal-header">
        <div>
          <span className="budget-section-label" style={{ marginBottom: 0 }}>BUDGET PROPOSAL</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="budget-grand-total">
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>Grand Total</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--gold-primary)', letterSpacing: '-0.01em' }}>
              {sym}{totalBudget.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <button className="btn-action-gold" onClick={() => setShowAddCategory(true)}>
            + Add Category
          </button>
        </div>
      </div>

      {categories.map(cat => (
        <BudgetCategorySection
          key={cat.id}
          category={cat}
          categories={categories}
          currency={currency}
          categoryTotal={perCategoryBudget[cat.id] || 0}
          categorySpent={perCategorySpend[cat.id] || 0}
          getItemTotal={getItemTotal}
          onAddItem={() => onAddItem(cat.id)}
          onUpdateItem={(itemId, field, value) => onUpdateItem(cat.id, itemId, field, value)}
          onDeleteItem={(itemId) => onDeleteItem(cat.id, itemId)}
          onCopyItem={(itemId, toCatId) => {
            onCopyItem(cat.id, itemId, toCatId);
            const targetCat = categories.find(c => c.id === toCatId);
            onShowToast(`Copied to ${targetCat?.name || 'category'}`);
          }}
        />
      ))}

      <AddCategoryModal
        open={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        onAdd={onAddCategory}
      />
    </div>
  );
}
