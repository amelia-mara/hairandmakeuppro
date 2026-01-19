import { useState, useRef } from 'react';
import { formatShortDate } from '@/utils/helpers';

// Budget expense category types
export type ExpenseCategory = 'Kit Supplies' | 'Consumables' | 'Transportation' | 'Equipment' | 'Other';

export interface Receipt {
  id: string;
  date: string;
  vendor: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  imageUri?: string;
  synced: boolean;
}

export interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  byCategory: Record<ExpenseCategory, number>;
}

// Demo data for development
const demoReceipts: Receipt[] = [
  {
    id: 'r1',
    date: '2025-01-18',
    vendor: 'Camera Ready Cosmetics',
    amount: 245.00,
    category: 'Kit Supplies',
    description: 'Foundation restocks, setting spray',
    synced: true,
  },
  {
    id: 'r2',
    date: '2025-01-17',
    vendor: 'Uber',
    amount: 32.50,
    category: 'Transportation',
    description: 'To set - Day 3',
    synced: true,
  },
  {
    id: 'r3',
    date: '2025-01-15',
    vendor: 'Kryolan',
    amount: 189.99,
    category: 'Kit Supplies',
    description: 'Blood products, prosthetic adhesive',
    synced: false,
  },
  {
    id: 'r4',
    date: '2025-01-14',
    vendor: 'Costco',
    amount: 67.25,
    category: 'Consumables',
    description: 'Tissues, cotton rounds, alcohol',
    synced: true,
  },
];

const demoBudgetSummary: BudgetSummary = {
  totalBudget: 2500.00,
  totalSpent: 534.74,
  byCategory: {
    'Kit Supplies': 434.99,
    'Consumables': 67.25,
    'Transportation': 32.50,
    'Equipment': 0,
    'Other': 0,
  },
};

const CATEGORIES: ExpenseCategory[] = ['Kit Supplies', 'Consumables', 'Transportation', 'Equipment', 'Other'];

