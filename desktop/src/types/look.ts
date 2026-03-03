export interface Look {
  id: string;
  characterId: string;
  name: string;
  hairDescription: string;
  makeupDescription: string;
  sfxDescription?: string;
  notes?: string;
  assignedSceneIds: string[];
  created: number;
  modified: number;
}
