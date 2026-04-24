/**
 * Bible export — PDF (for now).
 *
 * Mirrors the on-screen BibleTab: a cover, then three numbered
 * sections — 01 Overview (Production Details + Character References
 * + SFX summary line), 02 Characters (full profiles with 3-column
 * detail grid + looks + notes), and 03 SFX / Prosthetics Register.
 * Empty sections render a muted placeholder rather than being
 * dropped, so readers see the scaffolding of an unfinished bible.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BRAND,
  PAGE,
  buildFilename,
  formatExportDate,
  type ExportPreview,
} from './common';
import {
  billingShort,
  buildBibleExport,
  characterInitials,
  type BibleCharacterEntry,
  type BibleSfxEntry,
} from './bibleData';

const SECTION = 'Bible';
const FOOTER_Y = PAGE.height - 5;
const TOP_SAFE = 18;
const BOTTOM_SAFE = 14;

export function exportBiblePDF(projectId: string): ExportPreview {
  const { meta, characters, sfxEntries } = buildBibleExport(projectId);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ── Page 1 title band + cover ──
  paintTopBand(doc, meta.projectName);

  const coverY = 30;
  doc.setTextColor(BRAND.ink);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(32);
  doc.text('Bible', PAGE.margin, coverY);

  const subtitleParts: string[] = [];
  subtitleParts.push(meta.departmentLabel);
  if (meta.characterCount > 0) subtitleParts.push(`${meta.characterCount} character${meta.characterCount !== 1 ? 's' : ''}`);
  if (meta.sfxCount > 0) subtitleParts.push(`${meta.sfxCount} SFX ${meta.sfxCount !== 1 ? 'entries' : 'entry'}`);
  subtitleParts.push(formatExportDate(meta.generatedAt));

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(BRAND.muted);
  doc.text(subtitleParts.join(' · '), PAGE.margin, coverY + 8);

  // Teal rule under cover
  doc.setDrawColor(BRAND.teal);
  doc.setLineWidth(0.6);
  doc.line(PAGE.margin, coverY + 13, PAGE.margin + 60, coverY + 13);

  // ── 01 Overview ──
  let cursorY = coverY + 24;
  cursorY = drawSectionHeader(doc, '01', 'Overview', cursorY);
  cursorY = drawProductionDetailsCard(doc, meta, cursorY);
  cursorY = drawTealRule(doc, cursorY + 6);
  cursorY = drawSectionLabel(doc, 'Character References', cursorY + 8);
  if (characters.length > 0) {
    cursorY = drawCharacterRefGrid(doc, characters.slice(0, 6), cursorY);
  } else {
    cursorY = drawPlaceholder(
      doc,
      'No characters detected yet. Upload a script or add characters to populate this section.',
      cursorY,
    );
  }

  // ── 02 Characters ──
  cursorY = ensurePageSpace(doc, cursorY, 80);
  cursorY = drawSectionHeader(doc, '02', 'Characters', cursorY);
  if (characters.length === 0) {
    cursorY = drawPlaceholder(doc, 'No character profiles yet.', cursorY);
  } else {
    for (const entry of characters) {
      cursorY = drawCharacterProfile(doc, entry, cursorY);
    }
  }

  // ── 03 SFX / Prosthetics Register ──
  cursorY = ensurePageSpace(doc, cursorY, 40);
  cursorY = drawSectionHeader(doc, '03', 'SFX / Prosthetics Register', cursorY);
  if (sfxEntries.length === 0) {
    cursorY = drawPlaceholder(
      doc,
      'No SFX or prosthetics entries yet. Tag scenes with SFX in the Breakdown tab.',
      cursorY,
    );
  } else {
    drawSfxTable(doc, sfxEntries, cursorY);
  }

  return finalizePDF(doc, meta.projectName, formatExportDate(meta.generatedAt));
}

/* ── Chrome ────────────────────────────────────────────── */

