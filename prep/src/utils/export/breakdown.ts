/**
 * Breakdown export — PDF + XLSX.
 *
 * The PDF stamps the Checks Happy aesthetic (terracotta header band,
 * cream rows, italic serif title) via the shared helpers in
 * `./common.ts`. The XLSX is a styled version of the same table, with
 * a project summary row on top of the header for context when opened
 * in Excel / Numbers / Google Sheets.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  BRAND,
  PAGE,
  buildFilename,
  formatExportDate,
  paintPdfCover,
  stampPdfChromeOnAllPages,
  type ExportPreview,
} from './common';
import { buildBreakdownExport } from './breakdownData';

const SECTION = 'Breakdown';

/** Build a preview-ready PDF payload — caller handles display + download. */
export function exportBreakdownPDF(projectId: string): ExportPreview {
  const { meta, headers, rows } = buildBreakdownExport(projectId);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  // Landscape A4 (297 × 210) — overrides the default portrait geometry
  // in PAGE for layout purposes below.
  const pageWidth = 297;
  const pageHeight = 210;

  // ── Cover ──
  doc.setFillColor(BRAND.terracotta);
  doc.rect(0, 0, pageWidth, 14, 'F');
  doc.setTextColor(BRAND.cream);
  doc.setFont('times', 'italic');
  doc.setFontSize(13);
  doc.text(meta.projectName, PAGE.margin, 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(SECTION.toUpperCase(), pageWidth - PAGE.margin, 9, { align: 'right' });

  const coverY = paintPdfCover(
    doc,
    'Breakdown',
    `${meta.sceneCount} scenes · ${meta.characterCount} characters · ${formatExportDate(meta.generatedAt)}`,
  );

  // ── Table ──
  autoTable(doc, {
    head: [headers],
    body: rows.length > 0 ? rows : [['—', '—', 'No breakdown data', ...headers.slice(3).map(() => '')]],
    startY: coverY + 2,
    margin: { left: PAGE.margin, right: PAGE.margin, bottom: 15 },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 },
      textColor: BRAND.ink,
      lineColor: BRAND.creamDark,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: BRAND.terracotta,
      textColor: BRAND.cream,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
      cellPadding: { top: 3, right: 2.5, bottom: 3, left: 2.5 },
    },
    bodyStyles: {
      fillColor: '#FFFFFF',
    },
    alternateRowStyles: {
      fillColor: BRAND.cream,
    },
    columnStyles: {
      0: { cellWidth: 12, fontStyle: 'bold', textColor: BRAND.terracotta }, // Scene
      1: { cellWidth: 14 }, // Day
      2: { cellWidth: 28, fontStyle: 'bold' }, // Character
      3: { cellWidth: 26 }, // Look
    },
    didDrawPage: () => {
      // Re-draw the header band on each page (page chrome is painted
      // again at the end of the build via `stampPdfChromeOnAllPages`).
      doc.setFillColor(BRAND.terracotta);
      doc.rect(0, 0, pageWidth, 14, 'F');
    },
  });

  // ── Unified page chrome (header + footer, with correct page totals). ──
  // Note: we pass the landscape page geometry by temporarily overriding
  // PAGE; the chrome helper reads PAGE.width/height which are portrait.
  // We re-paint manually here to respect the landscape layout.
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    // Re-stamp header band (autoTable may have covered part of it on
    // continuation pages).
    doc.setFillColor(BRAND.terracotta);
    doc.rect(0, 0, pageWidth, 14, 'F');
    doc.setTextColor(BRAND.cream);
    doc.setFont('times', 'italic');
    doc.setFontSize(13);
    doc.text(meta.projectName, PAGE.margin, 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(SECTION.toUpperCase(), pageWidth - PAGE.margin, 9, { align: 'right' });

    // Footer
    doc.setDrawColor(BRAND.creamDark);
    doc.setLineWidth(0.2);
    doc.line(PAGE.margin, pageHeight - 10, pageWidth - PAGE.margin, pageHeight - 10);
    doc.setTextColor(BRAND.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const leftFoot = meta.scriptFilename
      ? `${meta.scriptFilename} · ${formatExportDate(meta.generatedAt)}`
      : formatExportDate(meta.generatedAt);
    doc.text(leftFoot, PAGE.margin, pageHeight - 5);
    doc.text(`${p} / ${total}`, pageWidth - PAGE.margin, pageHeight - 5, { align: 'right' });
  }
  // Silence the `stampPdfChromeOnAllPages` import on the tree shaker —
  // portrait helpers are re-used by other sections (Bible, Queries).
  void stampPdfChromeOnAllPages;

  const blob = doc.output('blob');
  const filename = buildFilename(meta.projectName, SECTION, 'pdf');
  const sizeKb = Math.max(1, Math.round(blob.size / 1024));
  return {
    blob,
    filename,
    mime: 'application/pdf',
    section: SECTION,
    subtitle: `${total} page${total !== 1 ? 's' : ''} · PDF · ${sizeKb} KB`,
    kind: 'pdf',
  };
}

/** Build a preview-ready XLSX payload — caller handles display + download. */
export function exportBreakdownXLSX(projectId: string): ExportPreview {
  const { meta, headers, rows } = buildBreakdownExport(projectId);

  // Build a top-of-sheet summary block above the headers so Excel users
  // see context (project, date, scene/character counts) without having
  // to open the PDF.
  const summary: (string | number)[][] = [
    [meta.projectName],
    [`Breakdown · ${formatExportDate(meta.generatedAt)}`],
    [`${meta.sceneCount} scenes · ${meta.characterCount} characters`],
    [],
  ];
  const sheetData: (string | number)[][] = [...summary, headers, ...rows];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  // Column widths roughly proportional to expected content.
  const widths = meta.department === 'costume'
    ? [8, 10, 22, 22, 26, 20, 18, 20, 18, 34] // Scene, Day, Char, Look, Clothing, Accessories, SFX, Env, Action, Notes
    : [8, 10, 22, 22, 22, 22, 22, 18, 20, 18, 34];
  worksheet['!cols'] = widths.map((w) => ({ wch: w }));

  // Freeze the header row so it stays visible while scrolling.
  worksheet['!freeze'] = { xSplit: 0, ySplit: summary.length + 1 } as never;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Breakdown');

  const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const blob = new Blob([out], { type: mime });
  const filename = buildFilename(meta.projectName, SECTION, 'xlsx');
  const sizeKb = Math.max(1, Math.round(blob.size / 1024));
  return {
    blob,
    filename,
    mime,
    section: SECTION,
    subtitle: `${rows.length} row${rows.length !== 1 ? 's' : ''} · ${headers.length} columns · XLSX · ${sizeKb} KB`,
    kind: 'spreadsheet',
  };
}
