/**
 * Export Utilities for Hair & Makeup Pro — XLSX Scene Breakdown
 */

import type { Project, SceneCapture } from '@/types';
import * as XLSX from 'xlsx';
import {
  BREAKDOWN_GROUP_HEADERS,
  BREAKDOWN_HEADERS,
  buildBreakdownRows,
} from './exportUtils-csv';

/** Group header fill colours */
const GROUP_COLOURS: Record<string, { fill: string; font: string }> = {
  'Scene':             { fill: '2C3E50', font: 'FFFFFF' },
  'Character':         { fill: '8E44AD', font: 'FFFFFF' },
  'Makeup':            { fill: 'E74C3C', font: 'FFFFFF' },
  'Hair':              { fill: '2980B9', font: 'FFFFFF' },
  'SFX':               { fill: 'D35400', font: 'FFFFFF' },
  'Continuity Events': { fill: '27AE60', font: 'FFFFFF' },
  'Notes & Status':    { fill: '7F8C8D', font: 'FFFFFF' },
};

/** Generate the scene breakdown as an XLSX ArrayBuffer with formatting */
export function generateSceneBreakdownXLSX(
  project: Project,
  sceneCaptures: Record<string, SceneCapture>
): ArrayBuffer {
  const rows = buildBreakdownRows(project, sceneCaptures);
  const wb = XLSX.utils.book_new();

  // Build group header row (row 1)
  const groupRow: string[] = [];
  for (const g of BREAKDOWN_GROUP_HEADERS) {
    groupRow.push(g.label);
    for (let i = 1; i < g.span; i++) groupRow.push('');
  }

  // Build data: group headers (row 0), column headers (row 1), then data rows
  const allData = [groupRow, BREAKDOWN_HEADERS, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(allData);

  // Merge group header cells
  const merges: XLSX.Range[] = [];
  let col = 0;
  for (const g of BREAKDOWN_GROUP_HEADERS) {
    if (g.span > 1) {
      merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + g.span - 1 } });
    }
    col += g.span;
  }
  ws['!merges'] = merges;

  // Column widths
  const totalCols = BREAKDOWN_HEADERS.length;
  const colWidths: XLSX.ColInfo[] = [];
  for (let i = 0; i < totalCols; i++) {
    const header = BREAKDOWN_HEADERS[i];
    let wch = 14; // default
    if (header === 'Slugline') wch = 28;
    else if (header === 'Eyes' || header === 'Wig Details' || header === 'SFX') wch = 30;
    else if (header === 'Contour & Highlight') wch = 22;
    else if (header === 'Continuity Events' || header === 'Notes') wch = 25;
    else if (header === 'Scene #' || header === 'INT/EXT' || header === 'Status') wch = 10;
    colWidths.push({ wch });
  }
  ws['!cols'] = colWidths;

  // Apply styling via cell properties
  // Group header row (row 0) — bold, coloured backgrounds
  col = 0;
  for (const g of BREAKDOWN_GROUP_HEADERS) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellRef]) ws[cellRef] = { v: g.label, t: 's' };
    ws[cellRef].s = {
      fill: { fgColor: { rgb: GROUP_COLOURS[g.label]?.fill || '333333' } },
      font: { bold: true, color: { rgb: GROUP_COLOURS[g.label]?.font || 'FFFFFF' }, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } },
      },
    };
    col += g.span;
  }

  // Column header row (row 1) — bold, light grey background
  for (let c = 0; c < totalCols; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 1, c });
    if (!ws[cellRef]) ws[cellRef] = { v: BREAKDOWN_HEADERS[c], t: 's' };
    ws[cellRef].s = {
      fill: { fgColor: { rgb: 'ECF0F1' } },
      font: { bold: true, sz: 10 },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'medium', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: 'BDBDBD' } },
        right: { style: 'thin', color: { rgb: 'BDBDBD' } },
      },
    };
  }

  // Data rows — alternating background, text wrapping, borders
  for (let r = 0; r < rows.length; r++) {
    const isEven = r % 2 === 0;
    for (let c = 0; c < totalCols; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: r + 2, c }); // offset by 2 header rows
      if (!ws[cellRef]) ws[cellRef] = { v: rows[r][c] || '', t: 's' };
      ws[cellRef].s = {
        fill: { fgColor: { rgb: isEven ? 'FFFFFF' : 'F7F9FA' } },
        font: { sz: 9 },
        alignment: { vertical: 'top', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: 'E0E0E0' } },
          bottom: { style: 'thin', color: { rgb: 'E0E0E0' } },
          left: { style: 'thin', color: { rgb: 'E0E0E0' } },
          right: { style: 'thin', color: { rgb: 'E0E0E0' } },
        },
      };
    }
  }

  // Freeze panes: freeze the first 2 rows (group + column headers) and first 6 cols (scene + character)
  ws['!freeze'] = { xSplit: 6, ySplit: 2 };

  XLSX.utils.book_append_sheet(wb, ws, 'Scene Breakdown');

  // Write with xlsxStyle support for cell styling
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  return buf;
}