function paintTopBand(doc: jsPDF, projectName: string): void {
  doc.setFillColor(BRAND.terracotta);
  doc.rect(0, 0, PAGE.width, 14, 'F');
  doc.setTextColor(BRAND.cream);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(13);
  doc.text(projectName, PAGE.margin, 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(SECTION.toUpperCase(), PAGE.width - PAGE.margin, 9, { align: 'right' });
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
    doc.text(footerLeft, PAGE.margin, FOOTER_Y);
    doc.text(`${p} / ${total}`, PAGE.width - PAGE.margin, FOOTER_Y, { align: 'right' });
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

/* ── Layout helpers ────────────────────────────────────── */

function ensurePageSpace(doc: jsPDF, cursorY: number, needed: number): number {
  if (cursorY + needed > PAGE.height - BOTTOM_SAFE) {
    doc.addPage();
    return TOP_SAFE;
  }
  return cursorY;
}

function drawSectionHeader(doc: jsPDF, num: string, title: string, y: number): number {
  const safeY = ensurePageSpace(doc, y, 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(BRAND.terracotta);
  doc.text(num, PAGE.margin, safeY);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(16);
  doc.setTextColor(BRAND.ink);
  doc.text(title, PAGE.margin + 8, safeY);
  return safeY + 7;
}

function drawSectionLabel(doc: jsPDF, label: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(BRAND.terracotta);
  doc.text(label.toUpperCase(), PAGE.margin, y);
  return y + 4;
}

function drawTealRule(doc: jsPDF, y: number): number {
  doc.setDrawColor(BRAND.teal);
  doc.setLineWidth(0.3);
  doc.line(PAGE.margin, y, PAGE.margin + 50, y);
  return y + 2;
}

function drawPlaceholder(doc: jsPDF, text: string, y: number): number {
  const safeY = ensurePageSpace(doc, y, 14);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(BRAND.muted);
  doc.text(text, PAGE.margin, safeY + 4);
  return safeY + 14;
}

/* ── Production Details card ───────────────────────────── */

function drawProductionDetailsCard(
  doc: jsPDF,
  meta: ReturnType<typeof buildBibleExport>['meta'],
  y: number,
): number {
  const safeY = ensurePageSpace(doc, y, 48);
  const usableW = PAGE.width - PAGE.margin * 2;
  const cardH = 42;

  // Card border/background
  doc.setFillColor('#FFFFFF');
  doc.setDrawColor(BRAND.creamDark);
  doc.setLineWidth(0.2);
  doc.roundedRect(PAGE.margin, safeY, usableW, cardH, 2.5, 2.5, 'FD');

  // Card title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(BRAND.ink);
  doc.text('PRODUCTION DETAILS', PAGE.margin + 5, safeY + 7);

  // 3-col grid
  const fields: Array<[string, string]> = [
    ['Production', meta.productionType],
    ['Department', meta.departmentLabel],
    ['Shoot Days', `${meta.sceneCount} scenes${meta.shootDays ? ` · ${meta.shootDays} days` : ''}`],
    ['Characters', `${meta.characterCount} principals`],
    ['SFX Scenes', meta.sfxSceneCount > 0 ? `${meta.sfxSceneCount} scenes flagged` : 'None flagged'],
    ['Generated', formatExportDate(meta.generatedAt)],
  ];

  const cols = 3;
  const colW = (usableW - 10) / cols;
  const rowH = 13;
  fields.forEach((field, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = PAGE.margin + 5 + col * colW;
    const yRow = safeY + 13 + row * rowH;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(BRAND.terracotta);
    doc.text(field[0].toUpperCase(), x, yRow);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(BRAND.ink);
    doc.text(field[1], x, yRow + 4.5, { maxWidth: colW - 4 });
  });

  return safeY + cardH + 2;
}

/* ── Character reference grid ──────────────────────────── */

function drawCharacterRefGrid(
  doc: jsPDF,
  entries: BibleCharacterEntry[],
  y: number,
): number {
  const cols = 2;
  const gap = 5;
  const usableW = PAGE.width - PAGE.margin * 2;
  const cardW = (usableW - gap * (cols - 1)) / cols;

  let cursorY = y;
  for (let i = 0; i < entries.length; i += cols) {
    const row = entries.slice(i, i + cols);
    const heights = row.map((e) => measureRefCardHeight(doc, e, cardW));
    const rowH = Math.max(...heights);

    cursorY = ensurePageSpace(doc, cursorY, rowH + gap);

    row.forEach((entry, j) => {
      const x = PAGE.margin + j * (cardW + gap);
      drawCharacterRefCard(doc, entry, x, cursorY, cardW, rowH);
    });
    cursorY += rowH + gap;
  }
  return cursorY + 2;
}

function measureRefCardHeight(
  doc: jsPDF,
  entry: BibleCharacterEntry,
  cardW: number,
): number {
  const innerW = cardW - 12 - 10; // minus padding + avatar column
  let h = 7 + 5; // top padding + avatar row base
  // Hair line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  h += doc.getTextDimensions(hairLine(entry.character), { maxWidth: innerW }).h + 2.5;
  h += doc.getTextDimensions(skinLine(entry.character), { maxWidth: innerW }).h + 2.5;
  if (entry.looks.length > 0) {
    // rough pill strip height
    h += 8;
  }
  return h + 5;
}

function drawCharacterRefCard(
  doc: jsPDF,
  entry: BibleCharacterEntry,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  doc.setFillColor('#FFFFFF');
  doc.setDrawColor(BRAND.creamDark);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 2.5, 2.5, 'FD');

  // Avatar circle — terracotta fill
  const avatarSize = 11;
  const avatarX = x + 5 + avatarSize / 2;
  const avatarY = y + 6 + avatarSize / 2;
  doc.setFillColor(BRAND.terracotta);
  doc.circle(avatarX, avatarY, avatarSize / 2, 'F');
  doc.setTextColor(BRAND.cream);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(characterInitials(entry.character.name), avatarX, avatarY + 1.4, { align: 'center' });

  const infoX = x + 5 + avatarSize + 4;

  // Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(BRAND.ink);
  doc.text(entry.character.name, infoX, y + 8);

  // Meta line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(BRAND.muted);
  const meta = [
    billingShort(entry.character.billing),
    (entry.character.gender || '').charAt(0) || '?',
    `Age ${entry.character.age || '?'}`,
  ].join(' · ');
  doc.text(meta, infoX, y + 12);

  let cursorY = y + 6 + avatarSize + 4;

  // Hair
  drawLabelLine(doc, 'Hair', hairLine(entry.character), x + 5, cursorY, w - 10);
  cursorY += 6;
  // Skin
  drawLabelLine(doc, 'Skin', skinLine(entry.character), x + 5, cursorY, w - 10);
  cursorY += 6;

  // Looks pills
  if (entry.looks.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(BRAND.terracotta);
    doc.text('LOOKS', x + 5, cursorY);
    cursorY += 3;
    drawLookTagStrip(
      doc,
      entry.looks.map((l) => l.name),
      x + 5,
      cursorY,
      w - 10,
    );
  }
}

function hairLine(ch: BibleCharacterEntry['character']): string {
  const base = ch.hairColour || '—';
  return ch.hairType ? `${base}, ${ch.hairType.toLowerCase()}` : base;
}

function skinLine(ch: BibleCharacterEntry['character']): string {
  const base = ch.skinTone || '—';
  return ch.distinguishingFeatures ? `${base}, ${ch.distinguishingFeatures.toLowerCase()}` : base;
}

function drawLabelLine(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(BRAND.terracotta);
  doc.text(label.toUpperCase(), x, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(BRAND.ink);
  doc.text(value, x + 13, y, { maxWidth: maxWidth - 13 });
}

function drawLookTagStrip(
  doc: jsPDF,
  labels: string[],
  startX: number,
  y: number,
  maxWidth: number,
): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const height = 3.8;
  const padX = 2;
  const gap = 1.5;
  let cursorX = startX;

  for (const label of labels) {
    const textW = doc.getTextWidth(label);
    const pillW = textW + padX * 2;
    if (cursorX + pillW > startX + maxWidth) break;
    doc.setFillColor(BRAND.cream);
    doc.setDrawColor(BRAND.teal);
    doc.setLineWidth(0.1);
    doc.roundedRect(cursorX, y, pillW, height, 1, 1, 'FD');
    doc.setTextColor(BRAND.teal);
    doc.text(label, cursorX + padX, y + 2.8);
    cursorX += pillW + gap;
  }
}

/* ── Character profile blocks ──────────────────────────── */

function drawCharacterProfile(
  doc: jsPDF,
  entry: BibleCharacterEntry,
  y: number,
): number {
  const safeY = ensurePageSpace(doc, y, 60);
  const usableW = PAGE.width - PAGE.margin * 2;

  // Avatar + name + meta
  const avatarSize = 13;
  const avatarX = PAGE.margin + avatarSize / 2;
  const avatarY = safeY + avatarSize / 2;
  doc.setFillColor(BRAND.terracotta);
  doc.circle(avatarX, avatarY, avatarSize / 2, 'F');
  doc.setTextColor(BRAND.cream);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(characterInitials(entry.character.name), avatarX, avatarY + 1.8, { align: 'center' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(16);
  doc.setTextColor(BRAND.terracotta);
  doc.text(entry.character.name, PAGE.margin + avatarSize + 5, safeY + 5);

  const metaLine = [
    `${billingShort(entry.character.billing)} billing`,
    entry.character.gender || 'Gender —',
    `Age ${entry.character.age || '?'}`,
    `${entry.sceneCount} scene${entry.sceneCount !== 1 ? 's' : ''}`,
  ].join(' · ');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(BRAND.muted);
  doc.text(metaLine, PAGE.margin + avatarSize + 5, safeY + 10);

  // Detail grid — 3 cols
  const detailY = safeY + avatarSize + 4;
  const cols = 3;
  const colW = (usableW - 8) / cols;
  const fields: Array<[string, string]> = [
    ['Hair Colour', entry.character.hairColour || '—'],
    ['Hair Type', entry.character.hairType || '—'],
    ['Eye Colour', entry.character.eyeColour || '—'],
    ['Skin Tone', entry.character.skinTone || '—'],
    ['Build', entry.character.build || '—'],
    ['Distinguishing Features', entry.character.distinguishingFeatures || '—'],
  ];
  const rowH = 10;
  fields.forEach((field, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = PAGE.margin + col * colW;
    const yRow = detailY + row * rowH;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(BRAND.terracotta);
    doc.text(field[0].toUpperCase(), x, yRow);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(BRAND.ink);
    doc.text(field[1], x, yRow + 4.2, { maxWidth: colW - 4 });
  });

  let cursor = detailY + rowH * 2 + 2;

  // Looks
  if (entry.looks.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(BRAND.terracotta);
    doc.text('LOOKS', PAGE.margin, cursor);
    cursor += 3;
    const pillRowEndY = drawLookDescriptionStrip(
      doc,
      entry.looks.map((l) => `${l.name}${l.description ? ` — ${l.description}` : ''}`),
      PAGE.margin,
      cursor,
      usableW,
    );
    cursor = pillRowEndY + 3;
  }

  // Notes
  if (entry.character.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(BRAND.terracotta);
    doc.text('NOTES', PAGE.margin, cursor);
    cursor += 3.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(BRAND.ink);
    const notesDim = doc.getTextDimensions(entry.character.notes, { maxWidth: usableW });
    doc.text(entry.character.notes, PAGE.margin, cursor, { maxWidth: usableW });
    cursor += notesDim.h + 2;
  }

  // Section separator
  doc.setDrawColor(BRAND.creamDark);
  doc.setLineWidth(0.15);
  doc.line(PAGE.margin, cursor + 2, PAGE.width - PAGE.margin, cursor + 2);

  return cursor + 8;
}

function drawLookDescriptionStrip(
  doc: jsPDF,
  labels: string[],
  startX: number,
  y: number,
  maxWidth: number,
): number {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const height = 4.5;
  const padX = 2.2;
  const gap = 1.8;
  let cursorX = startX;
  let cursorY = y;

  for (const label of labels) {
    const textW = doc.getTextWidth(label);
    const pillW = textW + padX * 2;
    if (cursorX + pillW > startX + maxWidth) {
      cursorX = startX;
      cursorY += height + 1.5;
    }
    doc.setFillColor(BRAND.cream);
    doc.setDrawColor(BRAND.teal);
    doc.setLineWidth(0.1);
    doc.roundedRect(cursorX, cursorY, pillW, height, 1.2, 1.2, 'FD');
    doc.setTextColor(BRAND.brown);
    doc.text(label, cursorX + padX, cursorY + 3.2);
    cursorX += pillW + gap;
  }
  return cursorY + height;
}

/* ── SFX register table ───────────────────────────────── */

function drawSfxTable(doc: jsPDF, entries: BibleSfxEntry[], y: number): void {
  const head = [['Sc', 'Character', 'Description', 'Type']];
  const body = entries.map((e) => [
    String(e.sceneNumber),
    e.characterName,
    e.description,
    e.type,
  ]);

  autoTable(doc, {
    head,
    body,
    startY: y,
    margin: { left: PAGE.margin, right: PAGE.margin, top: 18, bottom: 15 },
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
      textColor: BRAND.ink,
      lineColor: BRAND.creamDark,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: BRAND.terracotta,
      textColor: BRAND.cream,
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: { fillColor: '#FFFFFF' },
    alternateRowStyles: { fillColor: BRAND.cream },
    columnStyles: {
      0: { cellWidth: 14, fontStyle: 'bold', textColor: BRAND.terracotta, halign: 'center' },
      1: { cellWidth: 38, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 18, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 3) return;
      const entry = entries[data.row.index];
      if (!entry) return;
      data.cell.styles.fontStyle = 'bold';
      data.cell.styles.fontSize = 7;
      data.cell.styles.textColor = entry.type === 'Prosth.' ? BRAND.amber : BRAND.teal;
    },
  });
}
