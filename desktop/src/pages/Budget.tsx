import { useState } from 'react';
import {
  Download,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  PoundSterling,
} from 'lucide-react';
import { Button, Card, Badge } from '@/components/ui';
import { useBudgetStore } from '@/stores';
import { formatCurrency } from '@/utils/helpers';
import type { BudgetCategory, BudgetEntry } from '@/types';

/* ------------------------------------------------------------------ */
/*  Inline Editable Entry Row                                         */
/* ------------------------------------------------------------------ */

function EntryRow({
  entry,
  onUpdate,
  onDelete,
}: {
  entry: BudgetEntry;
  onUpdate: (id: string, data: Partial<BudgetEntry>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(entry.description);
  const [qty, setQty] = useState(String(entry.quantity));
  const [rate, setRate] = useState(String(entry.rate));

  const commitEdit = () => {
    onUpdate(entry.id, {
      description: desc,
      quantity: Number(qty) || 0,
      rate: Number(rate) || 0,
    });
    setEditing(false);
  };

  const cancelEdit = () => {
    setDesc(entry.description);
    setQty(String(entry.quantity));
    setRate(String(entry.rate));
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') cancelEdit();
  };

  if (editing) {
    return (
      <div className="grid grid-cols-[1fr_80px_100px_100px_40px] gap-3 items-center py-2 px-3">
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 px-2 bg-input-bg border border-border-default rounded text-sm text-text-primary focus:border-border-focus focus:outline-none"
          autoFocus
        />
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onKeyDown={handleKeyDown}
          type="number"
          className="h-8 px-2 bg-input-bg border border-border-default rounded text-sm text-text-primary text-right focus:border-border-focus focus:outline-none"
        />
        <input
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          onKeyDown={handleKeyDown}
          type="number"
          className="h-8 px-2 bg-input-bg border border-border-default rounded text-sm text-text-primary text-right focus:border-border-focus focus:outline-none"
        />
        <span className="text-sm text-text-primary text-right font-medium">
          {formatCurrency((Number(qty) || 0) * (Number(rate) || 0))}
        </span>
        <div className="flex gap-1">
          <button
            onClick={commitEdit}
            className="text-xs text-gold hover:text-gold-hover font-medium"
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-[1fr_80px_100px_100px_40px] gap-3 items-center py-2 px-3 hover:bg-surface-hover transition-colors-fast group cursor-pointer"
      onDoubleClick={() => setEditing(true)}
    >
      <span className="text-sm text-text-primary truncate">{entry.description}</span>
      <span className="text-sm text-text-secondary text-right">{entry.quantity}</span>
      <span className="text-sm text-text-secondary text-right">
        {formatCurrency(entry.rate)}
      </span>
      <span className="text-sm text-text-primary text-right font-medium">
        {formatCurrency(entry.total)}
      </span>
      <button
        onClick={() => onDelete(entry.id)}
        className="p-1 text-text-muted hover:text-error rounded opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Category Section (Collapsible)                                    */
/* ------------------------------------------------------------------ */

function CategorySection({
  category,
  entries,
  categoryTotal,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
}: {
  category: BudgetCategory;
  entries: BudgetEntry[];
  categoryTotal: number;
  onAddEntry: (categoryId: string) => void;
  onUpdateEntry: (id: string, data: Partial<BudgetEntry>) => void;
  onDeleteEntry: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Card padding="sm" className="overflow-hidden">
      {/* Category header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-surface-hover transition-colors-fast rounded-lg"
      >
        <div className="flex items-center gap-2">
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          )}
          <span className="text-sm font-semibold text-text-primary uppercase tracking-wider">
            {category.name}
          </span>
          <Badge variant="default">{entries.length} items</Badge>
        </div>
        <span className="text-sm font-semibold text-gold">
          {formatCurrency(categoryTotal)}
        </span>
      </button>

      {!collapsed && (
        <>
          {/* Column headers */}
          {entries.length > 0 && (
            <div className="grid grid-cols-[1fr_80px_100px_100px_40px] gap-3 px-3 py-1.5 border-t border-border-subtle">
              <span className="text-xs text-text-muted font-medium uppercase tracking-wider">
                Description
              </span>
              <span className="text-xs text-text-muted font-medium uppercase tracking-wider text-right">
                Qty
              </span>
              <span className="text-xs text-text-muted font-medium uppercase tracking-wider text-right">
                Rate
              </span>
              <span className="text-xs text-text-muted font-medium uppercase tracking-wider text-right">
                Total
              </span>
              <span />
            </div>
          )}

          {/* Entry rows */}
          <div className="divide-y divide-border-subtle border-t border-border-subtle">
            {entries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                onUpdate={onUpdateEntry}
                onDelete={onDeleteEntry}
              />
            ))}
          </div>

          {/* Add entry button */}
          <div className="px-3 py-2 border-t border-border-subtle">
            <button
              onClick={() => onAddEntry(category.id)}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-gold transition-colors-fast"
            >
              <Plus className="w-3.5 h-3.5" />
              Add item
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Budget Page                                                       */
/* ------------------------------------------------------------------ */

export default function Budget() {
  const {
    categories,
    entries,
    addEntry,
    updateEntry,
    deleteEntry,
    getTotals,
  } = useBudgetStore();

  const totals = getTotals();

  const handleAddEntry = (categoryId: string) => {
    addEntry({
      categoryId,
      description: 'New item',
      quantity: 1,
      rate: 0,
      notes: '',
    });
  };

  const handleExport = () => {
    /* TODO: Wire up to export service */
  };

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary tracking-wide">
          BUDGET
        </h1>
        <Button
          variant="secondary"
          icon={<Download className="w-4 h-4" />}
          onClick={handleExport}
        >
          Export
        </Button>
      </div>

      {/* Grand total */}
      <Card padding="lg" className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center">
            <PoundSterling className="w-6 h-6 text-gold" />
          </div>
          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Project Total
            </p>
            <p className="text-3xl font-bold text-text-primary">
              {formatCurrency(totals.grandTotal)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-muted">
            {categories.length} categories &middot; {entries.length} line items
          </p>
        </div>
      </Card>

      {/* Category sections */}
      <div className="space-y-4">
        {sortedCategories.map((category) => {
          const catEntries = entries.filter(
            (e) => e.categoryId === category.id
          );
          const catTotal = totals.byCategory[category.id] ?? 0;

          return (
            <CategorySection
              key={category.id}
              category={category}
              entries={catEntries}
              categoryTotal={catTotal}
              onAddEntry={handleAddEntry}
              onUpdateEntry={updateEntry}
              onDeleteEntry={deleteEntry}
            />
          );
        })}
      </div>

      {/* Category-level summary */}
      {sortedCategories.length > 0 && (
        <Card padding="md">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            Summary
          </p>
          <div className="space-y-2">
            {sortedCategories.map((cat) => {
              const catTotal = totals.byCategory[cat.id] ?? 0;
              const pct =
                totals.grandTotal > 0
                  ? Math.round((catTotal / totals.grandTotal) * 100)
                  : 0;
              return (
                <div key={cat.id} className="flex items-center gap-3">
                  <span className="text-sm text-text-secondary w-32 shrink-0">
                    {cat.name}
                  </span>
                  <div className="flex-1 h-2 bg-surface-hover rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold/60 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm text-text-primary font-medium w-24 text-right shrink-0">
                    {formatCurrency(catTotal)}
                  </span>
                  <span className="text-xs text-text-muted w-10 text-right shrink-0">
                    {pct}%
                  </span>
                </div>
              );
            })}
            <div className="flex items-center gap-3 pt-2 border-t border-border-subtle">
              <span className="text-sm font-semibold text-text-primary w-32 shrink-0">
                Total
              </span>
              <div className="flex-1" />
              <span className="text-sm font-bold text-gold w-24 text-right shrink-0">
                {formatCurrency(totals.grandTotal)}
              </span>
              <span className="w-10 shrink-0" />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
