import { useState } from 'react';
import { useTimesheetStore, addDays } from '@/stores/timesheetStore';
import { useBillingStore } from '@/stores/billingStore';
import { useProductionDetailsStore } from '@/stores/productionDetailsStore';
import { useProjectStore } from '@/stores/projectStore';
import { calculateInvoiceWithVAT, type WeekSummary } from '@/types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekSummary: WeekSummary;
  weekStartDate: string;
}

type ExportFormat = 'pdf' | 'csv' | 'invoice';

export function ExportModal({ isOpen, onClose, weekSummary, weekStartDate }: ExportModalProps) {
  const { entries, calculateEntry, rateCard } = useTimesheetStore();
  const { billingDetails } = useBillingStore();
  const projectId = useProjectStore((s) => s.currentProject?.id ?? '');
  const productionDetails = useProductionDetailsStore((s) => s.getDetails(projectId));
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
    const sym = '&pound;';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Timesheet - ${formatDateRange()}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px; max-width: 800px; margin: 0 auto; color: #1a1a1a; font-size: 13px; line-height: 1.5; }

    .header { margin-bottom: 24px; }
    .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 2px; }
    .header .period { font-size: 14px; color: #C9A962; font-weight: 600; }

    .rate-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px; }
    .rate-card { background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 8px; padding: 10px 12px; text-align: center; }
    .rate-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 2px; }
    .rate-card .value { font-size: 15px; font-weight: 700; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead th { background: #f8f8f8; padding: 10px 8px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; color: #666; border-bottom: 2px solid #e5e5e5; }
    tbody td { padding: 10px 8px; border-bottom: 1px solid #f0f0f0; }
    tbody tr:last-child td { border-bottom: none; }
    .day-name { font-weight: 600; }
    .sixth-tag { display: inline-block; font-size: 9px; font-weight: 600; color: #C9A962; background: #faf6ed; border: 1px solid #C9A962; border-radius: 3px; padding: 1px 4px; margin-left: 4px; vertical-align: middle; }
    .amt { text-align: right; font-weight: 600; }
    .muted { color: #ccc; }
    tfoot td { border-top: 2px solid #C9A962; font-weight: 700; padding-top: 12px; }

    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .summary-card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 14px 12px; text-align: center; }
    .summary-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 4px; }
    .summary-card .value { font-size: 20px; font-weight: 700; }
    .summary-card.gold { border-color: #C9A962; background: #faf6ed; }
    .summary-card.gold .value { color: #C9A962; }

    .sign-off { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
    .sign-line { border-top: 1px solid #ccc; padding-top: 8px; font-size: 11px; color: #888; }

    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #aaa; text-align: center; }

    @media print {
      body { padding: 16px; }
      .rate-card, .summary-card.gold, thead th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>

  <div class="header">
    <h1>Timesheet</h1>
    <div class="period">${formatDateRange()}</div>
  </div>

  <div class="rate-cards">
    <div class="rate-card">
      <div class="label">Daily Rate</div>
      <div class="value">${sym}${rateCard.dailyRate.toFixed(2)}</div>
    </div>
    <div class="rate-card">
      <div class="label">Base Day</div>
      <div class="value">${rateCard.baseDayHours} hrs</div>
    </div>
    <div class="rate-card">
      <div class="label">Hourly Rate</div>
      <div class="value">${sym}${hourlyRate.toFixed(2)}</div>
    </div>
    <div class="rate-card">
      <div class="label">Kit Rental</div>
      <div class="value">${sym}${rateCard.kitRental.toFixed(2)}/day</div>
    </div>
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
        <th class="amt">Earnings</th>
      </tr>
    </thead>
    <tbody>
      ${weekEntries.map(({ date, entry, calc }) => `
      <tr>
        <td><span class="day-name">${formatDate(date)}</span>${entry.isSixthDay ? '<span class="sixth-tag">6th Day</span>' : ''}</td>
        <td>${entry.preCall || '<span class="muted">&mdash;</span>'}</td>
        <td>${entry.unitCall || '<span class="muted">&mdash;</span>'}</td>
        <td>${entry.wrapOut || '<span class="muted">&mdash;</span>'}</td>
        <td>${calc.totalHours.toFixed(1)}</td>
        <td>${calc.otHours > 0 ? calc.otHours.toFixed(1) : '<span class="muted">&mdash;</span>'}</td>
        <td class="amt">${sym}${calc.totalEarnings.toFixed(2)}</td>
      </tr>`).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4">Total (${daysWorked} days)</td>
        <td>${weekSummary.totalHours.toFixed(1)}</td>
        <td>${weekSummary.otHours > 0 ? weekSummary.otHours.toFixed(1) : '&mdash;'}</td>
        <td class="amt">${sym}${weekSummary.totalEarnings.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="summary">
    <div class="summary-card">
      <div class="label">Days Worked</div>
      <div class="value">${daysWorked}</div>
    </div>
    <div class="summary-card">
      <div class="label">Total Hours</div>
      <div class="value">${weekSummary.totalHours.toFixed(1)}</div>
    </div>
    <div class="summary-card">
      <div class="label">OT Hours</div>
      <div class="value">${weekSummary.otHours.toFixed(1)}</div>
    </div>
    <div class="summary-card gold">
      <div class="label">Total Earnings</div>
      <div class="value">${sym}${weekSummary.totalEarnings.toFixed(2)}</div>
    </div>
  </div>

  <div class="sign-off">
    <div>
      <div class="sign-line">Employee Signature</div>
    </div>
    <div>
      <div class="sign-line">Date</div>
    </div>
  </div>

  <div class="footer">
    Generated by Hair &amp; Makeup Pro
  </div>

</body>
</html>`;
  };

  // Generate invoice HTML using billing details + production invoicing details
  const generateInvoice = (): string => {
    const hourlyRate = rateCard.dailyRate / rateCard.baseDayHours;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const invoiceDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const sym = '&pound;';

    // Pull real data from stores
    const bd = billingDetails;
    const pd = productionDetails;
    const vat = calculateInvoiceWithVAT(weekSummary.totalEarnings, bd.vatSettings);

    // Format multi-line address with <br> tags
    const fmtAddr = (addr: string) =>
      addr ? addr.split('\n').map((l) => l.trim()).filter(Boolean).join('<br>') : '';

    // Determine the "Bill To" address — use invoice address if flagged different
    const billToAddress = pd.invoiceAddressDifferent && pd.invoiceAddress
      ? fmtAddr(pd.invoiceAddress)
      : fmtAddr(pd.productionAddress);

    // Build reference lines (PO number, cost code, job ref) if provided
    const refLines: string[] = [];
    if (pd.poNumber) refLines.push(`<strong>PO:</strong> ${pd.poNumber}`);
    if (pd.costCode) refLines.push(`<strong>Cost Code:</strong> ${pd.costCode}`);
    if (pd.jobReference) refLines.push(`<strong>Job Ref:</strong> ${pd.jobReference}`);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoiceNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #1a1a1a; font-size: 14px; line-height: 1.5; }

    .inv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; padding-bottom: 20px; border-bottom: 3px solid #C9A962; }
    .inv-brand { font-size: 20px; font-weight: 700; color: #1a1a1a; }
    .inv-brand-sub { font-size: 12px; color: #888; margin-top: 2px; }
    .inv-title-block { text-align: right; }
    .inv-title { font-size: 28px; font-weight: 800; color: #C9A962; letter-spacing: 2px; }
    .inv-number { font-size: 13px; color: #666; margin-top: 2px; }

    .inv-details { display: flex; justify-content: space-between; margin-bottom: 32px; }
    .inv-col h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 8px; font-weight: 600; }
    .inv-col p { font-size: 13px; color: #333; line-height: 1.7; }
    .inv-col strong { font-weight: 600; }
    .inv-placeholder { color: #bbb; font-style: italic; }

    table.inv-table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    table.inv-table thead th { text-align: left; padding: 10px 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; color: #666; border-bottom: 2px solid #e5e5e5; }
    table.inv-table tbody td { padding: 14px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    table.inv-table tbody tr:last-child td { border-bottom: none; }
    table.inv-table .desc-sub { font-size: 12px; color: #888; margin-top: 2px; }
    table.inv-table .amt { text-align: right; font-weight: 600; white-space: nowrap; }

    .inv-totals { width: 280px; margin-left: auto; margin-bottom: 40px; }
    .inv-totals .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .inv-totals .row .lbl { color: #666; }
    .inv-totals .row .val { font-weight: 600; }
    .inv-totals .total-row { border-top: 2px solid #C9A962; padding-top: 10px; margin-top: 6px; }
    .inv-totals .total-row .lbl { font-weight: 700; font-size: 14px; color: #1a1a1a; }
    .inv-totals .total-row .val { font-weight: 800; font-size: 18px; color: #C9A962; }

    .inv-bank { background: #f8f8f8; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px; font-size: 12px; color: #666; }
    .inv-bank strong { color: #333; }
    .inv-terms { background: #f8f8f8; border-radius: 8px; padding: 16px 20px; margin-bottom: 32px; font-size: 12px; color: #666; }
    .inv-terms strong { color: #333; }
    .inv-refs { font-size: 12px; color: #666; margin-bottom: 16px; }
    .inv-refs strong { color: #333; }
    .inv-notes { font-size: 12px; color: #666; font-style: italic; margin-bottom: 16px; }

    .inv-footer { padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 11px; color: #aaa; text-align: center; }

    @media print {
      body { padding: 20px; }
      .inv-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>

  <div class="inv-header">
    <div>
      <div class="inv-brand">${bd.businessName || bd.fullName || '<span class="inv-placeholder">[Your Name]</span>'}</div>
      <div class="inv-brand-sub">${bd.businessName && bd.fullName ? bd.fullName : 'Freelance Services'}</div>
    </div>
    <div class="inv-title-block">
      <div class="inv-title">INVOICE</div>
      <div class="inv-number">${invoiceNumber}</div>
    </div>
  </div>

  <div class="inv-details">
    <div class="inv-col">
      <h3>From</h3>
      <p>
        ${bd.fullName ? `<strong>${bd.fullName}</strong><br>` : '<span class="inv-placeholder">[Your Name]</span><br>'}
        ${bd.address ? fmtAddr(bd.address) : '<span class="inv-placeholder">[Your Address]</span>'}
        ${bd.phone ? `<br>${bd.phone}` : ''}
        ${bd.email ? `<br>${bd.email}` : ''}
        ${vat.isVATApplicable && bd.vatSettings.vatNumber ? `<br>VAT No: ${bd.vatSettings.vatNumber}` : ''}
      </p>
    </div>
    <div class="inv-col">
      <h3>Bill To</h3>
      <p>
        ${pd.productionCompany ? `<strong>${pd.productionCompany}</strong><br>` : '<span class="inv-placeholder">[Production Company]</span><br>'}
        ${billToAddress || '<span class="inv-placeholder">[Address]</span>'}
        ${pd.accountsPayableContact ? `<br>Attn: ${pd.accountsPayableContact}` : ''}
        ${pd.accountsPayableEmail ? `<br>${pd.accountsPayableEmail}` : ''}
      </p>
    </div>
    <div class="inv-col" style="text-align: right;">
      <h3>Invoice Details</h3>
      <p>
        <strong>Date:</strong> ${invoiceDate}<br>
        <strong>Due:</strong> ${bd.paymentTerms || '30 days from receipt'}<br>
        <strong>Period:</strong> ${formatDateRange()}
      </p>
    </div>
  </div>

  <table class="inv-table">
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Rate</th>
        <th class="amt">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Hair &amp; Makeup Services &mdash; Base Day Rate<div class="desc-sub">${daysWorked} days &times; ${rateCard.baseDayHours} hours</div></td>
        <td>${daysWorked}</td>
        <td>${sym}${rateCard.dailyRate.toFixed(2)}</td>
        <td class="amt">${sym}${totals.basePay.toFixed(2)}</td>
      </tr>
      ${totals.preCallPay > 0 ? `
      <tr>
        <td>Pre-Call Hours<div class="desc-sub">${totals.preCallHours.toFixed(1)} hours at hourly rate</div></td>
        <td>${totals.preCallHours.toFixed(1)} hrs</td>
        <td>${sym}${hourlyRate.toFixed(2)}</td>
        <td class="amt">${sym}${totals.preCallPay.toFixed(2)}</td>
      </tr>` : ''}
      ${totals.otPay > 0 ? `
      <tr>
        <td>Overtime<div class="desc-sub">At ${rateCard.otMultiplier}&times; hourly rate (${sym}${(hourlyRate * rateCard.otMultiplier).toFixed(2)}/hr)</div></td>
        <td>${weekSummary.otHours.toFixed(1)} hrs</td>
        <td>${sym}${(hourlyRate * rateCard.otMultiplier).toFixed(2)}</td>
        <td class="amt">${sym}${totals.otPay.toFixed(2)}</td>
      </tr>` : ''}
      ${totals.lateNightPay > 0 ? `
      <tr>
        <td>Late Night Hours<div class="desc-sub">${totals.lateNightHours.toFixed(1)} hours after midnight</div></td>
        <td>${totals.lateNightHours.toFixed(1)} hrs</td>
        <td>&mdash;</td>
        <td class="amt">${sym}${totals.lateNightPay.toFixed(2)}</td>
      </tr>` : ''}
      ${totals.sixthDayBonus > 0 ? `
      <tr>
        <td>6th Day Premium<div class="desc-sub">Additional 50% for 6th consecutive working day</div></td>
        <td>&mdash;</td>
        <td>&mdash;</td>
        <td class="amt">${sym}${totals.sixthDayBonus.toFixed(2)}</td>
      </tr>` : ''}
      ${weekSummary.kitRentalTotal > 0 ? `
      <tr>
        <td>Kit / Box Rental<div class="desc-sub">${daysWorked} days at ${sym}${rateCard.kitRental.toFixed(2)}/day</div></td>
        <td>${daysWorked}</td>
        <td>${sym}${rateCard.kitRental.toFixed(2)}</td>
        <td class="amt">${sym}${weekSummary.kitRentalTotal.toFixed(2)}</td>
      </tr>` : ''}
    </tbody>
  </table>

  <div class="inv-totals">
    <div class="row">
      <span class="lbl">Subtotal</span>
      <span class="val">${sym}${vat.subtotal.toFixed(2)}</span>
    </div>
    ${vat.isVATApplicable ? `
    <div class="row">
      <span class="lbl">VAT (${vat.vatRate}%)</span>
      <span class="val">${sym}${vat.vatAmount.toFixed(2)}</span>
    </div>` : ''}
    <div class="row total-row">
      <span class="lbl">Total Due</span>
      <span class="val">${sym}${vat.total.toFixed(2)}</span>
    </div>
  </div>

  ${bd.bankDetails.accountName || bd.bankDetails.sortCode || bd.bankDetails.accountNumber ? `
  <div class="inv-bank">
    <strong>Bank Details:</strong><br>
    ${bd.bankDetails.accountName ? `Account Name: ${bd.bankDetails.accountName}<br>` : ''}
    ${bd.bankDetails.sortCode ? `Sort Code: ${bd.bankDetails.sortCode}<br>` : ''}
    ${bd.bankDetails.accountNumber ? `Account Number: ${bd.bankDetails.accountNumber}` : ''}
  </div>` : ''}

  ${refLines.length > 0 ? `
  <div class="inv-refs">
    ${refLines.join(' &nbsp;|&nbsp; ')}
  </div>` : ''}

  ${pd.invoiceNotes ? `
  <div class="inv-notes">
    ${pd.invoiceNotes}
  </div>` : ''}

  <div class="inv-terms">
    <strong>Payment Terms:</strong> ${bd.paymentTerms || 'Payment within 30 days'}. Please reference invoice number <strong>${invoiceNumber}</strong> with payment.
  </div>

  <div class="inv-footer">
    Generated by Checks Happy
  </div>

</body>
</html>`;
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

      // Create blob and download (charset=utf-8 for correct £ symbol rendering)
      const blob = new Blob([content], { type: mimeType === 'text/html' ? 'text/html;charset=utf-8' : mimeType });
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
