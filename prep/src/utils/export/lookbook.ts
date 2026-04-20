/**
 * Lookbook export — PDF + PPTX.
 *
 * The PDF mirrors the on-screen Lookbook aesthetic: per-character
 * sections with an italic-serif name, a teal accent rule, and the
 * character's looks laid out as a compact table. The PPTX targets a
 * pitch / design-meeting workflow — one slide per character with up
 * to four looks per slide; characters with more than four looks
 * continue on a second slide, preserving ordering.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import pptxgen from 'pptxgenjs';
import {
  BRAND,
  PAGE,
  buildFilename,
  formatExportDate,
  type ExportPreview,
} from './common';
import {
  buildLookbookExport,
  characterMetaLine,
  type LookbookCharacterEntry,
} from './lookbookData';

const SECTION = 'Lookbook';
const LOOKS_PER_PPTX_SLIDE = 4;

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PDF
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function exportLookbookPDF(projectId: string): ExportPreview {
  const { meta, characters } = buildLookbookExport(projectId);

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
  doc.text('Lookbook', PAGE.margin, coverY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(BRAND.muted);
  doc.text(
    `${meta.characterCount} character${meta.characterCount !== 1 ? 's' : ''} · ${meta.lookCount} look${meta.lookCount !== 1 ? 's' : ''} · ${formatExportDate(meta.generatedAt)}`,
    PAGE.margin,
    coverY + 7,
  );

  if (characters.length === 0) {
    doc.setFont('times', 'italic');
    doc.setFontSize(13);
    doc.setTextColor(BRAND.muted);
    doc.text('No characters yet for this project.', PAGE.margin, coverY + 30);
    return finalizePDF(doc, meta.projectName, formatExportDate(meta.generatedAt));
  }

  // ── Per-character sections ──
  let cursorY = coverY + 22;
  for (const entry of characters) {
    cursorY = drawCharacterSection(doc, entry, cursorY);
  }

  return finalizePDF(doc, meta.projectName, formatExportDate(meta.generatedAt));
}

function drawCharacterSection(
  doc: jsPDF,
  entry: LookbookCharacterEntry,
  startY: number,
): number {
  const { character, looks } = entry;

  // Page-break if there's not enough room for even the header.
  if (startY > PAGE.height - 55) {
    doc.addPage();
    startY = 18;
  }

  // Character name — italic serif, terracotta
  doc.setFont('times', 'italic');
  doc.setFontSize(18);
  doc.setTextColor(BRAND.terracotta);
  doc.text(character.name.toUpperCase(), PAGE.margin, startY + 4);

  // Meta line — small muted
  const metaLine = characterMetaLine(character);
  if (metaLine) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(BRAND.muted);
    doc.text(metaLine, PAGE.margin, startY + 9);
  }

  // Teal accent rule
  doc.setDrawColor(BRAND.teal);
  doc.setLineWidth(0.4);
  doc.line(PAGE.margin, startY + 12, PAGE.margin + 60, startY + 12);

  let bodyY = startY + 16;

  if (looks.length === 0) {
    doc.setFont('times', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(BRAND.muted);
    doc.text('No looks assigned yet.', PAGE.margin, bodyY + 4);
    return bodyY + 12;
  }

  const body = looks.map((lk) => [
    lk.name,
    lk.description || '',
    lk.hair || '',
    lk.makeup || '',
    lk.wardrobe || '',
  ]);

  autoTable(doc, {
    head: [['Look', 'Description', 'Hair', 'Makeup', 'Wardrobe']],
    body,
    startY: bodyY,
    margin: { left: PAGE.margin, right: PAGE.margin, top: 18, bottom: 15 },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
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
      0: { cellWidth: 30, fontStyle: 'bold', textColor: BRAND.terracotta },
      1: { cellWidth: 42, fontStyle: 'italic' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 'auto' },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nextY = (doc as any).lastAutoTable?.finalY ?? bodyY + 10;
  return nextY + 10;
}

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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PPTX
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export async function exportLookbookPPTX(projectId: string): Promise<ExportPreview> {
  const { meta, characters } = buildLookbookExport(projectId);

  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE'; // 13.333 × 7.5 in
  pptx.title = `${meta.projectName} — Lookbook`;
  pptx.author = 'Checks Happy';

  // ── Title slide ──
  const title = pptx.addSlide();
  title.background = { color: 'FFFFFF' };
  title.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.9,
    fill: { color: 'C4522A' },
    line: { color: 'C4522A' },
  });
  title.addText(meta.projectName, {
    x: 0.7,
    y: 0.15,
    w: 12,
    h: 0.6,
    fontFace: 'Times New Roman',
    italic: true,
    fontSize: 22,
    color: 'F5EFE0',
  });
  title.addText('LOOKBOOK', {
    x: 0.7,
    y: 0.15,
    w: 12,
    h: 0.6,
    fontFace: 'Helvetica',
    fontSize: 12,
    color: 'F5EFE0',
    align: 'right',
  });
  title.addText('Lookbook', {
    x: 0.7,
    y: 2.2,
    w: 12,
    h: 1.6,
    fontFace: 'Times New Roman',
    italic: true,
    fontSize: 60,
    color: '2A2013',
  });
  title.addText(
    `${meta.characterCount} character${meta.characterCount !== 1 ? 's' : ''} · ${meta.lookCount} look${meta.lookCount !== 1 ? 's' : ''} · ${formatExportDate(meta.generatedAt)}`,
    {
      x: 0.7,
      y: 3.9,
      w: 12,
      h: 0.4,
      fontFace: 'Helvetica',
      fontSize: 14,
      color: '9A8068',
    },
  );

  // ── Character slides ──
  for (const entry of characters) {
    if (entry.looks.length === 0) {
      addCharacterSlide(pptx, meta.projectName, entry, [], 1, 1);
      continue;
    }
    const chunks = chunk(entry.looks, LOOKS_PER_PPTX_SLIDE);
    chunks.forEach((group, idx) => {
      addCharacterSlide(pptx, meta.projectName, entry, group, idx + 1, chunks.length);
    });
  }

  const blob = (await pptx.write({ outputType: 'blob' })) as Blob;
  const filename = buildFilename(meta.projectName, SECTION, 'pptx');
  const sizeKb = Math.max(1, Math.round(blob.size / 1024));
  const slideCount = 1 + characters.reduce((sum, c) => {
    const count = c.looks.length === 0 ? 1 : Math.max(1, Math.ceil(c.looks.length / LOOKS_PER_PPTX_SLIDE));
    return sum + count;
  }, 0);
  return {
    blob,
    filename,
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    section: SECTION,
    subtitle: `${slideCount} slide${slideCount !== 1 ? 's' : ''} · PPTX · ${sizeKb} KB`,
    kind: 'presentation',
  };
}

function addCharacterSlide(
  pptx: pptxgen,
  projectName: string,
  entry: LookbookCharacterEntry,
  looks: LookbookCharacterEntry['looks'],
  part: number,
  totalParts: number,
): void {
  const slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };

  // Top terracotta band
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.5,
    fill: { color: 'C4522A' },
    line: { color: 'C4522A' },
  });
  slide.addText(projectName, {
    x: 0.5,
    y: 0.04,
    w: 8,
    h: 0.42,
    fontFace: 'Times New Roman',
    italic: true,
    fontSize: 14,
    color: 'F5EFE0',
  });
  slide.addText('LOOKBOOK', {
    x: 4,
    y: 0.04,
    w: 8.8,
    h: 0.42,
    fontFace: 'Helvetica',
    fontSize: 10,
    color: 'F5EFE0',
    align: 'right',
  });

  // Character header
  const headerSuffix = totalParts > 1 ? ` (${part}/${totalParts})` : '';
  slide.addText(entry.character.name.toUpperCase() + headerSuffix, {
    x: 0.5,
    y: 0.7,
    w: 12.3,
    h: 0.6,
    fontFace: 'Times New Roman',
    italic: true,
    fontSize: 32,
    color: 'C4522A',
  });
  const metaLine = characterMetaLine(entry.character);
  if (metaLine) {
    slide.addText(metaLine, {
      x: 0.5,
      y: 1.3,
      w: 12.3,
      h: 0.3,
      fontFace: 'Helvetica',
      fontSize: 10,
      color: '9A8068',
    });
  }
  // Teal rule under the header
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5,
    y: 1.65,
    w: 4,
    h: 0.02,
    fill: { color: '4ABFB0' },
    line: { color: '4ABFB0' },
  });

  if (looks.length === 0) {
    slide.addText('No looks assigned yet.', {
      x: 0.5,
      y: 3.5,
      w: 12.3,
      h: 0.5,
      fontFace: 'Times New Roman',
      italic: true,
      fontSize: 16,
      color: '9A8068',
    });
    return;
  }

  // Grid of up to 4 looks — 2 columns × 2 rows
  const gridX = 0.5;
  const gridY = 1.9;
  const cardW = 6.2;
  const cardH = 2.6;
  const gapX = 0.3;
  const gapY = 0.3;

  looks.forEach((lk, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = gridX + col * (cardW + gapX);
    const y = gridY + row * (cardH + gapY);

    // Card border
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w: cardW,
      h: cardH,
      fill: { color: 'FFFFFF' },
      line: { color: 'EDE4D0', width: 1 },
    });

    // Look name
    slide.addText(lk.name, {
      x: x + 0.25,
      y: y + 0.18,
      w: cardW - 0.5,
      h: 0.35,
      fontFace: 'Helvetica',
      bold: true,
      fontSize: 14,
      color: '2A2013',
    });

    // Description (italic)
    let cursor = y + 0.55;
    if (lk.description) {
      slide.addText(lk.description, {
        x: x + 0.25,
        y: cursor,
        w: cardW - 0.5,
        h: 0.4,
        fontFace: 'Times New Roman',
        italic: true,
        fontSize: 11,
        color: '7A5C3A',
      });
      cursor += 0.45;
    }

    // Teal divider
    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.25,
      y: cursor + 0.05,
      w: 1.5,
      h: 0.02,
      fill: { color: '4ABFB0' },
      line: { color: '4ABFB0' },
    });
    cursor += 0.2;

    // H/M/W rows
    const rows: Array<[string, string]> = [
      ['Hair', lk.hair],
      ['Makeup', lk.makeup],
      ['Wardrobe', lk.wardrobe],
    ].filter(([, v]) => v) as Array<[string, string]>;

    for (const [label, value] of rows) {
      slide.addText(label.toUpperCase(), {
        x: x + 0.25,
        y: cursor,
        w: 1.2,
        h: 0.22,
        fontFace: 'Helvetica',
        bold: true,
        fontSize: 8,
        color: '4ABFB0',
      });
      slide.addText(value, {
        x: x + 1.5,
        y: cursor,
        w: cardW - 1.75,
        h: 0.22,
        fontFace: 'Helvetica',
        fontSize: 9,
        color: '2A2013',
      });
      cursor += 0.26;
    }
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Helpers
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
