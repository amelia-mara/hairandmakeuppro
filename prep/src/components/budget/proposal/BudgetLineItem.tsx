import { useRef, useCallback } from 'react';
import { CopyToDropdown } from './CopyToDropdown';
import { CURRENCY_SYMBOLS, type BudgetLineItem as LineItemType, type BudgetCategory, type CurrencyCode } from '@/stores/budgetStore';

interface BudgetLineItemProps {
  item: LineItemType;
  categoryId: string;
  categories: BudgetCategory[];
  currency: CurrencyCode;
  itemTotal: number;
  onUpdate: (field: string, value: string | number) => void;
  onDelete: () => void;
  onCopy: (toCategoryId: string) => void;
}

export function BudgetLineItemRow({
  item,
  categoryId,
  categories,
  currency,
  itemTotal,
  onUpdate,
  onDelete,
  onCopy,
}: BudgetLineItemProps) {
  const sym = CURRENCY_SYMBOLS[currency];
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const debouncedUpdate = useCallback((field: string, value: string | number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onUpdate(field, value), 100);
  }, [onUpdate]);

  return (
    <div className="budget-line-item-row">
      <input
        className="budget-input budget-input-desc"
        type="text"
        defaultValue={item.description}
        placeholder="Item description"
        onChange={e => debouncedUpdate('description', e.target.value)}
      />
      <input
        className="budget-input budget-input-sm"
        type="number"
        defaultValue={item.qty}
        min={0}
        placeholder="Qty"
        onChange={e => onUpdate('qty', parseFloat(e.target.value) || 0)}
      />
      <input
        className="budget-input budget-input-sm"
        type="number"
        defaultValue={item.price}
        min={0}
        step={0.01}
        placeholder="Price"
        onChange={e => onUpdate('price', parseFloat(e.target.value) || 0)}
      />
      <input
        className="budget-input budget-input-sm"
        type="number"
        defaultValue={item.markup}
        min={0}
        step={1}
        placeholder="%"
        onChange={e => onUpdate('markup', parseFloat(e.target.value) || 0)}
      />
      <div className="budget-calculated-value">
        {sym}{itemTotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <select
        className="budget-select budget-input-supplier"
        defaultValue={item.supplier}
        onChange={e => onUpdate('supplier', e.target.value)}
      >
        <option value="">Supplier</option>
        <option value="Amazon">Amazon</option>
        <option value="Boots">Boots</option>
        <option value="MAC">MAC</option>
        <option value="Superdrug">Superdrug</option>
        <option value="Sally's">Sally's</option>
        <option value="Charles Fox">Charles Fox</option>
        <option value="Other">Other</option>
      </select>
      <input
        className="budget-input budget-input-notes"
        type="text"
        defaultValue={item.notes}
        placeholder="Notes..."
        onChange={e => debouncedUpdate('notes', e.target.value)}
      />
      <CopyToDropdown
        categories={categories}
        currentCategoryId={categoryId}
        onCopy={onCopy}
      />
      <button className="budget-delete-btn" onClick={onDelete} title="Delete item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
