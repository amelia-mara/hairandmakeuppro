/**
 * Lookbook export — PDF + PPTX.
 *
 * Both formats mirror the on-screen Lookbook aesthetic: per-character
 * sections with the character name, billing/appearance pills, a teal
 * accent rule, and the character's looks laid out as bordered cards
 * (name + italic description + teal rule + stacked H/M/W + scene
 * pills at the bottom, matching lb-look-card in the prep UI).
 */

import { jsPDF } from 'jspdf';
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
  characterPills,
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

/* ── PDF card-layout helpers ─────────────────────────────── */

const CARD_GAP = 6;
const CARD_COLS = 2;
const CARD_RADIUS = 2.5;
const CARD_MIN_BOTTOM = 14; // keep clear of footer rule

function drawCharacterSection(
  doc: jsPDF,
  entry: LookbookCharacterEntry,
  startY: number,
): number {
  const { character, looks, scenesByLookId } = entry;

  // Character name — italic serif terracotta (matches LookbookTab header).
  if (startY > PAGE.height - 55) {
    doc.addPage();
    startY = 18;
  }

  doc.setFont('times', 'italic');
  doc.setFontSize(18);
  doc.setTextColor(BRAND.terracotta);
  doc.text(character.name.toUpperCase(), PAGE.margin, startY + 4);

  // Pills row (billing in accent, rest in muted cream).
  const pills = characterPills(character);
  let pillsEndY = startY + 6;
  if (pills.length > 0) {
    pillsEndY = drawPillRow(doc, PAGE.margin, startY + 7.5, pills, { accentFirst: true });
  }

  // Teal rule — limits to a short accent line under the pills.
  doc.setDrawColor(BRAND.teal);
  doc.setLineWidth(0.5);
  doc.line(PAGE.margin, pillsEndY + 1.5, PAGE.margin + 60, pillsEndY + 1.5);

  let cursorY = pillsEndY + 5;

  if (looks.length === 0) {
    doc.setFont('times', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(BRAND.muted);
    doc.text('No looks assigned yet.', PAGE.margin, cursorY + 3);
    return cursorY + 10;
  }

  // Card grid — 2 per row. Each card sized to fit its content; the
  // width is fixed, height is measured before drawing so cards on
  // the same row line up (height = row max).
  const usableW = PAGE.width - PAGE.margin * 2;
  const cardW = (usableW - CARD_GAP * (CARD_COLS - 1)) / CARD_COLS;

  for (let i = 0; i < looks.length; i += CARD_COLS) {
    const row = looks.slice(i, i + CARD_COLS);
    // Measure each card's height first so the row has a uniform height.
    const heights = row.map((lk) => measureCardHeight(doc, lk, scenesByLookId[lk.id] ?? [], cardW));
    const rowHeight = Math.max(...heights);

    // Page break if this row won't fit.
    if (cursorY + rowHeight > PAGE.height - CARD_MIN_BOTTOM) {
      doc.addPage();
      cursorY = 18;
    }

    row.forEach((lk, j) => {
      const x = PAGE.margin + j * (cardW + CARD_GAP);
      drawLookCard(doc, lk, scenesByLookId[lk.id] ?? [], x, cursorY, cardW, rowHeight);
    });
    cursorY += rowHeight + CARD_GAP;
  }

  return cursorY + 6;
}

/** Draw a sequence of rounded-rect pills. Returns the baseline y of the last row. */
function drawPillRow(
  doc: jsPDF,
  x: number,
  y: number,
  labels: string[],
  opts: { accentFirst?: boolean } = {},
): number {
  const fontSize = 7.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  const padX = 2.3;
  const padY = 1.1;
  const height = 4.5;
  const gap = 2;
  const availableW = PAGE.width - PAGE.margin - x;
  let cursorX = x;
  let cursorY = y;

  labels.forEach((label, idx) => {
    const textW = doc.getTextWidth(label);
    const pillW = textW + padX * 2;
    if (cursorX + pillW > x + availableW) {
      cursorX = x;
      cursorY += height + 1.8;
    }
    const isAccent = opts.accentFirst && idx === 0;
    doc.setFillColor(isAccent ? BRAND.terracotta : BRAND.cream);
    doc.setDrawColor(isAccent ? BRAND.terracotta : BRAND.creamDark);
    doc.setLineWidth(0.1);
    doc.roundedRect(cursorX, cursorY - height + padY, pillW, height, 1, 1, 'FD');
    doc.setTextColor(isAccent ? BRAND.cream : BRAND.brown);
    doc.text(label, cursorX + padX, cursorY - 0.6);
    cursorX += pillW + gap;
  });

  return cursorY;
}

/**
 * Measure the final height of a look card so sibling cards on the
 * same row can share a consistent height.
 */
function measureCardHeight(
  doc: jsPDF,
  look: LookbookCharacterEntry['looks'][number],
  sceneNumbers: number[],
  cardW: number,
): number {
  const inner = cardW - 8;
  let h = 5; // top padding

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  h += doc.getTextDimensions(look.name, { maxWidth: inner }).h + 1.5;

  if (look.description) {
    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    h += doc.getTextDimensions(look.description, { maxWidth: inner }).h + 1;
  }

  h += 2.5; // teal rule margin

  for (const value of [look.hair, look.makeup, look.wardrobe]) {
    if (!value) continue;
    // Label line
    h += 3.4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    h += doc.getTextDimensions(value, { maxWidth: inner }).h + 1.5;
  }

  if (sceneNumbers.length > 0) {
    h += 5.5; // scene strip
  }

  return h + 5; // bottom padding
}

function drawLookCard(
  doc: jsPDF,
  look: LookbookCharacterEntry['looks'][number],
  sceneNumbers: number[],
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  // Card background + border
  doc.setFillColor('#FFFFFF');
  doc.setDrawColor(BRAND.creamDark);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, CARD_RADIUS, CARD_RADIUS, 'FD');

  const innerX = x + 4;
  const innerW = w - 8;
  let cursorY = y + 6;

  // Name — bold, uppercase-ish via font
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(BRAND.ink);
  const nameDim = doc.getTextDimensions(look.name, { maxWidth: innerW });
  doc.text(look.name, innerX, cursorY, { maxWidth: innerW });
  cursorY += nameDim.h + 1.5;

  // Description — italic muted
  if (look.description) {
    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(BRAND.brownLight);
    const descDim = doc.getTextDimensions(look.description, { maxWidth: innerW });
    doc.text(look.description, innerX, cursorY, { maxWidth: innerW });
    cursorY += descDim.h + 1;
  }

  // Teal gradient-approximation rule (solid thin line)
  doc.setDrawColor(BRAND.teal);
  doc.setLineWidth(0.3);
  doc.line(innerX, cursorY + 0.5, innerX + 22, cursorY + 0.5);
  cursorY += 2.5;

  // H / M / W rows — label uppercase teal, value on next line
  const rows: Array<[string, string]> = [];
  if (look.hair) rows.push(['HAIR', look.hair]);
  if (look.makeup) rows.push(['MAKEUP', look.makeup]);
  if (look.wardrobe) rows.push(['WARDROBE', look.wardrobe]);

  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(BRAND.teal);
    doc.text(label, innerX, cursorY);
    cursorY += 3.4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(BRAND.ink);
    const valDim = doc.getTextDimensions(value, { maxWidth: innerW });
    doc.text(value, innerX, cursorY, { maxWidth: innerW });
    cursorY += valDim.h + 1.5;
  }

  // Scene pills strip (matches on-screen lb-scene-pill)
  if (sceneNumbers.length > 0) {
    const labels = sceneNumbers.map((n) => `Sc ${n}`);
    drawScenePills(doc, innerX, y + h - 3.5, innerW, labels);
  }
}

