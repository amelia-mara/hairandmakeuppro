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
export type NavTab = 'today' | 'breakdown' | 'looks' | 'hours' | 'script' | 'schedule' | 'callsheets' | 'settings' | 'more';

// Navigation item configuration
export interface NavItemConfig {
  id: NavTab;
  label: string;
  iconName: NavIconName;
}

export type NavIconName = 'calendar' | 'grid' | 'book' | 'clock' | 'document' | 'schedule' | 'clipboard' | 'cog' | 'ellipsis';

// All available nav items (except 'more' which is fixed)
export const ALL_NAV_ITEMS: NavItemConfig[] = [
  { id: 'today', label: 'Today', iconName: 'calendar' },
  { id: 'breakdown', label: 'Breakdown', iconName: 'grid' },
  { id: 'looks', label: 'Looks', iconName: 'book' },
  { id: 'hours', label: 'Hours', iconName: 'clock' },
  { id: 'script', label: 'Script', iconName: 'document' },
  { id: 'schedule', label: 'Schedule', iconName: 'schedule' },
  { id: 'callsheets', label: 'Call Sheets', iconName: 'clipboard' },
  { id: 'settings', label: 'Settings', iconName: 'cog' },
];

// Default bottom nav items (first 3)
export const DEFAULT_BOTTOM_NAV: NavTab[] = ['today', 'breakdown', 'hours'];

// Filter types for scene list
export type SceneFilter = 'all' | 'complete' | 'incomplete';

// ============================================
// CALL SHEET / TODAY TAB TYPES
// ============================================

export type ShootingSceneStatus = 'upcoming' | 'in-progress' | 'wrapped';

export interface CallSheet {
  id: string;
  date: string; // ISO date YYYY-MM-DD
  productionDay: number;
  unitCallTime: string; // "06:00" format
  firstShotEstimate?: string;
  lunchEstimate?: string;
  wrapEstimate?: string;
  weatherNote?: string;
  scenes: ShootingScene[];
  uploadedAt: Date;
  pdfUri?: string;
}

export interface ShootingScene {
  sceneNumber: number;
  shootOrder: number;
  estimatedTime?: string;
  status: ShootingSceneStatus;
  notes?: string;
}

export interface ShootingSchedule {
  days: ShootingDay[];
}

export interface ShootingDay {
  dayNumber: number;
  date: string;
  scenes: number[];
  location: string;
  notes?: string;
}

// Breakdown filter types
export type BreakdownViewMode = 'list' | 'grid';

export interface BreakdownFilters {
  characters: string[];
  shootingDay: number | null;
  location: string | null;
  completionStatus: 'all' | 'complete' | 'incomplete';
  lookId: string | null;
}

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

// ============================================
// TIMESHEET TYPES
// ============================================

export type BaseDayHours = 10 | 11 | 12;
export type DayType = 'SWD' | 'CWD' | 'SCWD';
export type EntryStatus = 'draft' | 'pending' | 'approved';
export type TimesheetView = 'week' | 'month';

export interface RateCard {
  dailyRate: number;
  baseDayHours: BaseDayHours;
  otMultiplier: number; // 1.5x after base hours
  lateNightMultiplier: number; // 2x after 23:00
  preCallMultiplier: number; // 1.5x for pre-call hours
  sixthDayMultiplier: number; // 1.5x
  kitRental: number;
  lunchDuration: number; // in minutes (typically 60)
}

export interface TimesheetEntry {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  dayType: DayType;
  preCall: string; // "05:30" format - arrival before unit call
  unitCall: string; // "06:00" format - official start
  outOfChair: string; // "17:00" format - talent leaves chair
  wrapOut: string; // "18:00" format - leave building
  lunchTaken: number; // actual lunch in minutes
  isSixthDay: boolean;
  notes: string;
  status: EntryStatus;
  productionDay?: number;
}

export interface TimesheetCalculation {
  preCallHours: number;
  preCallEarnings: number;
  workingHours: number;
  baseHours: number;
  otHours: number;
  lateNightHours: number;
  totalHours: number;
  dailyEarnings: number;
  otEarnings: number;
  lateNightEarnings: number;
  sixthDayBonus: number;
  kitRental: number;
  totalEarnings: number;
}

export interface WeekSummary {
  startDate: string;
  endDate: string;
  totalHours: number;
  baseHours: number;
  otHours: number;
  sixthDayHours: number;
  kitRentalTotal: number;
  totalEarnings: number;
  entries: TimesheetEntry[];
}

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  SWD: 'Standard Working Day',
  CWD: 'Continuous Working Day',
  SCWD: 'Short Continuous Working Day',
};

export const BASE_DAY_OPTIONS: { value: BaseDayHours; label: string }[] = [
  { value: 10, label: '10+1 (10 hours + 1hr unpaid lunch)' },
  { value: 11, label: '11+1 (11 hours + 1hr unpaid lunch)' },
  { value: 12, label: '12+1 (12 hours + 1hr unpaid lunch)' },
];

export const createDefaultRateCard = (): RateCard => ({
  dailyRate: 0,
  baseDayHours: 11,
  otMultiplier: 1.5,
  lateNightMultiplier: 2.0,
  preCallMultiplier: 1.5,
  sixthDayMultiplier: 1.5,
  kitRental: 0,
  lunchDuration: 60,
});

export const createEmptyTimesheetEntry = (date: string): TimesheetEntry => ({
  id: `entry-${date}`,
  date,
  dayType: 'SWD',
  preCall: '',
  unitCall: '',
  outOfChair: '',
  wrapOut: '',
  lunchTaken: 60,
  isSixthDay: false,
  notes: '',
  status: 'draft',
});