export function Budget() {
  const [receipts, setReceipts] = useState<Receipt[]>(demoReceipts);
  const [summary] = useState<BudgetSummary>(demoBudgetSummary);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showAddReceipt, setShowAddReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remainingBudget = summary.totalBudget - summary.totalSpent;
  const percentUsed = (summary.totalSpent / summary.totalBudget) * 100;

  // Handle receipt image capture
  const handleScanReceipt = () => {
    fileInputRef.current?.click();
  };

  const handleFileCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
        setShowAddReceipt(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddReceipt = (receipt: Omit<Receipt, 'id' | 'synced'>) => {
    const newReceipt: Receipt = {
      ...receipt,
      id: `r-${Date.now()}`,
      synced: false,
    };
    setReceipts([newReceipt, ...receipts]);
    setShowAddReceipt(false);
    setCapturedImage(null);
  };

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-text-primary">Budget</h1>
            <button
              onClick={handleScanReceipt}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gold active:opacity-70 transition-opacity"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
              Scan
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file input for camera/gallery */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileCapture}
        className="hidden"
      />

      <div className="mobile-container px-4 py-4 space-y-4">
        {/* Budget Overview Card */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-header">SPENDING OVERVIEW</h2>
            <span className="text-xs text-text-muted">This Production</span>
          </div>

          {/* Progress bar */}
          <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div
              className={`absolute left-0 top-0 h-full rounded-full transition-all ${
                percentUsed > 90 ? 'bg-error' : percentUsed > 70 ? 'bg-amber-500' : 'bg-gold'
              }`}
              style={{ width: `${Math.min(percentUsed, 100)}%` }}
            />
          </div>

          <div className="flex justify-between items-end">
            <div>
              <span className="text-2xl font-bold text-text-primary">
                ${summary.totalSpent.toFixed(2)}
              </span>
              <span className="text-sm text-text-muted ml-1">spent</span>
            </div>
            <div className="text-right">
              <span className={`text-lg font-semibold ${
                remainingBudget < 0 ? 'text-error' : 'text-green-600'
              }`}>
                ${remainingBudget.toFixed(2)}
              </span>
              <span className="text-xs text-text-muted block">remaining of ${summary.totalBudget.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="card">
          <h2 className="section-header mb-3">BY CATEGORY</h2>
          <div className="space-y-2">
            {CATEGORIES.filter(cat => summary.byCategory[cat] > 0).map((category) => {
              const amount = summary.byCategory[category];
              const catPercent = (amount / summary.totalSpent) * 100;
              return (
                <div key={category} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-text-primary">{category}</span>
                      <span className="text-text-muted">${amount.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gold/60 rounded-full"
                        style={{ width: `${catPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Receipts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-header">RECENT RECEIPTS</h2>
            <span className="text-xs text-text-muted">{receipts.length} total</span>
          </div>

          <div className="space-y-2">
            {receipts.map((receipt) => (
              <div key={receipt.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-text-primary truncate">
                        {receipt.vendor}
                      </h3>
                      {!receipt.synced && (
                        <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-amber-100 text-amber-700">
                          Pending
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">{receipt.description}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-text-muted">
                        {receipt.category}
                      </span>
                      <span className="text-[11px] text-text-light">
                        {formatShortDate(receipt.date)}
                      </span>
                    </div>
                  </div>
                  <span className="text-base font-bold text-text-primary ml-3">
                    ${receipt.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Scan Button (mobile-optimized) */}
        <button
          onClick={handleScanReceipt}
          className="w-full card flex items-center justify-center gap-3 py-4 border-2 border-dashed border-gold/30 hover:border-gold hover:bg-gold/5 transition-colors"
        >
          <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span className="text-sm font-medium text-gold">Quick Scan Receipt</span>
        </button>

        {/* Sync Notice */}
        <div className="text-center py-2">
          <p className="text-xs text-text-light">
            Syncs with website budget page
          </p>
        </div>
      </div>

      {/* Add Receipt Modal */}
      {showAddReceipt && (
        <AddReceiptModal
          imageUri={capturedImage}
          onAdd={handleAddReceipt}
          onClose={() => {
            setShowAddReceipt(false);
            setCapturedImage(null);
          }}
        />
      )}
    </div>
  );
}

// Add Receipt Modal
interface AddReceiptModalProps {
  imageUri: string | null;
  onAdd: (receipt: Omit<Receipt, 'id' | 'synced'>) => void;
  onClose: () => void;
}

function AddReceiptModal({ imageUri, onAdd, onClose }: AddReceiptModalProps) {
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Kit Supplies');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor || !amount) return;

    onAdd({
      date,
      vendor,
      amount: parseFloat(amount),
      category,
      description,
      imageUri: imageUri || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div className="bg-card rounded-t-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Add Receipt</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-text-muted hover:text-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Receipt Image Preview */}
          {imageUri && (
            <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
              <img
                src={imageUri}
                alt="Receipt"
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {/* Vendor */}
          <div>
            <label className="field-label block mb-1.5">Vendor / Store</label>
            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="input-field w-full"
              placeholder="e.g., Camera Ready Cosmetics"
              required
            />
          </div>

          {/* Amount */}
          <div>
            <label className="field-label block mb-1.5">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">$</span>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-field w-full pl-7"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="field-label block mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-field w-full"
            />
          </div>

          {/* Category */}
          <div>
            <label className="field-label block mb-1.5">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                    category === cat
                      ? 'bg-gold text-white border-gold'
                      : 'bg-white text-text-secondary border-border hover:border-gold/50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="field-label block mb-1.5">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field w-full"
              placeholder="e.g., Foundation restocks"
            />
          </div>

          {/* Submit */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-button bg-gray-100 text-text-primary font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 rounded-button gold-gradient text-white font-medium"
              disabled={!vendor || !amount}
            >
              Add Receipt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
