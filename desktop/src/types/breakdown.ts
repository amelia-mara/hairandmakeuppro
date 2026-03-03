export interface SceneBreakdown {
  sceneId: string;
  storyDay?: string;
  synopsis?: string;
  notes?: string;
  isComplete: boolean;
  characters: Record<string, CharacterSceneData>;
}

export interface CharacterSceneData {
  characterId: string;
  lookId?: string;
  hairNotes: string;
  makeupNotes: string;
  sfxNotes: string;
  notes: string;
  hasChange: boolean;
  changeNotes?: string;
}
