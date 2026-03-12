import { useState } from 'react';
import { ExpenseRow } from './ExpenseRow';
import { CURRENCY_SYMBOLS, type Expense, type BudgetCategory, type CurrencyCode } from '@/stores/budgetStore';

interface ExpenseTableProps {
  expenses: Expense[];
  categories: BudgetCategory[];
  currency: CurrencyCode;
  onAddManual: () => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  onReceiptClick: (imageUri: string) => void;
}

export function ExpenseTable({
  expenses,
  categories,
  currency,
  onAddManual,
  onEdit,
  onDelete,
  onReceiptClick,
}: ExpenseTableProps) {
  const sym = CURRENCY_SYMBOLS[currency];
  const [search, setSearch] = useState('');

  const filtered = search
    ? expenses.filter(e =>
        e.supplier.toLowerCase().includes(search.toLowerCase()) ||
        e.category.toLowerCase().includes(search.toLowerCase())
      )
    : expenses;

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="budget-expense-card">
      <div className="budget-expense-card-header">
        <h3 style={{ fontSize: '0.8125rem', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--text-heading)', margin: 0 }}>
          <span className="heading-italic">Expenses</span>
        </h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="budget-input budget-search-input"
            type="text"
            placeholder="Search expenses..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="btn-action-gold" onClick={onAddManual}>
            + Add Manual Expense
          </button>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="budget-expense-empty">
          <ReceiptIcon />
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 8 }}>No expenses yet</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Upload a receipt above or add one manually</div>
        </div>
      ) : (
        <div className="budget-expense-table-wrapper">
          <table className="budget-expense-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>SUPPLIER</th>
                <th>CATEGORY</th>
                <th>LINE ITEM</th>
                <th>VAT</th>
                <th>AMOUNT</th>
                <th>RECEIPT</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(expense => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  categories={categories}
                  currency={currency}
                  onEdit={() => onEdit(expense)}
                  onDelete={() => onDelete(expense.id)}
                  onReceiptClick={() => expense.receiptImageUri && onReceiptClick(expense.receiptImageUri)}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="budget-expense-total-row">
                <td colSpan={5} style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                }}>
                  TOTAL EXPENSES
                </td>
                <td colSpan={3} style={{
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color: 'var(--gold-primary)',
                  letterSpacing: '-0.01em',
                }}>
                  {sym}{totalExpenses.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function ReceiptIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 17.5v-11" />
    </svg>
  );
}
