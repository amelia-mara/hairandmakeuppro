/**
 * Timeline export — PDF + XLSX.
 *
 * The PDF mirrors the Schedule page's day-by-day layout: a cover with
 * counts, an optional Cast List grid, then one terracotta day header
 * per shooting day followed by a scenes table in the Breakdown style.
 * The XLSX is a flat "one row per scene-on-day" sheet plus a Cast
 * sheet for ADs who want to filter or pivot.
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
import { buildTimelineExport } from './timelineData';

const SECTION = 'Timeline';

/** Build a preview-ready PDF — one cover page + per-day blocks. */
export function exportTimelinePDF(projectId: string): ExportPreview {
  const { meta, castList, days } = buildTimelineExport(projectId);

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
  doc.text('Timeline', PAGE.margin, coverY);

  const subtitleParts: string[] = [];
  if (meta.totalDays > 0) subtitleParts.push(`${meta.totalDays} day${meta.totalDays !== 1 ? 's' : ''}`);
  if (meta.totalScenes > 0) subtitleParts.push(`${meta.totalScenes} scene${meta.totalScenes !== 1 ? 's' : ''}`);
  if (meta.castCount > 0) subtitleParts.push(`${meta.castCount} cast`);
  subtitleParts.push(formatExportDate(meta.generatedAt));

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(BRAND.muted);
  doc.text(subtitleParts.join(' · '), PAGE.margin, coverY + 7);

  if (meta.productionName || meta.scriptVersion || meta.scheduleVersion) {
    const meta2: string[] = [];
    if (meta.productionName) meta2.push(meta.productionName);
    if (meta.scriptVersion) meta2.push(`Script ${meta.scriptVersion}`);
    if (meta.scheduleVersion) meta2.push(`Schedule ${meta.scheduleVersion}`);
    doc.setFontSize(9);
    doc.text(meta2.join(' · '), PAGE.margin, coverY + 13);
  }

  // ── Empty state ──
  if (!meta.hasSchedule) {
    doc.setFont('times', 'italic');
    doc.setFontSize(13);
    doc.setTextColor(BRAND.muted);
    doc.text('No shooting schedule has been uploaded for this project yet.', PAGE.margin, coverY + 30);
    return finalizePDF(doc, meta.projectName, formatExportDate(meta.generatedAt));
  }

  // ── Cast list ──
  let cursorY = coverY + 22;
  if (castList.length > 0) {
    cursorY = drawCastList(doc, castList, cursorY);
  }

  // ── Day blocks ──
  for (const day of days) {
    cursorY = drawDayBlock(doc, day, cursorY);
  }

  return finalizePDF(doc, meta.projectName, formatExportDate(meta.generatedAt));
}

/* ── Helpers ─────────────────────────────────────────────── */

