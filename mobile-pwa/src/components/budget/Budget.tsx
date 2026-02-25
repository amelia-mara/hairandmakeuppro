import { useState, useRef, useMemo, useEffect } from 'react';
import { formatShortDate } from '@/utils/helpers';
import {
  CURRENCIES,
  formatCurrency,
  getCurrencyByCode,
  type CurrencyCode,
} from '@/types';
import { extractReceiptData, buildDescriptionFromItems } from '@/services/receiptAIService';
import { useProjectStore } from '@/stores/projectStore';
import {
  useBudgetStore,
  EXPENSE_CATEGORIES as CATEGORIES,
  type ExpenseCategory,
  type Receipt,
  type BudgetSummary,
} from '@/stores/budgetStore';

// Re-export types for any external consumers
export type { ExpenseCategory, Receipt, BudgetSummary };

export function Budget() {
  // Budget data from store (persisted to IndexedDB)
  const {
    budgetTotal,
    floatReceived,
    receipts,
    currency,
    setBudgetTotal,
    setFloatReceived,
    setCurrency,
    addReceipt,
    updateReceipt: storeUpdateReceipt,
    deleteReceipt: storeDeleteReceipt,
  } = useBudgetStore();

  // UI-only state (not persisted)
  const [showBudgetEdit, setShowBudgetEdit] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showAddReceipt, setShowAddReceipt] = useState(false);
  const [showScanOptions, setShowScanOptions] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const { currentProject } = useProjectStore();

  // Get current currency info
  const currentCurrency = getCurrencyByCode(currency);

  // Calculate totals from receipts
  const { totalSpent, totalVat, byCategory } = useMemo(() => {
    const spent = receipts.reduce((sum, r) => sum + r.amount, 0);
    const vat = receipts.reduce((sum, r) => sum + (r.vat || 0), 0);
    const cats: Record<ExpenseCategory, number> = {
      'Kit Supplies': 0,
      'Consumables': 0,
      'Transportation': 0,
      'Equipment': 0,
      'Other': 0,
    };
    receipts.forEach(r => {
      cats[r.category] += r.amount;
    });
    return { totalSpent: spent, totalVat: vat, byCategory: cats };
  }, [receipts]);

  const remainingBudget = budgetTotal - totalSpent;
  const percentUsed = budgetTotal > 0 ? (totalSpent / budgetTotal) * 100 : 0;

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
    addReceipt(receipt);
    setShowAddReceipt(false);
    setCapturedImage(null);
  };

  const handleManualEntry = () => {
    setShowScanOptions(false);
    setCapturedImage(null);
    setShowAddReceipt(true);
  };

  const handleUpdateReceipt = (updated: Receipt) => {
    storeUpdateReceipt(updated.id, updated);
    setSelectedReceipt(null);
  };

  const handleDeleteReceipt = (receiptId: string) => {
    storeDeleteReceipt(receiptId);
    setSelectedReceipt(null);
  };

  // Generate spending reconciliation CSV
  const generateReconciliationCSV = (): string => {
    const projectName = currentProject?.name || 'Production';
    const currencyInfo = getCurrencyByCode(currency);
    const exportDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const lines: string[] = [];

    // Header info
    lines.push('SPENDING RECONCILIATION REPORT');
    lines.push(`Project: ${projectName}`);
    lines.push(`Export Date: ${exportDate}`);
    lines.push(`Currency: ${currency} (${currencyInfo.symbol})`);
    lines.push('');

    // Budget Summary
    lines.push('BUDGET SUMMARY');
    lines.push(`Total Budget,${currencyInfo.symbol}${budgetTotal.toFixed(2)}`);
    lines.push(`Float Received,${currencyInfo.symbol}${floatReceived.toFixed(2)}`);
    lines.push(`Total Spent,${currencyInfo.symbol}${totalSpent.toFixed(2)}`);
    lines.push(`Total VAT,${currencyInfo.symbol}${totalVat.toFixed(2)}`);
    lines.push(`Remaining Budget,${currencyInfo.symbol}${remainingBudget.toFixed(2)}`);
    lines.push(`Float Remaining,${currencyInfo.symbol}${(floatReceived - totalSpent).toFixed(2)}`);
    lines.push(`Percentage Used,${percentUsed.toFixed(1)}%`);
    lines.push('');

    // Category Breakdown
    lines.push('SPENDING BY CATEGORY');
    lines.push('Category,Amount');
    CATEGORIES.forEach(cat => {
      if (byCategory[cat] > 0) {
        lines.push(`${cat},${currencyInfo.symbol}${byCategory[cat].toFixed(2)}`);
      }
    });
    lines.push(`TOTAL,${currencyInfo.symbol}${totalSpent.toFixed(2)}`);
    lines.push('');

    // Receipt Details
    lines.push('RECEIPT DETAILS');
    lines.push('Date,Vendor,Category,Description,Amount,VAT');

    // Sort receipts by date
    const sortedReceipts = [...receipts].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    sortedReceipts.forEach(receipt => {
      const date = new Date(receipt.date).toLocaleDateString('en-GB');
      // Escape commas in text fields
      const vendor = receipt.vendor.includes(',') ? `"${receipt.vendor}"` : receipt.vendor;
      const description = receipt.description.includes(',') ? `"${receipt.description}"` : receipt.description;
      const vatStr = receipt.vat > 0 ? `${currencyInfo.symbol}${receipt.vat.toFixed(2)}` : '';
      lines.push(`${date},${vendor},${receipt.category},${description},${currencyInfo.symbol}${receipt.amount.toFixed(2)},${vatStr}`);
    });

    lines.push('');
    lines.push(`Total Receipts: ${receipts.length}`);

    return lines.join('\n');
  };

  // Handle export
  const handleExport = (format: 'csv' | 'pdf') => {
    const projectName = currentProject?.name || 'Production';
    const dateStr = new Date().toISOString().split('T')[0];

    if (format === 'csv') {
      const content = generateReconciliationCSV();
      const blob = new Blob([content], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spending-reconciliation-${projectName.replace(/\s+/g, '-').toLowerCase()}-${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // Generate printable HTML for PDF
      const content = generateReconciliationHTML();
      const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const newWindow = window.open(url, '_blank');
      if (newWindow) {
        newWindow.addEventListener('load', () => {
          setTimeout(() => newWindow.print(), 500);
        });
      }
      URL.revokeObjectURL(url);
    }
    setShowExportModal(false);
  };

  // Generate printable HTML for PDF export
  const generateReconciliationHTML = (): string => {
    const projectName = currentProject?.name || 'Production';
    const currencyInfo = getCurrencyByCode(currency);
    const sym = currencyInfo.symbol;
    const exportDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const sortedReceipts = [...receipts].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const receiptsWithImages = sortedReceipts.filter(r => r.imageUri);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Spending Reconciliation - ${projectName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 32px;
      max-width: 800px;
      margin: 0 auto;
      color: #1a1a1a;
      font-size: 13px;
      line-height: 1.5;
    }

    /* Header */
    .header { margin-bottom: 28px; }
    .header h1 { font-size: 22px; font-weight: 700; color: #1a1a1a; margin-bottom: 2px; }
    .header .project { font-size: 15px; color: #C9A962; font-weight: 600; margin-bottom: 4px; }
    .header .date { font-size: 12px; color: #888; }

    /* Summary Cards */
    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 28px;
    }
    .summary-card {
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 14px 12px;
      text-align: center;
    }
    .summary-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 4px; }
    .summary-card .value { font-size: 20px; font-weight: 700; color: #1a1a1a; }
    .summary-card.gold { border-color: #C9A962; background: #faf6ed; }
    .summary-card.gold .value { color: #C9A962; }
    .summary-card.over .value { color: #dc3545; }

    /* Progress Bar */
    .progress-wrap { margin-bottom: 28px; }
    .progress-bar { height: 8px; background: #f0f0f0; border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 4px; background: #C9A962; }
    .progress-fill.over { background: #dc3545; }
    .progress-label { display: flex; justify-content: space-between; margin-top: 4px; font-size: 11px; color: #888; }

    /* Sections */
    .section { margin-bottom: 28px; }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #888;
      padding-bottom: 6px;
      border-bottom: 2px solid #C9A962;
      margin-bottom: 12px;
    }

    /* Category Breakdown */
    .cat-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
    .cat-row .name { color: #333; }
    .cat-row .bar-wrap { flex: 1; margin: 0 16px; display: flex; align-items: center; }
    .cat-bar { height: 6px; background: #C9A962; border-radius: 3px; opacity: 0.6; }
    .cat-row .amt { font-weight: 600; color: #1a1a1a; min-width: 80px; text-align: right; }
    .cat-total { display: flex; justify-content: space-between; padding: 10px 0; border-top: 2px solid #C9A962; font-weight: 700; margin-top: 4px; }

    /* Receipts Table */
    table.receipts { width: 100%; border-collapse: collapse; }
    table.receipts th {
      background: #f8f8f8;
      padding: 10px 8px;
      text-align: left;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: #666;
      border-bottom: 2px solid #e5e5e5;
    }
    table.receipts td {
      padding: 10px 8px;
      border-bottom: 1px solid #f0f0f0;
      vertical-align: top;
    }
    table.receipts tr:last-child td { border-bottom: none; }
    table.receipts .num { text-align: center; color: #aaa; font-size: 11px; }
    table.receipts .amt { text-align: right; font-weight: 600; white-space: nowrap; }
    table.receipts .cat { font-size: 11px; color: #666; }
    table.receipts .desc { font-size: 11px; color: #999; }
    table.receipts tfoot td { border-top: 2px solid #C9A962; font-weight: 700; padding-top: 12px; }

    /* Receipt Filing */
    .filing-entry {
      page-break-inside: avoid;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 16px;
    }
    .filing-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      background: #f8f8f8;
      border-bottom: 1px solid #e5e5e5;
    }
    .filing-header .vendor { font-weight: 600; font-size: 14px; }
    .filing-header .amount { font-weight: 700; font-size: 14px; }
    .filing-meta {
      display: flex;
      gap: 16px;
      padding: 8px 14px;
      font-size: 11px;
      color: #666;
      border-bottom: 1px solid #f0f0f0;
    }
    .filing-meta span { display: flex; align-items: center; gap: 4px; }
    .filing-image {
      padding: 12px;
      text-align: center;
      background: #fafafa;
    }
    .filing-image img {
      max-width: 100%;
      max-height: 500px;
      object-fit: contain;
      border-radius: 4px;
    }

    /* Footer */
    .footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #e5e5e5;
      font-size: 11px;
      color: #aaa;
      text-align: center;
    }

    @media print {
      body { padding: 16px; }
      .summary-card.gold, table.receipts th, .filing-header {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .filing-entry { page-break-inside: avoid; }
      .receipt-filing { page-break-before: always; }
    }
  </style>
</head>
<body>

  <div class="header">
    <h1>Spending Reconciliation</h1>
    <div class="project">${projectName}</div>
    <div class="date">Exported ${exportDate}</div>
  </div>

  <div class="summary">
    <div class="summary-card">
      <div class="label">Budget</div>
      <div class="value">${sym}${budgetTotal.toFixed(2)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Spent</div>
      <div class="value">${sym}${totalSpent.toFixed(2)}</div>
    </div>
    <div class="summary-card ${remainingBudget >= 0 ? 'gold' : 'over'}">
      <div class="label">${remainingBudget >= 0 ? 'Remaining' : 'Over Budget'}</div>
      <div class="value">${sym}${Math.abs(remainingBudget).toFixed(2)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Used</div>
      <div class="value">${percentUsed.toFixed(1)}%</div>
    </div>
  </div>

  <div class="progress-wrap">
    <div class="progress-bar">
      <div class="progress-fill ${percentUsed > 100 ? 'over' : ''}" style="width: ${Math.min(percentUsed, 100)}%"></div>
    </div>
    <div class="progress-label">
      <span>0%</span>
      <span>Budget utilisation</span>
      <span>100%</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Financial Reconciliation</div>
    <table style="width:100%; border-collapse:collapse; font-size:13px;">
      <tbody>
        <tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:8px 0; color:#666">Total Budget</td>
          <td style="padding:8px 0; text-align:right; font-weight:600">${sym}${budgetTotal.toFixed(2)}</td>
        </tr>
        ${floatReceived > 0 ? `
        <tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:8px 0; color:#666">Float Received</td>
          <td style="padding:8px 0; text-align:right; font-weight:600">${sym}${floatReceived.toFixed(2)}</td>
        </tr>` : ''}
        <tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:8px 0; color:#666">Total Spent</td>
          <td style="padding:8px 0; text-align:right; font-weight:600">${sym}${totalSpent.toFixed(2)}</td>
        </tr>
        ${totalVat > 0 ? `
        <tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:8px 0; color:#666">Total VAT (included in spent)</td>
          <td style="padding:8px 0; text-align:right; font-weight:600">${sym}${totalVat.toFixed(2)}</td>
        </tr>
        <tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:8px 0; color:#666">Spend excl. VAT</td>
          <td style="padding:8px 0; text-align:right; font-weight:600">${sym}${(totalSpent - totalVat).toFixed(2)}</td>
        </tr>` : ''}
        ${floatReceived > 0 ? `
        <tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:8px 0; color:#666">Float Remaining</td>
          <td style="padding:8px 0; text-align:right; font-weight:700; color:${floatReceived - totalSpent >= 0 ? '#198754' : '#dc3545'}">${sym}${(floatReceived - totalSpent).toFixed(2)}</td>
        </tr>` : ''}
        ${floatReceived > 0 && floatReceived < budgetTotal ? `
        <tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:8px 0; color:#666">Outstanding from Production</td>
          <td style="padding:8px 0; text-align:right; font-weight:700; color:#C9A962">${sym}${(budgetTotal - floatReceived).toFixed(2)}</td>
        </tr>` : ''}
        ${floatReceived > 0 && totalSpent > floatReceived ? `
        <tr>
          <td style="padding:8px 0; color:#666">Owed by Production (overspend on float)</td>
          <td style="padding:8px 0; text-align:right; font-weight:700; color:#dc3545">${sym}${(totalSpent - floatReceived).toFixed(2)}</td>
        </tr>` : ''}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Spending by Category</div>
    ${CATEGORIES.filter(cat => byCategory[cat] > 0).map(cat => {
      const catPct = totalSpent > 0 ? (byCategory[cat] / totalSpent) * 100 : 0;
      return `
      <div class="cat-row">
        <span class="name">${cat}</span>
        <span class="bar-wrap"><span class="cat-bar" style="width: ${catPct}%"></span></span>
        <span class="amt">${sym}${byCategory[cat].toFixed(2)}</span>
      </div>`;
    }).join('')}
    <div class="cat-total">
      <span>Total</span>
      <span>${sym}${totalSpent.toFixed(2)}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Receipt Log (${receipts.length} receipts)</div>
    <table class="receipts">
      <thead>
        <tr>
          <th style="width:30px">#</th>
          <th>Date</th>
          <th>Vendor</th>
          <th>Category</th>
          <th>Description</th>
          <th class="amt">VAT</th>
          <th class="amt">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${sortedReceipts.map((r, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td>${new Date(r.date).toLocaleDateString('en-GB')}</td>
          <td>${r.vendor}</td>
          <td class="cat">${r.category}</td>
          <td class="desc">${r.description || '&mdash;'}</td>
          <td class="amt">${r.vat > 0 ? `${sym}${r.vat.toFixed(2)}` : '&mdash;'}</td>
          <td class="amt">${sym}${r.amount.toFixed(2)}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="5">Total (${receipts.length} receipts)</td>
          <td class="amt">${totalVat > 0 ? `${sym}${totalVat.toFixed(2)}` : '&mdash;'}</td>
          <td class="amt">${sym}${totalSpent.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  ${receiptsWithImages.length > 0 ? `
  <div class="section receipt-filing">
    <div class="section-title">Receipt Filing (${receiptsWithImages.length} images)</div>
    ${receiptsWithImages.map((r, i) => `
    <div class="filing-entry">
      <div class="filing-header">
        <span class="vendor">${i + 1}. ${r.vendor}</span>
        <span class="amount">${sym}${r.amount.toFixed(2)}</span>
      </div>
      <div class="filing-meta">
        <span>${new Date(r.date).toLocaleDateString('en-GB')}</span>
        <span>${r.category}</span>
        ${r.description ? `<span>${r.description}</span>` : ''}
      </div>
      <div class="filing-image">
        <img src="${r.imageUri}" alt="Receipt from ${r.vendor}">
      </div>
    </div>`).join('')}
  </div>` : ''}

  <div class="footer">
    Generated by Hair &amp; Makeup Pro &middot; ${exportDate}
  </div>

</body>
</html>`;
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
            <div className="flex items-center gap-1">
              {/* Export Button */}
              {receipts.length > 0 && (
                <button
                  onClick={() => setShowExportModal(true)}
                  className="p-2 text-text-muted active:text-gold transition-colors"
                  title="Export reconciliation"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </button>
              )}
              {/* Scan Button */}
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
            <button
              onClick={() => setShowBudgetEdit(true)}
              className="flex items-center gap-1 text-xs text-gold font-medium"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
              </svg>
              {budgetTotal > 0 ? 'Edit Budget' : 'Set Budget'}
            </button>
          </div>

          {/* Progress bar */}
          <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
            {budgetTotal > 0 ? (
              <div
                className={`absolute left-0 top-0 h-full rounded-full transition-all ${
                  percentUsed > 90 ? 'bg-error' : percentUsed > 70 ? 'bg-amber-500' : 'bg-gold'
                }`}
                style={{ width: `${Math.min(percentUsed, 100)}%` }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] text-text-light">Set a budget to track spending</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-end">
            <div>
              <span className="text-2xl font-bold text-text-primary">
                {formatCurrency(totalSpent, currency)}
              </span>
              <span className="text-sm text-text-muted ml-1">spent</span>
            </div>
            <div className="text-right">
              {budgetTotal > 0 ? (
                <>
                  <span className={`text-lg font-semibold ${
                    remainingBudget < 0 ? 'text-error' : 'text-green-600'
                  }`}>
                    {formatCurrency(remainingBudget, currency)}
                  </span>
                  <span className="text-xs text-text-muted block">remaining of {formatCurrency(budgetTotal, currency)}</span>
                </>
              ) : (
                <button
                  onClick={() => setShowBudgetEdit(true)}
                  className="text-sm text-gold font-medium"
                >
                  Tap to set budget
                </button>
              )}
            </div>
          </div>

          {/* Float & Reconciliation Summary */}
          {(floatReceived > 0 || totalVat > 0) && (
            <div className="mt-3 pt-3 border-t border-border space-y-1.5">
              {floatReceived > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Float received</span>
                  <span className="font-medium text-text-primary">{formatCurrency(floatReceived, currency)}</span>
                </div>
              )}
              {floatReceived > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Float remaining</span>
                  <span className={`font-semibold ${floatReceived - totalSpent < 0 ? 'text-error' : 'text-green-600'}`}>
                    {formatCurrency(floatReceived - totalSpent, currency)}
                  </span>
                </div>
              )}
              {totalVat > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Total VAT</span>
                  <span className="font-medium text-text-primary">{formatCurrency(totalVat, currency)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="card">
          <h2 className="section-header mb-3">BY CATEGORY</h2>
          <div className="space-y-2">
            {CATEGORIES.filter(cat => byCategory[cat] > 0).map((category) => {
              const amount = byCategory[category];
              const catPercent = totalSpent > 0 ? (amount / totalSpent) * 100 : 0;
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
            {totalSpent === 0 && (
              <p className="text-xs text-text-light text-center py-2">No expenses recorded yet</p>
            )}
          </div>
        </div>

        {/* Recent Receipts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-header">RECENT RECEIPTS</h2>
            <span className="text-xs text-text-muted">{receipts.length} total</span>
          </div>

          {receipts.length > 0 && (
            <div className="space-y-2">
              {receipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="card cursor-pointer active:scale-[0.98] transition-transform"
                  onClick={() => setSelectedReceipt(receipt)}
                >
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
                    <div className="flex items-center gap-2 ml-3">
                      <div className="text-right">
                        <span className="text-base font-bold text-text-primary">
                          {formatCurrency(receipt.amount, currency)}
                        </span>
                        {receipt.vat > 0 && (
                          <span className="text-[10px] text-text-light block">
                            VAT {formatCurrency(receipt.vat, currency)}
                          </span>
                        )}
                      </div>
                      <svg className="w-4 h-4 text-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
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
          <span className="text-sm font-medium text-gold">Add Receipt</span>
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

      {/* Budget Edit Modal */}
      {showBudgetEdit && (
        <BudgetEditModal
          currentBudget={budgetTotal}
          currentFloat={floatReceived}
          currencySymbol={currentCurrency.symbol}
          onSave={(amount, floatAmt) => {
            setBudgetTotal(amount);
            setFloatReceived(floatAmt);
            setShowBudgetEdit(false);
          }}
          onClose={() => setShowBudgetEdit(false)}
        />
      )}

      {/* Export Modal */}
      {showExportModal && (
        <ExportReconciliationModal
          onExport={handleExport}
          onClose={() => setShowExportModal(false)}
          receiptsCount={receipts.length}
          totalSpent={totalSpent}
          currencySymbol={currentCurrency.symbol}
        />
      )}

      {/* Receipt Detail/Edit Modal */}
      {selectedReceipt && (
        <ReceiptDetailModal
          receipt={selectedReceipt}
          currencySymbol={currentCurrency.symbol}
          onSave={handleUpdateReceipt}
          onDelete={handleDeleteReceipt}
          onClose={() => setSelectedReceipt(null)}
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
  const [vat, setVat] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Kit Supplies');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractedItems, setExtractedItems] = useState<Array<{ name: string; price: number }>>([]);

  // Auto-extract receipt data when image is provided
  useEffect(() => {
    if (imageUri) {
      performExtraction(imageUri);
    }
  }, [imageUri]);

  const performExtraction = async (dataUrl: string) => {
    setIsExtracting(true);
    setExtractionError(null);

    try {
      const result = await extractReceiptData(dataUrl);

      if (result.success && result.data) {
        const { data } = result;

        // Pre-fill form fields with extracted data
        if (data.vendor) {
          setVendor(data.vendor);
        }
        if (data.amount !== null) {
          setAmount(data.amount.toFixed(2));
        }
        if (data.vat !== null && data.vat !== undefined) {
          setVat(data.vat.toFixed(2));
        }
        if (data.date) {
          setDate(data.date);
        }
        if (data.items && data.items.length > 0) {
          setExtractedItems(data.items);
          // Auto-generate description from items
          setDescription(buildDescriptionFromItems(data.items));
        }

        // Show low confidence warning
        if (data.confidence === 'low') {
          setExtractionError('Some values may be inaccurate. Please review carefully.');
        }
      } else {
        setExtractionError(result.error || 'Failed to extract receipt data. Please enter manually.');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      setExtractionError('Failed to analyze receipt. Please enter details manually.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor || !amount) return;

    onAdd({
      date,
      vendor,
      amount: parseFloat(amount),
      vat: parseFloat(vat) || 0,
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
              {/* Extraction Loading Overlay */}
              {isExtracting && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                  <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin mb-3" />
                  <span className="text-white text-sm font-medium">Analyzing receipt...</span>
                </div>
              )}
            </div>
          )}

          {/* Extraction Status */}
          {extractionError && (
            <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-xs text-amber-700">{extractionError}</p>
            </div>
          )}

          {/* Auto-fill Success Indicator */}
          {!isExtracting && !extractionError && imageUri && vendor && (
            <div className="px-3 py-2 rounded-lg bg-green-50 border border-green-200">
              <p className="text-xs text-green-700">
                Receipt data extracted. Please review and edit if needed.
              </p>
            </div>
          )}

          {/* Extracted Items - Editable List */}
          {extractedItems.length > 0 && (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <p className="text-xs font-medium text-text-secondary">Detected Items:</p>
                <button
                  type="button"
                  onClick={() => setExtractedItems([...extractedItems, { name: '', price: 0 }])}
                  disabled={isExtracting}
                  className="text-[10px] font-medium text-gold hover:text-gold-dark"
                >
                  + Add Item
                </button>
              </div>
              <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {extractedItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 px-3 py-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => {
                        const updated = [...extractedItems];
                        updated[index] = { ...item, name: e.target.value };
                        setExtractedItems(updated);
                        setDescription(buildDescriptionFromItems(updated));
                      }}
                      className="flex-1 text-xs bg-transparent border-b border-transparent focus:border-gold outline-none py-1 text-text-primary"
                      placeholder="Item name"
                      disabled={isExtracting}
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-text-muted">{currencySymbol}</span>
                      <input
                        type="number"
                        step="0.01"
                        value={item.price || ''}
                        onChange={(e) => {
                          const updated = [...extractedItems];
                          updated[index] = { ...item, price: parseFloat(e.target.value) || 0 };
                          setExtractedItems(updated);
                        }}
                        className="w-16 text-xs text-right bg-transparent border-b border-transparent focus:border-gold outline-none py-1 text-text-primary"
                        placeholder="0.00"
                        disabled={isExtracting}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = extractedItems.filter((_, i) => i !== index);
                        setExtractedItems(updated);
                        setDescription(buildDescriptionFromItems(updated));
                      }}
                      disabled={isExtracting}
                      className="p-1 text-text-light hover:text-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              {/* Items Total */}
              <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 flex justify-between">
                <span className="text-xs font-medium text-text-secondary">Items Total:</span>
                <span className="text-xs font-semibold text-text-primary">
                  {currencySymbol}{extractedItems.reduce((sum, item) => sum + (item.price || 0), 0).toFixed(2)}
                </span>
              </div>
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
              disabled={isExtracting}
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
                disabled={isExtracting}
              />
            </div>
          </div>

          {/* Amount + VAT row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label block mb-1.5">VAT</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">{currencySymbol}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={vat}
                  onChange={(e) => setVat(e.target.value)}
                  className="input-field w-full pl-7"
                  placeholder="0.00"
                  disabled={isExtracting}
                />
              </div>
            </div>
            <div>
              <label className="field-label block mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-field w-full"
                disabled={isExtracting}
              />
            </div>
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
                  disabled={isExtracting}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                    category === cat
                      ? 'bg-gold text-white border-gold'
                      : 'bg-white text-text-secondary border-border hover:border-gold/50'
                  } ${isExtracting ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              disabled={isExtracting}
            />
          </div>

          {/* Submit */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-button bg-gray-100 text-text-primary font-medium"
              disabled={isExtracting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 rounded-button gold-gradient text-white font-medium disabled:opacity-50"
              disabled={!vendor || !amount || isExtracting}
            >
              {isExtracting ? 'Analyzing...' : 'Add Receipt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Receipt Detail/Edit Modal
interface ReceiptDetailModalProps {
  receipt: Receipt;
  currencySymbol: string;
  onSave: (updated: Receipt) => void;
  onDelete: (receiptId: string) => void;
  onClose: () => void;
}

function ReceiptDetailModal({ receipt, currencySymbol, onSave, onDelete, onClose }: ReceiptDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [vendor, setVendor] = useState(receipt.vendor);
  const [amount, setAmount] = useState(receipt.amount.toFixed(2));
  const [vat, setVat] = useState((receipt.vat || 0).toFixed(2));
  const [category, setCategory] = useState<ExpenseCategory>(receipt.category);
  const [description, setDescription] = useState(receipt.description);
  const [date, setDate] = useState(receipt.date);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor || !amount) return;

    onSave({
      ...receipt,
      vendor,
      amount: parseFloat(amount),
      vat: parseFloat(vat) || 0,
      category,
      description,
      date,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card rounded-t-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-text-primary">
            {isEditing ? 'Edit Receipt' : 'Receipt Details'}
          </h2>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-gold hover:text-gold-dark transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-text-muted hover:text-text-primary transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Receipt Image */}
        {receipt.imageUri && (
          <div className="relative aspect-[4/3] bg-gray-100">
            <img
              src={receipt.imageUri}
              alt="Receipt"
              className="w-full h-full object-contain"
            />
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleSave} className="p-4 space-y-4">
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

            {/* VAT + Date row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label block mb-1.5">VAT</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">{currencySymbol}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={vat}
                    onChange={(e) => setVat(e.target.value)}
                    className="input-field w-full pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="field-label block mb-1.5">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input-field w-full"
                />
              </div>
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
              <label className="field-label block mb-1.5">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field w-full"
                placeholder="e.g., Foundation restocks"
              />
            </div>

            {/* Save / Cancel */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setVendor(receipt.vendor);
                  setAmount(receipt.amount.toFixed(2));
                  setVat((receipt.vat || 0).toFixed(2));
                  setCategory(receipt.category);
                  setDescription(receipt.description);
                  setDate(receipt.date);
                  setIsEditing(false);
                }}
                className="flex-1 px-4 py-3 rounded-button bg-gray-100 text-text-primary font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 rounded-button gold-gradient text-white font-medium disabled:opacity-50"
                disabled={!vendor || !amount}
              >
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          <div className="p-4 space-y-4">
            {/* Vendor & Amount */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-text-primary">{receipt.vendor}</h3>
                <p className="text-sm text-text-muted mt-0.5">{formatShortDate(receipt.date)}</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold text-text-primary">
                  {currencySymbol}{receipt.amount.toFixed(2)}
                </span>
                {receipt.vat > 0 && (
                  <span className="text-xs text-text-muted block">incl. {currencySymbol}{receipt.vat.toFixed(2)} VAT</span>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
              {receipt.vat > 0 && (
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-text-muted">VAT</span>
                  <span className="text-sm font-medium text-text-primary">{currencySymbol}{receipt.vat.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-text-muted">Category</span>
                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-text-secondary">
                  {receipt.category}
                </span>
              </div>

              {receipt.description && (
                <div className="flex items-start justify-between py-2 border-b border-border">
                  <span className="text-sm text-text-muted">Description</span>
                  <span className="text-sm text-text-primary text-right max-w-[60%]">
                    {receipt.description}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-text-muted">Status</span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                  receipt.synced
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {receipt.synced ? 'Synced' : 'Pending'}
                </span>
              </div>
            </div>

            {/* Delete Button */}
            <div className="pt-2">
              {showDeleteConfirm ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-700 mb-3">Delete this receipt? This cannot be undone.</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 px-4 py-2.5 rounded-button bg-white border border-border text-text-primary text-sm font-medium"
                    >
                      Keep
                    </button>
                    <button
                      onClick={() => onDelete(receipt.id)}
                      className="flex-1 px-4 py-2.5 rounded-button bg-red-500 text-white text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full px-4 py-3 rounded-button text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  Delete Receipt
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Budget Edit Modal
interface BudgetEditModalProps {
  currentBudget: number;
  currentFloat: number;
  currencySymbol: string;
  onSave: (amount: number, floatAmount: number) => void;
  onClose: () => void;
}

function BudgetEditModal({ currentBudget, currentFloat, currencySymbol, onSave, onClose }: BudgetEditModalProps) {
  const [amount, setAmount] = useState(currentBudget > 0 ? currentBudget.toString() : '');
  const [floatAmt, setFloatAmt] = useState(currentFloat > 0 ? currentFloat.toString() : '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const budgetValue = parseFloat(amount);
    const floatValue = parseFloat(floatAmt) || 0;
    if (!isNaN(budgetValue) && budgetValue >= 0) {
      onSave(budgetValue, floatValue);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card rounded-t-2xl w-full max-w-lg animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary text-center">Budget Settings</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="field-label block mb-1.5">Total Budget</label>
            <p className="text-xs text-text-light mb-2">The overall budget allocated for this production.</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-lg">{currencySymbol}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-field w-full pl-8 text-2xl font-bold"
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="field-label block mb-1.5">Float Received</label>
            <p className="text-xs text-text-light mb-2">Money received in advance from production. This could be the full budget or a partial payment.</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-lg">{currencySymbol}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={floatAmt}
                onChange={(e) => setFloatAmt(e.target.value)}
                className="input-field w-full pl-8 text-xl font-bold"
                placeholder="0.00"
              />
            </div>
          </div>

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
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Export Reconciliation Modal
interface ExportReconciliationModalProps {
  onExport: (format: 'csv' | 'pdf') => void;
  onClose: () => void;
  receiptsCount: number;
  totalSpent: number;
  currencySymbol: string;
}

function ExportReconciliationModal({
  onExport,
  onClose,
  receiptsCount,
  totalSpent,
  currencySymbol,
}: ExportReconciliationModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card rounded-t-2xl w-full max-w-lg animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary text-center">Export Spending Report</h2>
        </div>

        <div className="p-4 space-y-4">
          {/* Summary */}
          <div className="rounded-xl bg-gold/5 border border-gold/20 p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-text-primary">Reconciliation Summary</p>
                <p className="text-xs text-text-muted">{receiptsCount} receipts recorded</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gold">{currencySymbol}{totalSpent.toFixed(2)}</p>
                <p className="text-xs text-text-muted">total spent</p>
              </div>
            </div>
          </div>

          <p className="text-sm text-text-muted">
            Export a spending reconciliation report to send to production. Choose your preferred format:
          </p>

          {/* Export Options */}
          <div className="space-y-3">
            {/* CSV Option */}
            <button
              onClick={() => onExport('csv')}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <span className="text-base font-semibold text-text-primary block">Spreadsheet (CSV)</span>
                <span className="text-sm text-text-muted">Opens in Excel, Google Sheets</span>
              </div>
              <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* PDF Option */}
            <button
              onClick={() => onExport('pdf')}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <span className="text-base font-semibold text-text-primary block">PDF Report</span>
                <span className="text-sm text-text-muted">Print-ready document</span>
              </div>
              <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
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
