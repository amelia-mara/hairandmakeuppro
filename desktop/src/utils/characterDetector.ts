import type { ParsedCharacter } from '@/types';
import { classifyRole } from './scriptParser';

export interface DetectedCharacter {
  name: string;
  roleType: 'lead' | 'supporting' | 'day_player' | 'extra';
  sceneCount: number;
  scenes: number[];
  selected: boolean; // Pre-selected based on role
}

/**
 * Convert parsed characters into detected characters with role classification
 * and pre-selection (extras are auto-deselected)
 */
export function classifyCharacters(
  characters: ParsedCharacter[],
  totalScenes: number
): DetectedCharacter[] {
  return characters.map((char) => {
    const roleType = classifyRole(char.sceneCount, totalScenes);
    return {
      name: char.name,
      roleType,
      sceneCount: char.sceneCount,
      scenes: char.scenes.map((s) => parseInt(s, 10)).filter((n) => !isNaN(n)),
      selected: roleType !== 'extra', // Auto-deselect extras
    };
  });
}

/**
 * Suggest character merges based on name similarity
 */
export function suggestMerges(characters: ParsedCharacter[]): Array<{
  primary: string;
  similar: string[];
}> {
  const suggestions: Array<{ primary: string; similar: string[] }> = [];
  const processed = new Set<string>();

  for (const char of characters) {
    if (processed.has(char.name)) continue;
    const similar: string[] = [];

    for (const other of characters) {
      if (other.name === char.name || processed.has(other.name)) continue;
      const name1 = char.name.toLowerCase();
      const name2 = other.name.toLowerCase();

      if (name1.includes(name2) || name2.includes(name1)) {
        similar.push(other.name);
      } else if (name1.split(' ')[0] === name2.split(' ')[0] && name1.split(' ')[0].length > 2) {
        similar.push(other.name);
      }
    }

    if (similar.length > 0) {
      suggestions.push({ primary: char.name, similar });
      similar.forEach((s) => processed.add(s));
    }
    processed.add(char.name);
  }

  return suggestions;
}
