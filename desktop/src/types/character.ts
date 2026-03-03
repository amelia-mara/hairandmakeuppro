export type RoleType = 'lead' | 'supporting' | 'day_player' | 'extra';

export interface Character {
  id: string;
  name: string;
  aliases: string[];
  roleType: RoleType;
  baseDescription?: string;
  actorName?: string;
  sceneCount: number;
  sceneNumbers: number[];
  firstAppearance: number;
  lastAppearance: number;
}

export interface DetectedCharacter {
  name: string;
  sceneCount: number;
  sceneNumbers: number[];
  roleType: RoleType;
  selected: boolean;
}