function drawScenePills(doc: jsPDF, x: number, y: number, w: number, labels: string[]): void {
  const fontSize = 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  const padX = 2;
  const padY = 0.8;
  const height = 3.8;
  const gap = 1.5;
  let cursorX = x;

  for (const label of labels) {
    const textW = doc.getTextWidth(label);
    const pillW = textW + padX * 2;
    if (cursorX + pillW > x + w) break; // overflow — drop rest rather than wrap
    doc.setFillColor('rgba(74, 191, 176, 0.12)' as unknown as string);
    doc.setFillColor(BRAND.cream);
    doc.setDrawColor(BRAND.teal);
    doc.setLineWidth(0.1);
    doc.roundedRect(cursorX, y - height + padY, pillW, height, 1, 1, 'FD');
    doc.setTextColor(BRAND.teal);
    doc.text(label, cursorX + padX, y - 0.8);
    cursorX += pillW + gap;
  }
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

  // Pills row (matches the on-screen lb-pill row).
  const pills = characterPills(entry.character);
  addPptxPills(slide, pills, 0.5, 1.35, 12.3, { accentFirst: true });

  // Teal rule under the header
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5,
    y: 1.72,
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
  const gridY = 2.0;
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

    // Scene pills along the bottom of the card.
    const sceneNumbers = entry.scenesByLookId[lk.id] ?? [];
    if (sceneNumbers.length > 0) {
      addPptxScenePills(
        slide,
        sceneNumbers.map((n) => `Sc ${n}`),
        x + 0.25,
        y + cardH - 0.35,
        cardW - 0.5,
      );
    }
  });
}

