import type { Scene, Character, SceneBreakdown, Look, BudgetCategory, BudgetEntry, TimesheetEntry } from '@/types';
import * as XLSX from 'xlsx';

export interface BreakdownExportData {
  scenes: Scene[];
  characters: Character[];
  breakdowns: Record<string, SceneBreakdown>;
  looks: Look[];
}

export function exportBreakdownXLSX(data: BreakdownExportData): Blob {
  const wb = XLSX.utils.book_new();

  // Scene breakdown sheet
  const breakdownRows: Record<string, string | number>[] = [];
  for (const scene of data.scenes) {
    const bd = data.breakdowns[scene.id];
    const baseRow: Record<string, string | number> = {
      'Scene #': scene.number,
      'INT/EXT': scene.intExt,
      'Location': scene.location,
      'Time': scene.timeOfDay,
      'Story Day': bd?.storyDay || '',
      'Complete': bd?.isComplete ? 'Yes' : 'No',
    };

    if (bd) {
      for (const char of data.characters) {
        const charData = bd.characters[char.id];
        if (charData) {
          const look = data.looks.find((l) => l.id === charData.lookId);
          breakdownRows.push({
            ...baseRow,
            'Character': char.name,
            'Look': look?.name || '',
            'Hair': charData.hairNotes,
            'Makeup': charData.makeupNotes,
            'SFX': charData.sfxNotes,
            'Notes': charData.notes,
            'Change': charData.hasChange ? 'Yes' : 'No',
          });
        }
      }
    }

    if (!bd || Object.keys(bd.characters).length === 0) {
      breakdownRows.push({ ...baseRow, 'Character': '', 'Look': '', 'Hair': '', 'Makeup': '', 'SFX': '', 'Notes': '', 'Change': '' });
    }
  }

  const ws1 = XLSX.utils.json_to_sheet(breakdownRows);
  XLSX.utils.book_append_sheet(wb, ws1, 'Breakdown');

  // Characters sheet
  const charRows = data.characters.map((c) => ({
    'Name': c.name,
    'Role': c.roleType,
    'Actor': c.actorName || '',
    'Scene Count': c.sceneCount,
    'First Appearance': c.firstAppearance,
    'Description': c.baseDescription || '',
  }));
  const ws2 = XLSX.utils.json_to_sheet(charRows);
  XLSX.utils.book_append_sheet(wb, ws2, 'Characters');

  // Looks sheet
  const lookRows = data.looks.map((l) => {
    const char = data.characters.find((c) => c.id === l.characterId);
    return {
      'Character': char?.name || '',
      'Look Name': l.name,
      'Hair': l.hairDescription,
      'Makeup': l.makeupDescription,
      'SFX': l.sfxDescription || '',
      'Scenes': l.assignedSceneIds.length,
    };
  });
  const ws3 = XLSX.utils.json_to_sheet(lookRows);
  XLSX.utils.book_append_sheet(wb, ws3, 'Looks');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function exportBudgetXLSX(
  categories: BudgetCategory[],
  entries: BudgetEntry[]
): Blob {
  const wb = XLSX.utils.book_new();
  const rows: Record<string, string | number>[] = [];

  for (const cat of categories.sort((a, b) => a.order - b.order)) {
    const catEntries = entries.filter((e) => e.categoryId === cat.id);
    for (const entry of catEntries) {
      rows.push({
        'Category': cat.name,
        'Description': entry.description,
        'Quantity': entry.quantity,
        'Rate': entry.rate,
        'Total': entry.total,
        'Notes': entry.notes || '',
      });
    }
    const catTotal = catEntries.reduce((sum, e) => sum + e.total, 0);
    rows.push({ 'Category': cat.name + ' TOTAL', 'Description': '', 'Quantity': 0, 'Rate': 0, 'Total': catTotal, 'Notes': '' });
  }

  const grandTotal = entries.reduce((sum, e) => sum + e.total, 0);
  rows.push({ 'Category': 'GRAND TOTAL', 'Description': '', 'Quantity': 0, 'Rate': 0, 'Total': grandTotal, 'Notes': '' });

  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Budget');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function exportTimesheetXLSX(entries: TimesheetEntry[]): Blob {
  const wb = XLSX.utils.book_new();
  const rows = entries.map((e) => ({
    'Date': e.date,
    'Name': e.personName,
    'Role': e.role,
    'Hours': e.hoursWorked,
    'Rate': e.hourlyRate,
    'Overtime': e.overtime,
    'Total Cost': (e.hoursWorked * e.hourlyRate) + (e.overtime * e.hourlyRate * 1.5),
    'Notes': e.notes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Timesheet');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
