/**
 * Director Queries export — PDF + XLSX.
 *
 * Pulls every non-empty Notes & Queries entry from the Script
 * Breakdown panel (the pinned "Notes" textarea on each scene). Each
 * entry shows scene number + heading, the synopsis, and the note
 * text. Flagged scenes (the 🚩 toggle on the panel) are sorted to
 * the top and rendered with a terracotta accent so the urgent
 * questions land first.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  BRAND,
  PAGE,
  buildFilename,
  formatExportDate,
  type ExportPreview,
} from './common';
import { buildQueriesExport, type QueryExportEntry } from './queriesData';

const SECTION = 'Director Queries';
const FILE_STEM = 'director-queries';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PDF
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function exportQueriesPDF(projectId: string): ExportPreview {
  const { meta, entries } = buildQueriesExport(projectId);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = PAGE.width;

  // ── Page 1 title band ──
  doc.setFillColor(BRAND.terracotta);
  doc.rect(0, 0, pageWidth, 14, 'F');
  doc.setTextColor(BRAND.cream);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(13);
  doc.text(meta.projectName, PAGE.margin, 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(SECTION.toUpperCase(), pageWidth - PAGE.margin, 9, { align: 'right' });

  // ── Cover ──
  const coverY = 30;
  doc.setTextColor(BRAND.ink);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(28);
  doc.text('Director Queries', PAGE.margin, coverY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(BRAND.muted);
  const subtitleParts: string[] = [];
  if (meta.flaggedCount > 0) subtitleParts.push(`${meta.flaggedCount} flagged`);
  subtitleParts.push(`${meta.totalCount} total`);
  subtitleParts.push(formatExportDate(meta.generatedAt));
  doc.text(subtitleParts.join(' · '), PAGE.margin, coverY + 7);

  if (meta.totalCount === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(13);
    doc.setTextColor(BRAND.muted);
    doc.text(
      'No notes or queries logged for any scene yet.',
      PAGE.margin,
      coverY + 30,
    );
    return finalizePDF(doc, meta.projectName);
  }

  // ── Entries ──
  let cursorY = coverY + 20;
  for (const entry of entries) {
    cursorY = drawEntry(doc, entry, cursorY);
  }

  return finalizePDF(doc, meta.projectName);
}

function drawEntry(doc: jsPDF, entry: QueryExportEntry, startY: number): number {
  // Page-break guard so the heading + body of a single entry stay
  // together when there's only a sliver left at the bottom of a page.
  if (startY > PAGE.height - 50) {
    doc.addPage();
    startY = 18;
  }

  // Scene heading — terracotta with a flag pill if the user has
  // marked this note as a query on the breakdown panel.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(BRAND.terracotta);
  doc.text(entry.sceneHeader, PAGE.margin, startY + 4);

  if (entry.flagged) {
    const labelW = 18;
    doc.setFillColor(BRAND.terracotta);
    doc.roundedRect(PAGE.width - PAGE.margin - labelW, startY, labelW, 5.5, 1.4, 1.4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(BRAND.cream);
    doc.text('FLAGGED', PAGE.width - PAGE.margin - labelW / 2, startY + 3.8, { align: 'center' });
  }

  // Thin rule under the heading
  doc.setDrawColor(BRAND.creamDark);
  doc.setLineWidth(0.2);
  doc.line(PAGE.margin, startY + 6.5, PAGE.width - PAGE.margin, startY + 6.5);

  let cursorY = startY + 11;
  const innerWidth = PAGE.width - PAGE.margin * 2;

  // Synopsis (italic muted) — only if present
  if (entry.synopsis) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(BRAND.muted);
    const synopsisLines = doc.splitTextToSize(entry.synopsis, innerWidth);
    doc.text(synopsisLines, PAGE.margin, cursorY);
    cursorY += synopsisLines.length * 4.2 + 2;
  }

  // Note label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(entry.flagged ? BRAND.terracotta : BRAND.muted);
  doc.text(entry.flagged ? 'QUERY' : 'NOTE', PAGE.margin, cursorY);
  cursorY += 3.2;

  // Note text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(BRAND.ink);
  const noteLines = doc.splitTextToSize(entry.noteText, innerWidth);
  doc.text(noteLines, PAGE.margin, cursorY);
  cursorY += noteLines.length * 4.6 + 6;

  return cursorY;
}

function finalizePDF(doc: jsPDF, projectName: string): ExportPreview {
  // Silence the unused-import linter for autoTable — keep it imported
  // so future-iteration tabular layouts don't have to re-add the dep.
  void autoTable;

  const footerLeft = formatExportDate();
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(BRAND.creamDark);
    doc.setLineWidth(0.2);
    doc.line(PAGE.margin, PAGE.height - 10, PAGE.width - PAGE.margin, PAGE.height - 10);
    doc.setTextColor(BRAND.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(footerLeft, PAGE.margin, PAGE.height - 5);
    doc.text(`${p} / ${total}`, PAGE.width - PAGE.margin, PAGE.height - 5, { align: 'right' });
  }

  const blob = doc.output('blob');
  const filename = buildFilename(projectName, FILE_STEM, 'pdf');
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   XLSX
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function exportQueriesXLSX(projectId: string): ExportPreview {
  const { meta, entries } = buildQueriesExport(projectId);

  const summary: (string | number)[][] = [
    [meta.projectName],
    [`Director Queries · ${formatExportDate(meta.generatedAt)}`],
    [`${meta.flaggedCount} flagged · ${meta.totalCount} total`],
    [],
  ];

  const headers = ['Scene', 'Heading', 'Story Day', 'Synopsis', 'Note', 'Flagged'];
  const rows = entries.map((e) => [
    e.sceneNumber || '',
    e.sceneHeader,
    e.storyDay,
    e.synopsis,
    e.noteText,
    e.flagged ? 'Yes' : '',
  ]);

  const sheetData: (string | number)[][] = entries.length === 0
    ? [...summary, ['No notes or queries logged for any scene yet.']]
    : [...summary, headers, ...rows];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  worksheet['!cols'] = [8, 38, 10, 60, 60, 10].map((w) => ({ wch: w }));
  if (entries.length > 0) {
    worksheet['!freeze'] = { xSplit: 0, ySplit: summary.length + 1 } as never;
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Queries');

  const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const blob = new Blob([out], { type: mime });
  const filename = buildFilename(meta.projectName, FILE_STEM, 'xlsx');
  const sizeKb = Math.max(1, Math.round(blob.size / 1024));
  const subtitle = entries.length === 0
    ? `No notes yet · XLSX · ${sizeKb} KB`
    : `${entries.length} row${entries.length !== 1 ? 's' : ''} · ${headers.length} columns · XLSX · ${sizeKb} KB`;
  return {
    blob,
    filename,
    mime,
    section: SECTION,
    subtitle,
    kind: 'spreadsheet',
  };
}
