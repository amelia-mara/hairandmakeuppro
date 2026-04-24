/**
 * Shared helpers for Prep export flows (Breakdown, Lookbooks, Timeline,
 * Bible, Queries).
 *
 * All exports target PDF + an appropriate secondary format (XLSX for
 * tabular data, PPTX / DOCX for visual / prose). This module only
 * contains the pieces common across every section: brand tokens that
 * mirror tokens.css, filename builders, blob downloaders, and the
 * PDF header / footer painter that stamps every page in the
 * Checks Happy aesthetic.
 */

import type { jsPDF } from 'jspdf';

/** Brand colours — keep in sync with prep/src/styles/tokens.css. */
export const BRAND = {
  orange: '#E8621A',
  orangeWarm: '#F0882A',
  terracotta: '#C4522A',
  gold: '#D4943A',
  amber: '#F5A623',
  teal: '#4ABFB0',
  cream: '#F5EFE0',
  creamDark: '#EDE4D0',
  brown: '#4A3020',
  brownLight: '#7A5C3A',
  ink: '#2A2013',
  muted: '#9A8068',
} as const;

/**
 * Preview payload returned by every renderer. The caller decides what
 * to do with it — the default flow is to show it in ExportPreviewModal
 * before triggering a download.
 */
export interface ExportPreview {
  /** Generated file, not yet persisted anywhere. */
  blob: Blob;
  /** Suggested filename the Download button uses. */
  filename: string;
  /** MIME string — also used to decide whether an iframe preview is viable. */
  mime: string;
  /** Section label shown in the modal header (e.g. "Breakdown"). */
  section: string;
  /** Short line under the filename — page / sheet / row counts, size, etc. */
  subtitle: string;
  /** Format kind for the modal's preview pane routing. */
  kind: 'pdf' | 'spreadsheet' | 'document' | 'presentation';
}

/** PDF page geometry (A4 portrait, mm units) and margins. */
export const PAGE = {
  width: 210,
  height: 297,
  margin: 16,
} as const;

/** Trigger a browser download for a Blob. Cleans up the object URL. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Strip characters that are awkward in filenames across platforms. */
function sanitizeForFilename(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/** `killa-bee-breakdown-2026-04-20.pdf` */
export function buildFilename(
  projectName: string | undefined,
  section: string,
  ext: 'pdf' | 'xlsx' | 'docx' | 'pptx' | 'csv',
): string {
  const name = sanitizeForFilename(projectName || 'project');
  const iso = new Date().toISOString().slice(0, 10);
  return `${name}-${sanitizeForFilename(section)}-${iso}.${ext}`;
}

/** "20 April 2026" — matches the hub card date format. */
export function formatExportDate(d: Date = new Date()): string {
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Header + footer painter stamped on every PDF page for visual cohesion. */
export interface PdfChromeOptions {
  projectName: string;
  section: string;
  scriptFilename?: string;
}

/**
 * Draw the terracotta header band + soft cream footer rule on the given
 * page. Call once per page, before placing body content — body content
 * should start at `y = PAGE.margin + 24` (mm) to clear the band.
 */
export function paintPdfChrome(doc: jsPDF, page: number, total: number, opts: PdfChromeOptions): void {
  const { projectName, section, scriptFilename } = opts;

  // ── Header band ──
  doc.setFillColor(BRAND.terracotta);
  doc.rect(0, 0, PAGE.width, 14, 'F');
  doc.setTextColor(BRAND.cream);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(13);
  doc.text(projectName, PAGE.margin, 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(section.toUpperCase(), PAGE.width - PAGE.margin, 9, { align: 'right' });

  // ── Footer ──
  doc.setDrawColor(BRAND.creamDark);
  doc.setLineWidth(0.2);
  doc.line(PAGE.margin, PAGE.height - 10, PAGE.width - PAGE.margin, PAGE.height - 10);
  doc.setTextColor(BRAND.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const leftFoot = scriptFilename ? `${scriptFilename} · ${formatExportDate()}` : formatExportDate();
  doc.text(leftFoot, PAGE.margin, PAGE.height - 5);
  doc.text(`${page} / ${total}`, PAGE.width - PAGE.margin, PAGE.height - 5, { align: 'right' });
}

/**
 * After all body content is laid down, iterate every page and stamp the
 * chrome. jspdf does not expose total page count reliably until content
 * is written, so call this at the end of a document build.
 */
export function stampPdfChromeOnAllPages(doc: jsPDF, opts: PdfChromeOptions): void {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    paintPdfChrome(doc, p, total, opts);
  }
}

/**
 * Paint the large section cover — used once at the top of page 1, below
 * the header band. Returns the y-coordinate of the next available line.
 */
export function paintPdfCover(doc: jsPDF, title: string, subtitle: string | undefined): number {
  const topY = 30;
  doc.setTextColor(BRAND.ink);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(28);
  doc.text(title, PAGE.margin, topY);

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(BRAND.muted);
    doc.text(subtitle, PAGE.margin, topY + 7);
    return topY + 16;
  }
  return topY + 10;
}
