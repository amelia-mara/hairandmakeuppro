import * as XLSX from 'xlsx';
import type { Project } from '@/types';

/**
 * Export project breakdown to xlsx spreadsheet
 */
export function exportBreakdownToXLSX(project: Project): void {
  const wb = XLSX.utils.book_new();

  // Scene Breakdown sheet
  const breakdownData: Record<string, string | number | boolean>[] = [];

  for (const scene of project.scenes) {
    const breakdown = project.sceneBreakdowns[scene.id];
    if (!breakdown) continue;

    for (const charName of scene.characters) {
      const charData = breakdown.characterData[charName];
      if (!charData) continue;

      breakdownData.push({
        'Scene': scene.number,
        'Scene Heading': scene.heading,
        'INT/EXT': scene.intExt,
        'Location': scene.location,
        'Time of Day': scene.timeOfDay,
        'Story Day': breakdown.storyDay || '',
        'Character': charName,
        'Hair': charData.hairNotes,
        'Makeup': charData.makeupNotes,
        'SFX': charData.sfxNotes,
        'Notes': charData.generalNotes,
        'Change': charData.hasChange ? 'Yes' : 'No',
        'Look': charData.lookId ? project.looks.find((l) => l.id === charData.lookId)?.name || '' : '',
        'Complete': breakdown.isComplete ? 'Yes' : 'No',
      });
    }
  }

  if (breakdownData.length > 0) {
    const ws = XLSX.utils.json_to_sheet(breakdownData);
    XLSX.utils.book_append_sheet(wb, ws, 'Scene Breakdown');
  }

  // Characters sheet
  const characterData = project.characters.map((char) => ({
    'Character': char.name,
    'Role': char.roleType,
    'Scene Count': char.sceneCount,
    'Scenes': char.scenes.join(', '),
    'Description': char.baseDescription || '',
  }));

  if (characterData.length > 0) {
    const ws2 = XLSX.utils.json_to_sheet(characterData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Characters');
  }

  // Looks sheet
  const lookData = project.looks.map((look) => {
    const character = project.characters.find((c) => c.id === look.characterId);
    return {
      'Character': character?.name || '',
      'Look Name': look.name,
      'Hair': look.hairDescription,
      'Makeup': look.makeupDescription,
      'SFX': look.sfxDescription || '',
      'Notes': look.notes || '',
      'Assigned Scenes': look.assignedScenes
        .map((sId) => project.scenes.find((s) => s.id === sId)?.number)
        .filter(Boolean)
        .join(', '),
    };
  });

  if (lookData.length > 0) {
    const ws3 = XLSX.utils.json_to_sheet(lookData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Looks');
  }

  // Download
  const fileName = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_breakdown.xlsx`;
  XLSX.writeFile(wb, fileName);
}
