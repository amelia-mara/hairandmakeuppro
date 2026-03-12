import { BudgetLineItemRow } from './BudgetLineItem';
import { CURRENCY_SYMBOLS, type BudgetCategory as CategoryType, type CurrencyCode } from '@/stores/budgetStore';

interface BudgetCategoryProps {
  category: CategoryType;
  categories: CategoryType[];
  currency: CurrencyCode;
  categoryTotal: number;
  categorySpent: number;
  getItemTotal: (item: CategoryType['items'][0]) => number;
  onAddItem: () => void;
  onUpdateItem: (itemId: string, field: string, value: string | number) => void;
  onDeleteItem: (itemId: string) => void;
  onCopyItem: (itemId: string, toCategoryId: string) => void;
}

export function BudgetCategorySection({
  category,
  categories,
  currency,
  categoryTotal,
  categorySpent,
  getItemTotal,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onCopyItem,
}: BudgetCategoryProps) {
  const sym = CURRENCY_SYMBOLS[currency];
  const percentSpent = categoryTotal > 0 ? (categorySpent / categoryTotal) * 100 : 0;
  const isOver = percentSpent >= 100;
  const isAtRisk = percentSpent >= 75 && percentSpent < 100;

  const nameColor = isOver ? '#ef4444' : isAtRisk ? '#f59e0b' : 'var(--text-primary)';
  const totalColor = isOver ? '#ef4444' : isAtRisk ? '#f59e0b' : 'var(--gold-primary)';

  return (
    <div
      className="budget-category-section"
      style={{
        borderLeft: isOver ? '3px solid #ef4444' : 'none',
      }}
    >
      <div className="budget-category-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(isOver || isAtRisk) && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={nameColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          )}
          <span style={{ color: nameColor, fontWeight: 600 }}>{category.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: totalColor, fontWeight: isOver ? 700 : 600, fontSize: '1.125rem' }}>
            {sym}{categoryTotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <button className="btn-action-gold" onClick={onAddItem}>+ Add Item</button>
        </div>
      </div>

      {category.items.length === 0 ? (
        <div className="budget-empty-category">
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            No items yet — click "Add Item" to start
          </span>
        </div>
      ) : (
        <>
          <div className="budget-line-item-header">
            <span className="budget-col-desc">Description</span>
            <span className="budget-col-sm">Qty</span>
            <span className="budget-col-sm">Price</span>
            <span className="budget-col-sm">Markup %</span>
            <span className="budget-col-sm">Total</span>
            <span className="budget-col-supplier">Supplier</span>
            <span className="budget-col-notes">Notes</span>
            <span className="budget-col-actions" />
          </div>
          {category.items.map(item => (
            <BudgetLineItemRow
              key={item.id}
              item={item}
              categoryId={category.id}
              categories={categories}
              currency={currency}
              itemTotal={getItemTotal(item)}
              onUpdate={(field, value) => onUpdateItem(item.id, field, value)}
              onDelete={() => onDeleteItem(item.id)}
              onCopy={(toCatId) => onCopyItem(item.id, toCatId)}
            />
          ))}
        </>
      )}
    </div>
  );
}
