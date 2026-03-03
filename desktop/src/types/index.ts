// Core Data Types for Prep Happy Desktop

export interface Scene {
  id: string;
  number: number;
  heading: string;
  content: string;
  intExt: 'INT' | 'EXT' | 'INT/EXT';
  location: string;
  timeOfDay: string;
  storyDay?: string;
  characters: string[]; // Character names present in this scene
}

export interface Character {
  id: string;
  name: string;
  roleType: 'lead' | 'supporting' | 'day_player' | 'extra';
  sceneCount: number;
  scenes: number[]; // Scene numbers where character appears
  baseDescription?: string;
  looks: string[]; // Look IDs
}

export interface SceneBreakdown {
  sceneId: string;
  storyDay: string;
  isComplete: boolean;
  characterData: Record<string, CharacterSceneData>;
}

export interface CharacterSceneData {
  hairNotes: string;
  makeupNotes: string;
  sfxNotes: string;
  generalNotes: string;
  hasChange: boolean;
  lookId?: string;
}

export interface Look {
  id: string;
  characterId: string;
  name: string;
  hairDescription: string;
  makeupDescription: string;
  sfxDescription?: string;
  notes?: string;
  assignedScenes: string[]; // Scene IDs
}

export interface Project {
  id: string;
  name: string;
  created: string;
  scriptContent: string;
  scenes: Scene[];
  characters: Character[];
  looks: Look[];
  sceneBreakdowns: Record<string, SceneBreakdown>;
}

// Parse result types
export interface ParsedScene {
  sceneNumber: string;
  slugline: string;
  intExt: 'INT' | 'EXT' | 'INT/EXT';
  location: string;
  timeOfDay: string;
  characters: string[];
  content: string;
}

export interface ParsedCharacter {
  name: string;
  normalizedName: string;
  sceneCount: number;
  dialogueCount: number;
  scenes: string[];
  variants: string[];
}

export interface ParsedScript {
  title: string;
  scenes: ParsedScene[];
  characters: ParsedCharacter[];
  rawText: string;
}

// UI types
export type AppView = 'home' | 'breakdown';
export type CenterTab = 'script' | string; // 'script' or character name
