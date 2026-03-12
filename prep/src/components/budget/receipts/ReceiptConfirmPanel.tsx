import { useState, useEffect, useRef } from 'react';
import type { BudgetCategory, BudgetLineItem, CurrencyCode } from '@/stores/budgetStore';
import { CURRENCY_SYMBOLS } from '@/stores/budgetStore';

interface ReceiptConfirmPanelProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: ConfirmData) => void;
  onDiscard: () => void;
  imageUri?: string;
  categories: BudgetCategory[];
  currency: CurrencyCode;
  isManual?: boolean;
}

export interface ConfirmData {
  supplier: string;
  amount: number;
  vat: string;
  date: string;
  category: string;
  lineItemId: string;
  imageUri?: string;
}

export function ReceiptConfirmPanel({
  open,
  onClose,
  onConfirm,
  onDiscard,
  imageUri,
  categories,
  currency,
  isManual,
}: ReceiptConfirmPanelProps) {
  const sym = CURRENCY_SYMBOLS[currency];
  const [supplier, setSupplier] = useState('');
  const [amount, setAmount] = useState('');
  const [vat, setVat] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('');
  const [lineItemId, setLineItemId] = useState('');
  const [localImageUri, setLocalImageUri] = useState<string | undefined>(imageUri);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalImageUri(imageUri);
  }, [imageUri]);

  useEffect(() => {
    if (open) {
      setSupplier('');
      setAmount('');
      setVat('');
      setDate(new Date().toISOString().split('T')[0]);
      setCategory('');
      setLineItemId('');
      if (!isManual) setLocalImageUri(imageUri);
      else setLocalImageUri(undefined);
    }
  }, [open, imageUri, isManual]);

  const selectedCategory = categories.find(c => c.id === category);
  const lineItems: BudgetLineItem[] = selectedCategory?.items || [];

  const handleConfirm = () => {
    onConfirm({
      supplier,
      amount: parseFloat(amount) || 0,
      vat,
      date,
      category,
      lineItemId,
      imageUri: localImageUri,
    });
  };

  const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLocalImageUri(reader.result as string);
    reader.readAsDataURL(file);
  };

  if (!open) return null;

  return (
    <div className={`budget-confirm-panel ${open ? 'open' : ''}`}>
      <div className="budget-confirm-panel-header">
        <h3 style={{ fontSize: '0.8125rem', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--text-heading)', margin: 0 }}>
          <span className="heading-italic">Confirm</span>{' '}
          <span className="heading-regular">Expense</span>
        </h3>
        <button className="budget-modal-close" onClick={onClose}>×</button>
      </div>

      <div className="budget-confirm-panel-body">
        {/* Left: image preview */}
        <div className="budget-confirm-image">
          {localImageUri ? (
            <img src={localImageUri} alt="Receipt" style={{
              width: '100%',
              maxHeight: 300,
              objectFit: 'contain',
              borderRadius: 10,
              background: 'var(--bg-card)',
            }} />
          ) : (
            <div
              className="budget-mini-upload"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/heic,application/pdf"
                onChange={handleManualUpload}
                style={{ display: 'none' }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                Attach receipt (optional)
              </span>
            </div>
          )}
        </div>

        {/* Right: form fields */}
        <div className="budget-confirm-fields">
          <div className="budget-field-group">
            <label className="budget-field-label">SUPPLIER</label>
            <input
              className="budget-input"
              type="text"
              value={supplier}
              onChange={e => setSupplier(e.target.value)}
              placeholder="e.g. Boots, Amazon"
            />
          </div>

          <div className="budget-field-group">
            <label className="budget-field-label">AMOUNT</label>
            <div className="budget-input-prefix">
              <span className="budget-prefix">{sym}</span>
              <input
                className="budget-input"
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                step={0.01}
                min={0}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="budget-field-group">
            <label className="budget-field-label">VAT NUMBER <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <input
              className="budget-input"
              type="text"
              value={vat}
              onChange={e => setVat(e.target.value)}
              placeholder="e.g. GB123456789"
            />
          </div>

          <div className="budget-field-group">
            <label className="budget-field-label">DATE</label>
            <input
              className="budget-input"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          <div className="budget-field-group">
            <label className="budget-field-label">CATEGORY</label>
            <select
              className="budget-select"
              value={category}
              onChange={e => { setCategory(e.target.value); setLineItemId(''); }}
            >
              <option value="">Select category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="budget-field-group">
            <label className="budget-field-label">LINK TO BUDGET LINE ITEM</label>
            <select
              className="budget-select"
              value={lineItemId}
              onChange={e => setLineItemId(e.target.value)}
            >
              <option value="">Select a line item (optional)</option>
              {lineItems.map(item => (
                <option key={item.id} value={item.id}>{item.description || 'Untitled item'}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="budget-confirm-panel-footer">
        <button className="btn-ghost" onClick={onDiscard}>Discard</button>
        <button className="btn-gold" onClick={handleConfirm}>Confirm and Save</button>
      </div>
    </div>
  );
}
