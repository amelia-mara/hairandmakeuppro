import { useState } from 'react';
import { useTimesheetStore, addDays } from '@/stores/timesheetStore';
import type { WeekSummary } from '@/types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekSummary: WeekSummary;
  weekStartDate: string;
}

type ExportFormat = 'pdf' | 'csv' | 'invoice';

export function ExportModal({ isOpen, onClose, weekSummary, weekStartDate }: ExportModalProps) {
  const { entries, calculateEntry, rateCard } = useTimesheetStore();
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  if (!isOpen) return null;

  // Get entries for the current week
  const getWeekEntries = () => {
    const weekEntries = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStartDate, i);
      const entry = entries[date];
      if (entry) {
        weekEntries.push({
          date,
          entry,
          calc: calculateEntry(entry),
        });
      }
    }
    return weekEntries;
  };

  // Count days worked
  const daysWorked = weekSummary.entries.length;

  // Calculate totals from entries
  const calculateTotals = () => {
    let preCallHours = 0;
    let preCallPay = 0;
    let workingHours = 0;
    let lateNightHours = 0;
    let basePay = 0;
    let otPay = 0;
    let lateNightPay = 0;
    let sixthDayBonus = 0;

    weekSummary.entries.forEach(entry => {
      const calc = calculateEntry(entry);
      preCallHours += calc.preCallHours;
      preCallPay += calc.preCallEarnings;
      workingHours += calc.workingHours;
      lateNightHours += calc.lateNightHours;
      basePay += calc.dailyEarnings;
      otPay += calc.otEarnings;
      lateNightPay += calc.lateNightEarnings;
      sixthDayBonus += calc.sixthDayBonus;
    });

    return { preCallHours, preCallPay, workingHours, lateNightHours, basePay, otPay, lateNightPay, sixthDayBonus };
  };

  const totals = calculateTotals();

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  // Format date range for header
  const formatDateRange = () => {
    const start = new Date(weekStartDate);
    const end = new Date(addDays(weekStartDate, 6));
    return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  // Generate CSV content
  const generateCSV = (): string => {
    const weekEntries = getWeekEntries();
    const headers = [
      'Date',
      'Day Type',
      'Pre-Call',
      'Unit Call',
      'Out of Chair',
      'Wrap Out',
      '6th Day',
      'Lunch (mins)',
      'Pre-Call Hours',
      'Working Hours',
      'OT Hours',
      'Late Night Hours',
      'Total Hours',
      'Pre-Call Pay',
      'Base Pay',
      'OT Pay',
      'Late Night Pay',
      '6th Day Bonus',
      'Kit Rental',
      'Total Earnings',
      'Notes',
    ];

    const rows = weekEntries.map(({ date, entry, calc }) => [
      formatDate(date),
      entry.dayType,
      entry.preCall || '',
      entry.unitCall || '',
      entry.outOfChair || '',
      entry.wrapOut || '',
      entry.isSixthDay ? 'Yes' : 'No',
      String(entry.lunchTaken ?? 60),
      calc.preCallHours.toFixed(2),
      calc.workingHours.toFixed(2),
      calc.otHours.toFixed(2),
      calc.lateNightHours.toFixed(2),
      calc.totalHours.toFixed(2),
      calc.preCallEarnings.toFixed(2),
      calc.dailyEarnings.toFixed(2),
      calc.otEarnings.toFixed(2),
      calc.lateNightEarnings.toFixed(2),
      calc.sixthDayBonus.toFixed(2),
      calc.kitRental.toFixed(2),
      calc.totalEarnings.toFixed(2),
      entry.notes || '',
    ]);

    // Add summary row
    rows.push([
      'TOTAL',
      '', // Day Type
      '', // Pre-Call
      '', // Unit Call
      '', // Out of Chair
      '', // Wrap Out
      '', // 6th Day
      '', // Lunch
      totals.preCallHours.toFixed(2),
      totals.workingHours.toFixed(2),
      weekSummary.otHours.toFixed(2),
      totals.lateNightHours.toFixed(2),
      weekSummary.totalHours.toFixed(2),
      totals.preCallPay.toFixed(2),
      totals.basePay.toFixed(2),
      totals.otPay.toFixed(2),
      totals.lateNightPay.toFixed(2),
      totals.sixthDayBonus.toFixed(2),
      weekSummary.kitRentalTotal.toFixed(2),
      weekSummary.totalEarnings.toFixed(2),
      '', // Notes
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  };

  // Generate PDF-like HTML content (for print/save as PDF)
  const generatePDFContent = (): string => {
    const weekEntries = getWeekEntries();
    const hourlyRate = rateCard.dailyRate / rateCard.baseDayHours;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Timesheet - ${formatDateRange()}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          h1 { color: #C9A962; font-size: 24px; margin-bottom: 4px; }
          .subtitle { color: #666; font-size: 14px; margin-bottom: 20px; }
          .rate-info { background: #f5f5f5; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 12px; }
          .rate-info span { margin-right: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #C9A962; color: white; padding: 8px; text-align: left; }
          td { padding: 8px; border-bottom: 1px solid #eee; }
          tr:nth-child(even) { background: #f9f9f9; }
          .summary { margin-top: 20px; background: linear-gradient(135deg, #C9A962, #B8985A); color: white; padding: 16px; border-radius: 8px; }
          .summary h3 { margin: 0 0 12px 0; font-size: 16px; }
          .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
          .summary-item { text-align: center; }
          .summary-item .label { font-size: 10px; opacity: 0.9; }
          .summary-item .value { font-size: 18px; font-weight: bold; }
          .total-box { background: rgba(255,255,255,0.2); padding: 12px; border-radius: 8px; text-align: center; margin-top: 12px; }
          .total-box .label { font-size: 12px; opacity: 0.9; }
          .total-box .value { font-size: 28px; font-weight: bold; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Timesheet</h1>
        <p class="subtitle">${formatDateRange()}</p>

        <div class="rate-info">
          <span><strong>Daily Rate:</strong> £${rateCard.dailyRate.toFixed(2)}</span>
          <span><strong>Base Day:</strong> ${rateCard.baseDayHours} hours</span>
          <span><strong>Hourly:</strong> £${hourlyRate.toFixed(2)}/hr</span>
          <span><strong>Kit Rental:</strong> £${rateCard.kitRental.toFixed(2)}/day</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Pre-Call</th>
              <th>Unit Call</th>
              <th>Wrap</th>
              <th>Hours</th>
              <th>OT</th>
              <th>Earnings</th>
            </tr>
          </thead>
          <tbody>
            ${weekEntries.map(({ date, entry, calc }) => `
              <tr>
                <td><strong>${formatDate(date)}</strong>${entry.isSixthDay ? ' <span style="color:#C9A962">(6th)</span>' : ''}</td>
                <td>${entry.preCall || '—'}</td>
                <td>${entry.unitCall || '—'}</td>
                <td>${entry.wrapOut || '—'}</td>
                <td>${calc.totalHours.toFixed(1)}</td>
                <td>${calc.otHours > 0 ? calc.otHours.toFixed(1) : '—'}</td>
                <td>£${calc.totalEarnings.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="summary">
          <h3>Week Summary</h3>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="label">Total Hours</div>
              <div class="value">${weekSummary.totalHours.toFixed(1)}</div>
            </div>
            <div class="summary-item">
              <div class="label">Days Worked</div>
              <div class="value">${daysWorked}</div>
            </div>
            <div class="summary-item">
              <div class="label">OT Hours</div>
              <div class="value">${weekSummary.otHours.toFixed(1)}</div>
            </div>
          </div>
          <div class="total-box">
            <div class="label">Total Earnings</div>
            <div class="value">£${weekSummary.totalEarnings.toFixed(2)}</div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Generate invoice HTML
  const generateInvoice = (): string => {
    const hourlyRate = rateCard.dailyRate / rateCard.baseDayHours;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const invoiceDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoiceNumber}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #333; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
          .logo { font-size: 28px; font-weight: bold; color: #C9A962; }
          .invoice-title { text-align: right; }
          .invoice-title h1 { margin: 0; font-size: 32px; color: #C9A962; }
          .invoice-number { color: #666; font-size: 14px; }
          .details { display: flex; justify-content: space-between; margin-bottom: 40px; }
          .bill-to, .invoice-info { font-size: 14px; }
          .bill-to h3, .invoice-info h3 { margin: 0 0 8px 0; font-size: 12px; color: #999; text-transform: uppercase; }
          .period { font-size: 18px; font-weight: 600; margin-bottom: 30px; color: #333; border-bottom: 2px solid #C9A962; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { text-align: left; padding: 12px 8px; border-bottom: 2px solid #C9A962; font-size: 12px; color: #666; text-transform: uppercase; }
          td { padding: 12px 8px; border-bottom: 1px solid #eee; font-size: 14px; }
          .amount { text-align: right; }
          .subtotals { width: 300px; margin-left: auto; }
          .subtotals table { margin-bottom: 0; }
          .subtotals td { border-bottom: none; padding: 6px 0; }
          .subtotals .label { color: #666; }
          .subtotals .total { border-top: 2px solid #C9A962; font-size: 18px; font-weight: bold; }
          .total .value { color: #C9A962; }
          .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">Checks Happy</div>
          <div class="invoice-title">
            <h1>INVOICE</h1>
            <p class="invoice-number">${invoiceNumber}</p>
          </div>
        </div>

        <div class="details">
          <div class="bill-to">
            <h3>Bill To</h3>
            <p>[Production Company Name]<br>
            [Address Line 1]<br>
            [City, Postcode]</p>
          </div>
          <div class="invoice-info">
            <h3>Invoice Details</h3>
            <p><strong>Date:</strong> ${invoiceDate}<br>
            <strong>Due:</strong> 30 days from receipt<br>
            <strong>Period:</strong> ${formatDateRange()}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantity</th>
              <th>Rate</th>
              <th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Hair & Makeup Services - Base Day Rate<br><small style="color:#666">${daysWorked} days × ${rateCard.baseDayHours} hours</small></td>
              <td>${daysWorked}</td>
              <td>£${rateCard.dailyRate.toFixed(2)}</td>
              <td class="amount">£${totals.basePay.toFixed(2)}</td>
            </tr>
            ${weekSummary.otHours > 0 ? `
            <tr>
              <td>Overtime Hours<br><small style="color:#666">At ${rateCard.otMultiplier}x hourly rate (£${(hourlyRate * rateCard.otMultiplier).toFixed(2)}/hr)</small></td>
              <td>${weekSummary.otHours.toFixed(1)} hrs</td>
              <td>£${(hourlyRate * rateCard.otMultiplier).toFixed(2)}</td>
              <td class="amount">£${totals.otPay.toFixed(2)}</td>
            </tr>
            ` : ''}
            ${totals.sixthDayBonus > 0 ? `
            <tr>
              <td>6th Day Premium<br><small style="color:#666">Additional 50% for 6th working day</small></td>
              <td>—</td>
              <td>—</td>
              <td class="amount">£${totals.sixthDayBonus.toFixed(2)}</td>
            </tr>
            ` : ''}
            ${weekSummary.kitRentalTotal > 0 ? `
            <tr>
              <td>Kit / Box Rental<br><small style="color:#666">${daysWorked} days @ £${rateCard.kitRental.toFixed(2)}/day</small></td>
              <td>${daysWorked}</td>
              <td>£${rateCard.kitRental.toFixed(2)}</td>
              <td class="amount">£${weekSummary.kitRentalTotal.toFixed(2)}</td>
            </tr>
            ` : ''}
          </tbody>
        </table>

        <div class="subtotals">
          <table>
            <tr>
              <td class="label">Subtotal (Base)</td>
              <td class="amount">£${totals.basePay.toFixed(2)}</td>
            </tr>
            ${totals.otPay > 0 ? `
            <tr>
              <td class="label">Overtime</td>
              <td class="amount">£${totals.otPay.toFixed(2)}</td>
            </tr>
            ` : ''}
            ${totals.sixthDayBonus > 0 ? `
            <tr>
              <td class="label">6th Day Premium</td>
              <td class="amount">£${totals.sixthDayBonus.toFixed(2)}</td>
            </tr>
            ` : ''}
            ${weekSummary.kitRentalTotal > 0 ? `
            <tr>
              <td class="label">Kit Rental</td>
              <td class="amount">£${weekSummary.kitRentalTotal.toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr class="total">
              <td class="label">Total Due</td>
              <td class="amount value">£${weekSummary.totalEarnings.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div class="footer">
          <p>Payment terms: 30 days from invoice date<br>
          Please include invoice number with payment</p>
        </div>
      </body>
      </html>
    `;
  };

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);

    try {
      let content: string;
      let filename: string;
      let mimeType: string;

      switch (exportFormat) {
        case 'csv':
          content = generateCSV();
          filename = `timesheet-${weekStartDate}.csv`;
          mimeType = 'text/csv';
          break;
        case 'pdf':
          content = generatePDFContent();
          filename = `timesheet-${weekStartDate}.html`;
          mimeType = 'text/html';
          break;
        case 'invoice':
          content = generateInvoice();
          filename = `invoice-${weekStartDate}.html`;
          mimeType = 'text/html';
          break;
      }

      // Create blob and download
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);

      // For PDF/Invoice, open in new window for printing
      if (exportFormat === 'pdf' || exportFormat === 'invoice') {
        const newWindow = window.open(url, '_blank');
        if (newWindow) {
          newWindow.addEventListener('load', () => {
            // Auto-trigger print dialog
            setTimeout(() => newWindow.print(), 500);
          });
        }
      } else {
        // For CSV, trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2000);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">Export Timesheet</h3>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-text-muted mb-4">
            Week of {formatDateRange()}
          </p>

          {/* Format options */}
          <div className="space-y-2 mb-6">
            <label className="field-label">EXPORT FORMAT</label>

            <button
              onClick={() => setExportFormat('pdf')}
              className={`w-full p-3 rounded-card border-2 text-left transition-all ${
                exportFormat === 'pdf'
                  ? 'border-gold bg-gold-50'
                  : 'border-border bg-input-bg hover:border-gold/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  exportFormat === 'pdf' ? 'bg-gold text-white' : 'bg-gray-200 text-text-muted'
                }`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-text-primary">PDF Timesheet</div>
                  <div className="text-xs text-text-muted">Print-ready document</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => setExportFormat('csv')}
              className={`w-full p-3 rounded-card border-2 text-left transition-all ${
                exportFormat === 'csv'
                  ? 'border-gold bg-gold-50'
                  : 'border-border bg-input-bg hover:border-gold/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  exportFormat === 'csv' ? 'bg-gold text-white' : 'bg-gray-200 text-text-muted'
                }`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-text-primary">CSV Spreadsheet</div>
                  <div className="text-xs text-text-muted">For Excel/Google Sheets</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => setExportFormat('invoice')}
              className={`w-full p-3 rounded-card border-2 text-left transition-all ${
                exportFormat === 'invoice'
                  ? 'border-gold bg-gold-50'
                  : 'border-border bg-input-bg hover:border-gold/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  exportFormat === 'invoice' ? 'bg-gold text-white' : 'bg-gray-200 text-text-muted'
                }`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-text-primary">Invoice</div>
                  <div className="text-xs text-text-muted">Ready to send to production</div>
                </div>
              </div>
            </button>
          </div>

          {/* Summary preview */}
          <div className="bg-input-bg rounded-card p-3 mb-6">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <div className="text-text-muted text-xs">Days</div>
                <div className="font-semibold text-text-primary">{daysWorked}</div>
              </div>
              <div>
                <div className="text-text-muted text-xs">Hours</div>
                <div className="font-semibold text-text-primary">{weekSummary.totalHours.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-text-muted text-xs">Total</div>
                <div className="font-semibold text-gold">£{weekSummary.totalEarnings.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className={`w-full py-3 rounded-button font-medium transition-all ${
              exportSuccess
                ? 'bg-success text-white'
                : 'gold-gradient text-white active:scale-[0.98]'
            } ${isExporting ? 'opacity-70' : ''}`}
          >
            {isExporting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Exporting...
              </span>
            ) : exportSuccess ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Exported!
              </span>
            ) : (
              `Export ${exportFormat === 'pdf' ? 'PDF' : exportFormat === 'csv' ? 'CSV' : 'Invoice'}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
