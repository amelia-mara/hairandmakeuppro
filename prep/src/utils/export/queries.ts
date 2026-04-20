/**
 * Director Queries export — PDF + XLSX.
 *
 * The PDF mirrors the on-screen Director Queries aesthetic: a warm
 * terracotta accent, italic-serif section title, scene-grouped lists
 * with a checkbox-style marker and muted strikethrough typography for
 * resolved items. The XLSX is a flat sheet suitable for filtering by
 * Status in Excel / Sheets / Numbers.
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
import { buildQueriesExport, type QueryExportGroup } from './queriesData';

const SECTION = 'Director Queries';
const FILE_STEM = 'director-queries';

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PDF
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function exportQueriesPDF(projectId: string): ExportPreview {
  const { meta, groups } = buildQueriesExport(projectId);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = PAGE.width;

  // ── Page 1 title band ──
  doc.setFillColor(BRAND.terracotta);
  doc.rect(0, 0, pageWidth, 14, 'F');
  doc.setTextColor(BRAND.cream);
  doc.setFont('times', 'italic');
  doc.setFontSize(13);
  doc.text(meta.projectName, PAGE.margin, 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(SECTION.toUpperCase(), pageWidth - PAGE.margin, 9, { align: 'right' });

  // ── Cover ──
  const coverY = 30;
  doc.setTextColor(BRAND.ink);
  doc.setFont('times', 'italic');
  doc.setFontSize(28);
  doc.text('Director Queries', PAGE.margin, coverY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(BRAND.muted);
  doc.text(
    `${meta.unresolvedCount} unresolved · ${meta.resolvedCount} resolved · ${formatExportDate(meta.generatedAt)}`,
    PAGE.margin,
    coverY + 7,
  );

  if (meta.totalCount === 0) {
    doc.setFont('times', 'italic');
    doc.setFontSize(13);
    doc.setTextColor(BRAND.muted);
    doc.text('No director queries logged for this project yet.', PAGE.margin, coverY + 30);
    return finalizePDF(doc, meta.projectName);
  }

  // ── Groups ──
  let cursorY = coverY + 20;
  for (const group of groups) {
    cursorY = drawSceneGroup(doc, group, cursorY);
  }

  return finalizePDF(doc, meta.projectName);
}

function drawSceneGroup(doc: jsPDF, group: QueryExportGroup, startY: number): number {
  // Page-break guard
  if (startY > PAGE.height - 40) {
    doc.addPage();
    startY = 18;
  }

  // Scene header — italic serif terracotta
  doc.setFont('times', 'italic');
  doc.setFontSize(14);
  doc.setTextColor(BRAND.terracotta);
  doc.text(group.sceneHeader, PAGE.margin, startY + 4);

  // Thin rule under the header
  doc.setDrawColor(BRAND.creamDark);
  doc.setLineWidth(0.2);
  doc.line(PAGE.margin, startY + 6.2, PAGE.width - PAGE.margin, startY + 6.2);

  // Queries table — two columns: status marker + text
  const body = group.queries.map((q) => [q.resolved ? '■' : '□', q.text]);

  autoTable(doc, {
    body,
    startY: startY + 8,
    margin: { left: PAGE.margin, right: PAGE.margin, top: 18, bottom: 15 },
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
      textColor: BRAND.ink,
      lineColor: BRAND.creamDark,
      lineWidth: 0.08,
    },
    bodyStyles: { fillColor: '#FFFFFF' },
    columnStyles: {
      0: {
        cellWidth: 8,
        halign: 'center',
        fontStyle: 'bold',
        textColor: BRAND.terracotta,
      },
      1: { cellWidth: 'auto' },
    },
    didParseCell: (data) => {
      const q = group.queries[data.row.index];
      if (!q) return;
      if (q.resolved) {
        // Resolved = muted + teal marker
        if (data.column.index === 0) {
          data.cell.styles.textColor = BRAND.teal;
        } else {
          data.cell.styles.textColor = BRAND.muted;
          data.cell.styles.fontStyle = 'italic';
        }
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nextY = (doc as any).lastAutoTable?.finalY ?? startY + 10;
  return nextY + 8;
}

function finalizePDF(doc: jsPDF, projectName: string): ExportPreview {
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
    [`${meta.unresolvedCount} unresolved · ${meta.resolvedCount} resolved`],
    [],
  ];

  const headers = ['Scene', 'Story Day', 'INT/EXT', 'Location', 'Day/Night', 'Query', 'Status', 'Created'];
  const rows = entries.map((e) => [
    e.sceneNumber || '',
    e.storyDay,
    e.intExt,
    e.location,
    e.dayNight,
    e.query.text,
    e.query.resolved ? 'Resolved' : 'Unresolved',
    formatCreated(e.query.createdAt),
  ]);

  const sheetData: (string | number)[][] = entries.length === 0
    ? [...summary, ['No director queries logged for this project yet.']]
    : [...summary, headers, ...rows];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  worksheet['!cols'] = [8, 10, 10, 28, 12, 60, 12, 14].map((w) => ({ wch: w }));
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
    ? `No queries yet · XLSX · ${sizeKb} KB`
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

function formatCreated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
