export interface Scene {
  id: string;
  number: number;
  heading: string;
  content: string;
  intExt: 'INT' | 'EXT' | 'INT/EXT';
  location: string;
  timeOfDay: string;
  storyDay?: string;
  synopsis?: string;
  pageStart?: number;
  pageEnd?: number;
  characterIds: string[];
}
