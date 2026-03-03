// Types for the Script Breakdown feature

export interface ParsedScene {
  id: string;
  sceneNumber: string;
  intExt: 'INT' | 'EXT' | 'INT/EXT';
  location: string;
  timeOfDay: string;
  scriptContent: string;
  pageCount?: number;
}

export interface DetectedCharacter {
  id: string;
  name: string;
  sceneCount: number;
  roleType: 'lead' | 'supporting' | 'day_player' | 'extra';
  scenes: string[]; // scene IDs where character appears
}

export interface SceneBreakdown {
  sceneId: string;
  storyDay: string;
  timelineNotes: string;
  characterBreakdowns: Record<string, CharacterSceneBreakdown>;
  isComplete: boolean;
}

export interface CharacterSceneBreakdown {
  characterId: string;
  hairNotes: string;
  makeupNotes: string;
  generalNotes: string;
  hasChange: boolean;
}

export interface CharacterProfile {
  characterId: string;
  baseDescription: string;
  looks: CharacterLook[];
}

export interface CharacterLook {
  id: string;
  name: string;
  description: string;
  scenes: string[];
}

export type BreakdownStep = 'upload' | 'confirm-characters' | 'breakdown';