/* ── PPTX pill helpers ─────────────────────────────────────── */

function addPptxPills(
  slide: pptxgen.Slide,
  labels: string[],
  startX: number,
  startY: number,
  maxWidth: number,
  opts: { accentFirst?: boolean } = {},
): void {
  if (labels.length === 0) return;
  const height = 0.3;
  const gap = 0.08;
  const padX = 0.12;
  // Estimate width by character count (Helvetica 10pt ≈ 0.075" per char).
  const charW = 0.075;
  let cursorX = startX;
  let cursorY = startY;

  labels.forEach((label, idx) => {
    const w = Math.max(0.55, label.length * charW + padX * 2);
    if (cursorX + w > startX + maxWidth) {
      cursorX = startX;
      cursorY += height + 0.08;
    }
    const isAccent = opts.accentFirst && idx === 0;
    slide.addShape('roundRect', {
      x: cursorX,
      y: cursorY,
      w,
      h: height,
      fill: { color: isAccent ? 'C4522A' : 'F5EFE0' },
      line: { color: isAccent ? 'C4522A' : 'EDE4D0', width: 0.5 },
      rectRadius: 0.15,
    });
    slide.addText(label, {
      x: cursorX,
      y: cursorY,
      w,
      h: height,
      fontFace: 'Helvetica',
      fontSize: 9,
      color: isAccent ? 'F5EFE0' : '4A3020',
      align: 'center',
      valign: 'middle',
    });
    cursorX += w + gap;
  });
}

function addPptxScenePills(
  slide: pptxgen.Slide,
  labels: string[],
  startX: number,
  startY: number,
  maxWidth: number,
): void {
  const height = 0.24;
  const gap = 0.06;
  const padX = 0.08;
  const charW = 0.06;
  let cursorX = startX;

  for (const label of labels) {
    const w = Math.max(0.45, label.length * charW + padX * 2);
    if (cursorX + w > startX + maxWidth) break;
    slide.addShape('roundRect', {
      x: cursorX,
      y: startY,
      w,
      h: height,
      fill: { color: 'F5EFE0' },
      line: { color: '4ABFB0', width: 0.5 },
      rectRadius: 0.12,
    });
    slide.addText(label, {
      x: cursorX,
      y: startY,
      w,
      h: height,
      fontFace: 'Helvetica',
      bold: true,
      fontSize: 7,
      color: '4ABFB0',
      align: 'center',
      valign: 'middle',
    });
    cursorX += w + gap;
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Helpers
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
