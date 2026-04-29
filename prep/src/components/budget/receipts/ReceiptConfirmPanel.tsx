import { useState, useEffect, useRef } from 'react';
import type { BudgetCategory, BudgetLineItem, CurrencyCode } from '@/stores/budgetStore';
import { CURRENCY_SYMBOLS } from '@/stores/budgetStore';

/**
 * Add Receipt modal — desktop adaptation of the mobile-pwa Add
 * Receipt flow. Centered modal (not a side drawer) with a single
 * vertical column: image preview at the top, then a stacked form
 * (Supplier · Amount + Date · VAT · Category pills · Line item ·
 * Notes), then Cancel/Save in the footer.
 *
 * The mobile version offers Take Photo / Choose from Library /
 * Manual Entry — on desktop those collapse to one "drag-drop or
 * click to upload" zone (or skip the photo entirely and fill in
 * the form by hand).
 */

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
  notes: string;
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
  const [notes, setNotes] = useState('');
  const [localImageUri, setLocalImageUri] = useState<string | undefined>(imageUri);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset every time the modal opens (the mobile version mounts /
  // unmounts so it gets a fresh form for free; the prep panel is
  // long-lived so we have to clear by hand).
  useEffect(() => {
    if (!open) return;
    setSupplier('');
    setAmount('');
    setVat('');
    setDate(new Date().toISOString().split('T')[0]);
    setCategory('');
    setLineItemId('');
    setNotes('');
    setLocalImageUri(isManual ? undefined : imageUri);
  }, [open, imageUri, isManual]);

  // Esc to close — matches every other modal in the app.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const selectedCategory = categories.find(c => c.id === category);
  const lineItems: BudgetLineItem[] = selectedCategory?.items || [];
  const canSubmit = supplier.trim().length > 0 && parseFloat(amount) > 0 && category.length > 0;

  const handleConfirm = () => {
    if (!canSubmit) return;
    onConfirm({
      supplier: supplier.trim(),
      amount: parseFloat(amount) || 0,
      vat,
      date,
      category,
      lineItemId,
      notes: notes.trim(),
      imageUri: localImageUri,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLocalImageUri(reader.result as string);
    reader.readAsDataURL(file);
  };

  if (!open) return null;

  return (
    <div className="receipt-modal-backdrop" onClick={onClose}>
      <div
        className="receipt-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add receipt"
      >
        <div className="receipt-modal-header">
          <h3 className="receipt-modal-title">
            <span className="heading-italic">Add</span>{' '}
            <span className="heading-regular">Receipt</span>
          </h3>
          <button className="receipt-modal-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        <div className="receipt-modal-body">
          {/* Image preview / upload zone */}
          {localImageUri ? (
            <div className="receipt-image-preview">
              <img src={localImageUri} alt="Receipt" />
              <button
                type="button"
                className="receipt-image-remove"
                onClick={() => setLocalImageUri(undefined)}
                aria-label="Remove image"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="receipt-upload-zone"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span className="receipt-upload-label">Attach receipt photo</span>
              <span className="receipt-upload-hint">PNG · JPG · HEIC · PDF — optional</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/heic,application/pdf"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </button>
          )}

          {/* Supplier */}
          <div className="receipt-field">
            <label className="receipt-field-label">Supplier</label>
            <input
              className="receipt-input"
              type="text"
              value={supplier}
              onChange={e => setSupplier(e.target.value)}
              placeholder="e.g. Boots, Camera Ready Cosmetics"
              autoFocus
            />
          </div>

          {/* Amount + Date */}
          <div className="receipt-field-row">
            <div className="receipt-field">
              <label className="receipt-field-label">Amount</label>
              <div className="receipt-input-prefix">
                <span className="receipt-prefix">{sym}</span>
                <input
                  className="receipt-input"
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  step={0.01}
                  min={0}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="receipt-field">
              <label className="receipt-field-label">Date</label>
              <input
                className="receipt-input"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* VAT (amount of tax — not the supplier's VAT registration) */}
          <div className="receipt-field">
            <label className="receipt-field-label">
              VAT <span className="receipt-field-hint">(amount paid)</span>
            </label>
            <div className="receipt-input-prefix">
              <span className="receipt-prefix">{sym}</span>
              <input
                className="receipt-input"
                type="number"
                value={vat}
                onChange={e => setVat(e.target.value)}
                step={0.01}
                min={0}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Category pills (mirrors mobile) */}
          <div className="receipt-field">
            <label className="receipt-field-label">Category</label>
            <div className="receipt-category-pills">
              {categories.map((c) => {
                const active = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setCategory(c.id); setLineItemId(''); }}
                    className={`receipt-cat-pill${active ? ' receipt-cat-pill--active' : ''}`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional line item link */}
          {lineItems.length > 0 && (
            <div className="receipt-field">
              <label className="receipt-field-label">
                Link to budget line item <span className="receipt-field-hint">(optional)</span>
              </label>
              <select
                className="receipt-input"
                value={lineItemId}
                onChange={e => setLineItemId(e.target.value)}
              >
                <option value="">No specific item</option>
                {lineItems.map(item => (
                  <option key={item.id} value={item.id}>{item.description || 'Untitled item'}</option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div className="receipt-field">
            <label className="receipt-field-label">
              Notes <span className="receipt-field-hint">(optional)</span>
            </label>
            <input
              className="receipt-input"
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Foundation restocks"
            />
          </div>
        </div>

        <div className="receipt-modal-footer">
          <button className="btn-ghost receipt-btn" onClick={onDiscard}>
            Discard
          </button>
          <button
            className="btn-gold receipt-btn receipt-btn--primary"
            onClick={handleConfirm}
            disabled={!canSubmit}
          >
            Save Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
