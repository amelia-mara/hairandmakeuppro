import { useState, useRef } from 'react';
import { formatShortDate } from '@/utils/helpers';
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  formatCurrency,
  getCurrencyByCode,
  type CurrencyCode,
} from '@/types';

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

// Empty initial state for real projects
const emptyBudgetSummary: BudgetSummary = {
  totalBudget: 0,
  totalSpent: 0,
  byCategory: {
    'Kit Supplies': 0,
    'Consumables': 0,
    'Transportation': 0,
    'Equipment': 0,
    'Other': 0,
  },
};

const CATEGORIES: ExpenseCategory[] = ['Kit Supplies', 'Consumables', 'Transportation', 'Equipment', 'Other'];

export function Budget() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [summary] = useState<BudgetSummary>(emptyBudgetSummary);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showAddReceipt, setShowAddReceipt] = useState(false);
  const [showScanOptions, setShowScanOptions] = useState(false);
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Get current currency info
  const currentCurrency = getCurrencyByCode(currency);

  const remainingBudget = summary.totalBudget - summary.totalSpent;
  const percentUsed = summary.totalBudget > 0 ? (summary.totalSpent / summary.totalBudget) * 100 : 0;

  // Handle receipt image capture
  const handleScanReceipt = () => {
    setShowScanOptions(true);
  };

  const handleTakePhoto = () => {
    setShowScanOptions(false);
    cameraInputRef.current?.click();
  };

  const handleChooseFromLibrary = () => {
    setShowScanOptions(false);
    galleryInputRef.current?.click();
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
    // Reset input so the same file can be selected again
    e.target.value = '';
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

  const handleManualEntry = () => {
    setShowScanOptions(false);
    setCapturedImage(null);
    setShowAddReceipt(true);
  };

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-card border-b border-border safe-top">
        <div className="mobile-container">
          <div className="h-14 px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-text-primary">Budget</h1>
              {/* Currency Selector */}
              <button
                onClick={() => setShowCurrencyPicker(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-text-muted bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <span>{currentCurrency.symbol}</span>
                <span>{currency}</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
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

      {/* Hidden file inputs for camera and gallery */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileCapture}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
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
                {formatCurrency(summary.totalSpent, currency)}
              </span>
              <span className="text-sm text-text-muted ml-1">spent</span>
            </div>
            <div className="text-right">
              <span className={`text-lg font-semibold ${
                remainingBudget < 0 ? 'text-error' : 'text-green-600'
              }`}>
                {formatCurrency(remainingBudget, currency)}
              </span>
              <span className="text-xs text-text-muted block">remaining of {formatCurrency(summary.totalBudget, currency)}</span>
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
                      <span className="text-text-muted">{formatCurrency(amount, currency)}</span>
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

          {receipts.length === 0 ? (
            <div className="card text-center py-8">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
              </div>
              <p className="text-sm text-text-muted mb-1">No receipts yet</p>
              <p className="text-xs text-text-light">Scan or add receipts to track expenses</p>
            </div>
          ) : (
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
                      {formatCurrency(receipt.amount, currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
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

      {/* Currency Picker Modal */}
      {showCurrencyPicker && (
        <CurrencyPickerModal
          currentCurrency={currency}
          onSelect={(code) => {
            setCurrency(code);
            setShowCurrencyPicker(false);
          }}
          onClose={() => setShowCurrencyPicker(false)}
        />
      )}

      {/* Add Receipt Modal */}
      {showAddReceipt && (
        <AddReceiptModal
          imageUri={capturedImage}
          currencySymbol={currentCurrency.symbol}
          onAdd={handleAddReceipt}
          onClose={() => {
            setShowAddReceipt(false);
            setCapturedImage(null);
          }}
        />
      )}

      {/* Scan Options Modal */}
      {showScanOptions && (
        <ScanOptionsModal
          onTakePhoto={handleTakePhoto}
          onChooseFromLibrary={handleChooseFromLibrary}
          onManualEntry={handleManualEntry}
          onClose={() => setShowScanOptions(false)}
        />
      )}
    </div>
  );
}

// Currency Picker Modal
interface CurrencyPickerModalProps {
  currentCurrency: CurrencyCode;
  onSelect: (code: CurrencyCode) => void;
  onClose: () => void;
}

function CurrencyPickerModal({ currentCurrency, onSelect, onClose }: CurrencyPickerModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card rounded-t-2xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary text-center">Select Currency</h2>
        </div>
        <div className="p-2 max-h-[60vh] overflow-y-auto">
          {CURRENCIES.map((curr) => (
            <button
              key={curr.code}
              onClick={() => onSelect(curr.code)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                currentCurrency === curr.code
                  ? 'bg-gold/10'
                  : 'hover:bg-gray-50'
              }`}
            >
              <span className="text-xl font-medium text-text-primary w-8">{curr.symbol}</span>
              <div className="flex-1 text-left">
                <span className="text-sm font-medium text-text-primary">{curr.code}</span>
                <span className="text-xs text-text-muted ml-2">{curr.name}</span>
              </div>
              {currentCurrency === curr.code && (
                <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 rounded-button bg-gray-100 text-text-primary font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Add Receipt Modal
interface AddReceiptModalProps {
  imageUri: string | null;
  currencySymbol: string;
  onAdd: (receipt: Omit<Receipt, 'id' | 'synced'>) => void;
  onClose: () => void;
}

// Scan Options Modal
interface ScanOptionsModalProps {
  onTakePhoto: () => void;
  onChooseFromLibrary: () => void;
  onManualEntry: () => void;
  onClose: () => void;
}

function ScanOptionsModal({ onTakePhoto, onChooseFromLibrary, onManualEntry, onClose }: ScanOptionsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card rounded-t-2xl w-full max-w-lg animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary text-center">Add Receipt</h2>
        </div>

        <div className="p-4 space-y-3">
          {/* Take Photo */}
          <button
            onClick={onTakePhoto}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl bg-gold/10 hover:bg-gold/20 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </div>
            <div className="flex-1 text-left">
              <span className="text-base font-semibold text-text-primary block">Take Photo</span>
              <span className="text-sm text-text-muted">Capture receipt with camera</span>
            </div>
          </button>

          {/* Choose from Library */}
          <button
            onClick={onChooseFromLibrary}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <div className="flex-1 text-left">
              <span className="text-base font-semibold text-text-primary block">Choose from Library</span>
              <span className="text-sm text-text-muted">Select existing photo</span>
            </div>
          </button>

          {/* Manual Entry */}
          <button
            onClick={onManualEntry}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </div>
            <div className="flex-1 text-left">
              <span className="text-base font-semibold text-text-primary block">Manual Entry</span>
              <span className="text-sm text-text-muted">Enter details without photo</span>
            </div>
          </button>
        </div>

        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 rounded-button bg-gray-100 text-text-primary font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function AddReceiptModal({ imageUri, currencySymbol, onAdd, onClose }: AddReceiptModalProps) {
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
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">{currencySymbol}</span>
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