/** Draw the Cast List as a compact two-column grid. */
function drawCastList(
  doc: jsPDF,
  castList: ReturnType<typeof buildTimelineExport>['castList'],
  startY: number,
): number {
  doc.setFont('times', 'italic');
  doc.setFontSize(14);
  doc.setTextColor(BRAND.ink);
  doc.text('Cast List', PAGE.margin, startY);

  const tableBody = castList.map((c) => [
    String(c.number),
    c.character || c.name,
    c.character ? c.name : '',
  ]);

  autoTable(doc, {
    head: [['#', 'Character', 'Actor']],
    body: tableBody,
    startY: startY + 3,
    margin: { left: PAGE.margin, right: PAGE.margin, top: 12, bottom: 15 },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
      textColor: BRAND.ink,
      lineColor: BRAND.creamDark,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: BRAND.cream,
      textColor: BRAND.brown,
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    bodyStyles: { fillColor: '#FFFFFF' },
    alternateRowStyles: { fillColor: BRAND.cream },
    columnStyles: {
      0: { cellWidth: 10, fontStyle: 'bold', textColor: BRAND.teal, halign: 'center' },
      1: { cellWidth: 70, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nextY = (doc as any).lastAutoTable?.finalY ?? startY + 10;
  return nextY + 10;
}

/** Draw a single day's header and its scenes table. */
function drawDayBlock(
  doc: jsPDF,
  day: ReturnType<typeof buildTimelineExport>['days'][number],
  startY: number,
): number {
  // Page-break estimate — if we have less than ~40mm left, push to next page.
  if (startY > PAGE.height - 50) {
    doc.addPage();
    startY = 18;
  }

  // Day header — terracotta rule + title
  doc.setDrawColor(BRAND.terracotta);
  doc.setLineWidth(0.6);
  doc.line(PAGE.margin, startY - 2, PAGE.width - PAGE.margin, startY - 2);

  doc.setFont('times', 'italic');
  doc.setFontSize(16);
  doc.setTextColor(BRAND.terracotta);
  doc.text(`Day ${day.dayNumber}`, PAGE.margin, startY + 5);

  const right: string[] = [];
  if (day.dayOfWeek) right.push(day.dayOfWeek);
  if (day.date) right.push(day.date);
  if (day.location) right.push(day.location);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(BRAND.ink);
  doc.text(right.join(' · '), PAGE.margin + 22, startY + 5);

  // Meta row (hours, notes)
  let metaY = startY + 10;
  if (day.hours || (day.notes && day.notes.length > 0)) {
    doc.setFontSize(8);
    doc.setTextColor(BRAND.muted);
    const metaParts: string[] = [];
    if (day.hours) metaParts.push(`Hours: ${day.hours}`);
    if (day.notes && day.notes.length > 0) metaParts.push(day.notes.join(' · '));
    doc.text(metaParts.join('   '), PAGE.margin, metaY);
    metaY += 2;
  }

  const scenesBody = day.scenes.map((scene) => [
    scene.sceneNumber,
    scene.intExt,
    scene.dayNight,
    scene.setLocation,
    scene.pages || '',
    scene.castNumbers.join(', '),
    scene.description || '',
  ]);

  if (scenesBody.length === 0) {
    doc.setFont('times', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(BRAND.muted);
    doc.text('No scenes scheduled for this day.', PAGE.margin + 2, metaY + 6);
    return metaY + 14;
  }

  autoTable(doc, {
    head: [['Sc', 'INT/EXT', 'Day/Night', 'Set Location', 'Pages', 'Cast', 'Description']],
    body: scenesBody,
    startY: metaY + 2,
    margin: { left: PAGE.margin, right: PAGE.margin, top: 18, bottom: 15 },
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
      fontSize: 7.5,
    },
    bodyStyles: { fillColor: '#FFFFFF' },
    alternateRowStyles: { fillColor: BRAND.cream },
    columnStyles: {
      0: { cellWidth: 12, fontStyle: 'bold', textColor: BRAND.terracotta, halign: 'center' },
      1: { cellWidth: 14, halign: 'center' },
      2: { cellWidth: 16 },
      3: { cellWidth: 38, fontStyle: 'bold' },
      4: { cellWidth: 12, halign: 'right' },
      5: { cellWidth: 22 },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nextY = (doc as any).lastAutoTable?.finalY ?? metaY + 10;
  return nextY + 8;
}

/** Stamp the footer on every page and produce the ExportPreview. */
function finalizePDF(doc: jsPDF, projectName: string, footerLeft: string): ExportPreview {
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
  const filename = buildFilename(projectName, SECTION, 'pdf');
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

/** Build a preview-ready XLSX — flat scene-on-day sheet + Cast sheet. */
export function exportTimelineXLSX(projectId: string): ExportPreview {
  const { meta, castList, flatHeaders, flatRows } = buildTimelineExport(projectId);

  const summary: (string | number)[][] = [
    [meta.projectName],
    [`Timeline · ${formatExportDate(meta.generatedAt)}`],
    [`${meta.totalDays} days · ${meta.totalScenes} scenes · ${meta.castCount} cast`],
    [],
  ];
  const scheduleSheetData: (string | number)[][] = meta.hasSchedule
    ? [...summary, flatHeaders, ...flatRows]
    : [...summary, ['No shooting schedule has been uploaded for this project yet.']];

  const scheduleSheet = XLSX.utils.aoa_to_sheet(scheduleSheetData);
  scheduleSheet['!cols'] = [8, 12, 12, 24, 10, 10, 12, 28, 8, 14, 40].map((w) => ({ wch: w }));
  scheduleSheet['!freeze'] = { xSplit: 0, ySplit: summary.length + 1 } as never;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, scheduleSheet, 'Schedule');

  if (meta.hasSchedule && castList.length > 0) {
    const castRows = [
      ['Number', 'Character', 'Actor'],
      ...castList.map((c) => [c.number, c.character || c.name, c.character ? c.name : '']),
    ];
    const castSheet = XLSX.utils.aoa_to_sheet(castRows);
    castSheet['!cols'] = [10, 30, 30].map((w) => ({ wch: w }));
    castSheet['!freeze'] = { xSplit: 0, ySplit: 1 } as never;
    XLSX.utils.book_append_sheet(workbook, castSheet, 'Cast');
  }

  const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const blob = new Blob([out], { type: mime });
  const filename = buildFilename(meta.projectName, SECTION, 'xlsx');
  const sizeKb = Math.max(1, Math.round(blob.size / 1024));
  const subtitle = meta.hasSchedule
    ? `${flatRows.length} row${flatRows.length !== 1 ? 's' : ''} · ${flatHeaders.length} columns · XLSX · ${sizeKb} KB`
    : `Empty schedule · XLSX · ${sizeKb} KB`;
  return {
    blob,
    filename,
    mime,
    section: SECTION,
    subtitle,
    kind: 'spreadsheet',
  };
}
