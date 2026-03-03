import type { Scene } from '@/types';
import type { DetectedCharacter } from '@/types';
import { detectScenes, detectCharacters, assignCharactersToScenes } from '@/utils/scriptParser';

export interface ParseResult {
  scenes: Scene[];
  characters: DetectedCharacter[];
  warnings: string[];
}

export function parseScript(text: string): ParseResult {
  const warnings: string[] = [];

  // Detect scenes
  const scenes = detectScenes(text);
  if (scenes.length === 0) {
    warnings.push('No scenes detected. Make sure the script uses standard INT./EXT. scene headings.');
  }

  // Detect characters
  const characters = detectCharacters(scenes);
  if (characters.length === 0) {
    warnings.push('No characters detected. Character names should appear in ALL CAPS before their dialogue.');
  }

  return { scenes, characters, warnings };
}

export { assignCharactersToScenes };
