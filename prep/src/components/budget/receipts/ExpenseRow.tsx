import { CURRENCY_SYMBOLS, type Expense, type BudgetCategory, type CurrencyCode } from '@/stores/budgetStore';

interface ExpenseRowProps {
  expense: Expense;
  categories: BudgetCategory[];
  currency: CurrencyCode;
  onEdit: () => void;
  onDelete: () => void;
  onReceiptClick: () => void;
}

export function ExpenseRow({ expense, categories, currency, onEdit, onDelete, onReceiptClick }: ExpenseRowProps) {
  const sym = CURRENCY_SYMBOLS[currency];
  const cat = categories.find(c => c.id === expense.category);
  const lineItem = cat?.items.find(i => i.id === expense.lineItemId);

  return (
    <tr className="budget-expense-row">
      <td style={{ fontSize: '0.8125rem' }}>{expense.date}</td>
      <td style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>{expense.supplier}</td>
      <td>
        {cat && (
          <span className="budget-category-pill">{cat.name}</span>
        )}
      </td>
      <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {lineItem?.description || '—'}
      </td>
      <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{expense.vat || '—'}</td>
      <td style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)' }}>
        {sym}{expense.amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td>
        {expense.receiptImageUri ? (
          <div
            className="budget-receipt-thumb"
            onClick={onReceiptClick}
            style={{ cursor: 'pointer' }}
          >
            <img src={expense.receiptImageUri} alt="Receipt" />
          </div>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </td>
      <td>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="budget-icon-btn" onClick={onEdit} title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button className="budget-icon-btn budget-icon-btn-danger" onClick={onDelete} title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}
