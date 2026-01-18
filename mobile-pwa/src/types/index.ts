// Core Data Types for Hair & Makeup Pro Mobile PWA

export interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  scenes: Scene[];
  characters: Character[];
  looks: Look[];
}

export interface Scene {
  id: string;
  sceneNumber: number;
  slugline: string;
  intExt: 'INT' | 'EXT';
  timeOfDay: 'DAY' | 'NIGHT' | 'MORNING' | 'EVENING' | 'CONTINUOUS';
  synopsis?: string;
  scriptContent?: string;
  characters: string[];
  isComplete: boolean;
  completedAt?: Date;
}

export interface Character {
  id: string;
  name: string;
  initials: string;
  avatarColour?: string;
}

export interface Look {
  id: string;
  characterId: string;
  name: string;
  scenes: number[];
  estimatedTime: number;
  masterReference?: Photo;
  makeup: MakeupDetails;
  hair: HairDetails;
}

export interface MakeupDetails {
  foundation: string;
  coverage: string;
  concealer: string;
  concealerPlacement: string;
  contour: string;
  contourPlacement: string;
  highlight: string;
  highlightPlacement: string;
  blush: string;
  blushPlacement: string;
  browProduct: string;
  browShape: string;
  eyePrimer: string;
  lidColour: string;
  creaseColour: string;
  outerV: string;
  liner: string;
  lashes: string;
  lipLiner: string;
  lipColour: string;
  setting: string;
}

export interface HairDetails {
  style: string;
  products: string;
  parting: string;
  piecesOut: string;
  pins: string;
  accessories: string;
}

export interface SceneCapture {
  id: string;
  sceneId: string;
  characterId: string;
  lookId: string;
  capturedAt: Date;
  photos: {
    front?: Photo;
    left?: Photo;
    right?: Photo;
    back?: Photo;
  };
  additionalPhotos: Photo[];
  continuityFlags: ContinuityFlags;
  continuityEvents: ContinuityEvent[];
  notes: string;
  applicationTime?: number;
}

export interface Photo {
  id: string;
  uri: string;
  thumbnail: string;
  capturedAt: Date;
  angle?: PhotoAngle;
}

export type PhotoAngle = 'front' | 'left' | 'right' | 'back' | 'additional';

export interface ContinuityFlags {
  sweat: boolean;
  dishevelled: boolean;
  blood: boolean;
  dirt: boolean;
  wetHair: boolean;
  tears: boolean;
}

export interface ContinuityEvent {
  id: string;
  type: ContinuityEventType;
  name: string;
  description: string;
  stage: string;
  sceneRange: string;
  products: string;
  referencePhotos: Photo[];
}

export type ContinuityEventType = 'Wound' | 'Bruise' | 'Prosthetic' | 'Scar' | 'Tattoo' | 'Other';

// Navigation types
export type NavTab = 'scenes' | 'lookbooks' | 'timesheet' | 'settings';

// Filter types for scene list
export type SceneFilter = 'all' | 'complete' | 'incomplete';

// Helper type for creating empty objects
export const createEmptyMakeupDetails = (): MakeupDetails => ({
  foundation: '',
  coverage: '',
  concealer: '',
  concealerPlacement: '',
  contour: '',
  contourPlacement: '',
  highlight: '',
  highlightPlacement: '',
  blush: '',
  blushPlacement: '',
  browProduct: '',
  browShape: '',
  eyePrimer: '',
  lidColour: '',
  creaseColour: '',
  outerV: '',
  liner: '',
  lashes: '',
  lipLiner: '',
  lipColour: '',
  setting: '',
});

export const createEmptyHairDetails = (): HairDetails => ({
  style: '',
  products: '',
  parting: '',
  piecesOut: '',
  pins: '',
  accessories: '',
});

export const createEmptyContinuityFlags = (): ContinuityFlags => ({
  sweat: false,
  dishevelled: false,
  blood: false,
  dirt: false,
  wetHair: false,
  tears: false,
});

// Stage suggestions for continuity events
export const STAGE_SUGGESTIONS = [
  'Fresh',
  'Day 1 Healing',
  'Day 2 Healing',
  'Day 3 Healing',
  'Scabbed',
  'Scarring',
  'Healed',
  'Faded',
];

// Continuity event types
export const CONTINUITY_EVENT_TYPES: ContinuityEventType[] = [
  'Wound',
  'Bruise',
  'Prosthetic',
  'Scar',
  'Tattoo',
  'Other',
];

// Helper function to generate initials from name
export const generateInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2);
};

// Helper function to count filled fields in makeup/hair details
export const countFilledFields = (obj: Record<string, string>): number => {
  return Object.values(obj).filter(value => value.trim() !== '').length;
};
