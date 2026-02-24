// Core Data Types for Hair & Makeup Pro Mobile PWA

// Character detection status for background processing
export type CharacterDetectionStatus = 'idle' | 'running' | 'complete';

export interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  scenes: Scene[];
  characters: Character[];
  looks: Look[];
  castProfiles?: CastProfile[]; // Actor profiles linked to characters

  // Track overall character confirmation progress (for progressive workflow)
  characterDetectionStatus?: CharacterDetectionStatus;
  scenesConfirmed?: number; // Count of scenes with confirmed characters

  // Original script PDF stored as base64 for viewing
  scriptPdfData?: string;
}

// Character confirmation status for progressive scene-by-scene workflow
export type CharacterConfirmationStatus = 'pending' | 'detecting' | 'ready' | 'confirmed';

// Scene amendment status for tracking script revisions
export type SceneAmendmentStatus = 'unchanged' | 'modified' | 'new' | 'deleted';

export interface Scene {
  id: string;
  sceneNumber: string; // Can be "4A", "4B", etc. for alphanumeric scene numbers
  slugline: string;
  intExt: 'INT' | 'EXT';
  timeOfDay: 'DAY' | 'NIGHT' | 'MORNING' | 'EVENING' | 'CONTINUOUS';
  synopsis?: string;
  scriptContent?: string;
  characters: string[]; // Confirmed character IDs (empty until confirmed)
  isComplete: boolean;
  completedAt?: Date;
  filmingStatus?: SceneFilmingStatus; // Tracks actual filming outcome
  filmingNotes?: string; // Reason for not filmed/partial
  shootingDay?: number; // Which production day this scene is scheduled
  hasScheduleDiscrepancy?: boolean; // Flag if schedule doesn't match breakdown

  // Character confirmation state (for progressive workflow)
  characterConfirmationStatus?: CharacterConfirmationStatus;
  suggestedCharacters?: string[]; // AI/regex suggested character names before confirmation

  // Script amendment tracking
  amendmentStatus?: SceneAmendmentStatus; // Status from latest script revision
  previousScriptContent?: string; // Content before amendment (for comparison)
  amendmentDate?: string; // ISO date when scene was last amended
  amendmentNotes?: string; // Auto-generated summary of what changed
}

export interface Character {
  id: string;
  name: string;
  initials: string;
  avatarColour?: string;
  actorNumber?: number; // Cast number from production schedule
}

// Cast Profile - stores actor-specific information linked to a character
export interface CastProfile {
  id: string;
  characterId: string; // Links to Character
  actorName: string;
  phone: string;
  email: string;
  agentName: string;
  agentPhone: string;
  agentEmail: string;
  allergies: string;
  specialRequirements: string;
  skinType: string;
  notes: string;
  profilePhotoUri?: string;
}

// Helper to create empty cast profile
export const createEmptyCastProfile = (characterId: string): CastProfile => ({
  id: `cast-${characterId}`,
  characterId,
  actorName: '',
  phone: '',
  email: '',
  agentName: '',
  agentPhone: '',
  agentEmail: '',
  allergies: '',
  specialRequirements: '',
  skinType: '',
  notes: '',
});

export interface Look {
  id: string;
  characterId: string;
  name: string;
  scenes: string[]; // Scene numbers can be alphanumeric
  estimatedTime: number;
  masterReference?: Photo;
  makeup: MakeupDetails;
  hair: HairDetails;
  // Look-level defaults (auto-fill into scene captures when set here)
  continuityFlags?: ContinuityFlags;
  continuityEvents?: ContinuityEvent[];
  sfxDetails?: SFXDetails;
  notes?: string;
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

// Hair Types
export type HairType = 'Natural' | 'Wig' | 'Hair Pieces' | 'Extensions';
export type WigType = 'Lace Front' | 'Full Lace' | 'Hard Front' | 'U-Part' | 'Closure';
export type WigAttachment = 'Glue' | 'Tape' | 'Pins' | 'Combs' | 'Clips' | 'Elastic';
export type HairlineStyle = 'Natural' | 'Laid' | 'Concealed' | 'Bleached Knots';

export const HAIR_TYPES: HairType[] = ['Natural', 'Wig', 'Hair Pieces', 'Extensions'];
export const WIG_TYPES: WigType[] = ['Lace Front', 'Full Lace', 'Hard Front', 'U-Part', 'Closure'];
export const WIG_ATTACHMENTS: WigAttachment[] = ['Glue', 'Tape', 'Pins', 'Combs', 'Clips', 'Elastic'];
export const HAIRLINE_STYLES: HairlineStyle[] = ['Natural', 'Laid', 'Concealed', 'Bleached Knots'];

export interface HairDetails {
  // Standard fields
  style: string;
  products: string;
  parting: string;
  piecesOut: string;
  pins: string;
  accessories: string;
  // Hair type (controls wig fields visibility)
  hairType: HairType;
  // Wig-specific fields
  wigNameId: string;
  wigType: WigType | '';
  wigCapMethod: string;
  wigAttachment: WigAttachment[];
  hairline: HairlineStyle | '';
  laceTint: string;
  edgesBabyHairs: string;
}

// SFX Types
export type SFXType = 'Prosthetics' | 'Wounds' | 'Scars' | 'Tattoos' | 'Aging' | 'Bald Cap' | 'Contact Lenses' | 'Teeth' | 'Body Paint';
export type BloodType = 'Fresh' | 'Dried' | 'Arterial' | 'Mouth Blood' | 'Bruising';

export const SFX_TYPES: SFXType[] = ['Prosthetics', 'Wounds', 'Scars', 'Tattoos', 'Aging', 'Bald Cap', 'Contact Lenses', 'Teeth', 'Body Paint'];
export const BLOOD_TYPES: BloodType[] = ['Fresh', 'Dried', 'Arterial', 'Mouth Blood', 'Bruising'];

export interface SFXDetails {
  sfxRequired: boolean;
  sfxTypes: SFXType[];
  prostheticPieces: string;
  prostheticAdhesive: string;
  bloodTypes: BloodType[];
  bloodProducts: string;
  bloodPlacement: string;
  tattooCoverage: string;
  temporaryTattoos: string;
  contactLenses: string;
  teeth: string;
  agingCharacterNotes: string;
  sfxApplicationTime: number | null;
  sfxReferencePhotos: Photo[];
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
  sfxDetails: SFXDetails;
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

export interface ProgressionStage {
  id: string;
  scene: string;       // Scene number where this stage applies
  stage: string;       // e.g. "Fresh", "Day 2 Healing"
  notes: string;       // Specific notes for this stage
  referencePhotos: Photo[];
}

export interface ContinuityEvent {
  id: string;
  type: ContinuityEventType;
  name: string;
  description: string;
  stage: string;
  sceneRange: string;
  scenes?: string[];           // Explicit scene numbers this event spans
  products: string;
  referencePhotos: Photo[];
  progression?: ProgressionStage[]; // Timeline of how the event changes across scenes
}

export type ContinuityEventType = 'Wound' | 'Bruise' | 'Prosthetic' | 'Scar' | 'Tattoo' | 'Other';

// Navigation types
export type NavTab = 'today' | 'breakdown' | 'lookbook' | 'hours' | 'budget' | 'script' | 'schedule' | 'callsheets' | 'settings' | 'more';

// Navigation item configuration
export interface NavItemConfig {
  id: NavTab;
  label: string;
  iconName: NavIconName;
}

export type NavIconName = 'calendar' | 'grid' | 'book' | 'clock' | 'wallet' | 'document' | 'schedule' | 'clipboard' | 'cog' | 'ellipsis';

// All available nav items (except 'more' which is fixed)
export const ALL_NAV_ITEMS: NavItemConfig[] = [
  { id: 'today', label: 'Today', iconName: 'calendar' },
  { id: 'breakdown', label: 'Breakdown', iconName: 'grid' },
  { id: 'lookbook', label: 'Lookbook', iconName: 'book' },
  { id: 'hours', label: 'Hours', iconName: 'clock' },
  { id: 'budget', label: 'Budget', iconName: 'wallet' },
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

// Filming completion status - tracks whether scene was actually filmed
export type SceneFilmingStatus = 'not-filmed' | 'partial' | 'complete';

export const SCENE_FILMING_STATUS_CONFIG: Record<SceneFilmingStatus, {
  label: string;
  shortLabel: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  color: string;
  glassOverlay: string;
}> = {
  'not-filmed': {
    label: 'Incomplete',
    shortLabel: 'Incomplete',
    bgClass: 'bg-red-100',
    textClass: 'text-red-600',
    borderClass: 'border-red-400',
    color: '#dc2626',
    glassOverlay: 'rgba(239, 68, 68, 0.15)',
  },
  'partial': {
    label: 'Part Complete',
    shortLabel: 'Part Complete',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-600',
    borderClass: 'border-amber-400',
    color: '#d97706',
    glassOverlay: 'rgba(245, 158, 11, 0.15)',
  },
  'complete': {
    label: 'Complete',
    shortLabel: 'Complete',
    bgClass: 'bg-green-100',
    textClass: 'text-green-600',
    borderClass: 'border-green-400',
    color: '#16a34a',
    glassOverlay: 'rgba(34, 197, 94, 0.15)',
  },
};

// Call Sheet Types - Comprehensive model for PDF call sheets
export interface CallSheet {
  id: string;
  date: string; // ISO date YYYY-MM-DD
  productionDay: number;
  totalProductionDays?: number;
  dayType?: string; // e.g., "10 HRS CONTINUOUS WORKING DAY"

  // Call times
  unitCallTime: string; // "06:00" format
  onSetTime?: string; // When to be on set
  rehearsalsTime?: string; // "07:45" format
  firstShotTime?: string; // "08:20" format (TO SHOOT FOR)

  // Pre-call times by department
  preCalls?: {
    ads?: string;
    hmu?: string; // Hair & Makeup
    costume?: string;
    production?: string;
    lighting?: string;
    camera?: string;
    location?: string; // Where pre-calls happen (e.g., "Unit Base", "On Set")
  };

  // Meal times
  breakfastTime?: string; // "05:30 - 06:00"
  lunchTime?: string; // "11:30 ONWARDS" or time range
  lunchLocation?: string; // "IN HAND, HOTBOX" or location

  // Wrap estimates
  cameraWrapEstimate?: string;
  wrapEstimate?: string;

  // Weather
  weather?: {
    conditions?: string; // "Showers", "Sunny", etc.
    tempHigh?: number;
    tempLow?: number;
    sunrise?: string;
    sunset?: string;
  };

  // Location info
  unitBase?: CallSheetLocation;
  shootLocation?: CallSheetLocation;
  crewParking?: CallSheetLocation;

  // Unit notes
  unitNotes?: string[];

  // Scene schedule
  scenes: CallSheetScene[];

  // Cast call times
  castCalls?: CastCall[];

  // Supporting artists (SA/extras)
  supportingArtists?: SupportingArtistCall[];

  // Metadata
  uploadedAt: Date;
  pdfUri?: string;
  rawText?: string; // Original extracted text for debugging
}

export interface CallSheetLocation {
  name: string;
  address?: string;
  what3words?: string;
  notes?: string;
}

export interface CallSheetScene {
  sceneNumber: string; // Can be "4A", "4B", etc.
  location?: string; // "LOC1", "LOC2", etc.
  setDescription: string; // "EXT. FARMHOUSE - DRIVEWAY"
  action?: string; // Brief description of what happens
  dayNight: 'D' | 'N' | 'D/N' | string; // D1 = Day 1, N = Night
  pages?: string; // "1/8", "2/8", "1", etc.
  cast?: string[]; // Cast IDs or numbers ["1", "2", "4", "7"]
  notes?: string; // HMU notes, AV notes, etc.
  estimatedTime?: string; // "08:20 - 08:40"
  startTime?: string;
  endTime?: string;

  // Runtime tracking (for Today page)
  shootOrder: number;
  status: ShootingSceneStatus;
  filmingStatus?: SceneFilmingStatus;
  filmingNotes?: string;
  completedAt?: string; // ISO timestamp when scene was marked complete
}

export interface CastCall {
  id: string; // Cast number from call sheet
  name: string;
  character: string;
  status: 'SW' | 'SWF' | 'W' | 'WF' | 'H' | 'T' | 'R' | string; // Start Work, Start Work Finish, Work, etc.
  pickup?: string; // Pickup time
  driver?: string; // Driver type: "RW", "MINIBUS", "LW", etc.
  callTime: string; // Report time at unit base
  makeupCall?: string; // B/Fast or direct to HMU
  costumeCall?: string;
  hmuCall?: string; // Hair & Makeup time
  travelTime?: string; // Travel to set
  onSetTime?: string; // On set time
  notes?: string;
}

export interface SupportingArtistCall {
  id: string;
  name: string;
  designation: string; // Role/character
  status: string;
  callTime: string;
  makeupCall?: string;
  costumeCall?: string;
  hmuCall?: string;
  travelTime?: string;
  onSetTime?: string;
  notes?: string;
}

// Legacy interface for backwards compatibility
export interface ShootingScene {
  sceneNumber: number;
  shootOrder: number;
  estimatedTime?: string;
  status: ShootingSceneStatus;
  filmingStatus?: SceneFilmingStatus;
  filmingNotes?: string;
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

// ============================================
// PRODUCTION SCHEDULE TYPES (PDF Upload)
// ============================================

// Schedule processing status
export type ScheduleStatus = 'pending' | 'processing' | 'complete' | 'partial';

// Processing progress tracking
export interface ScheduleProcessingProgress {
  current: number; // Current day being processed
  total: number; // Total days to process
  message?: string; // Status message
}

// Cast member from schedule (name-to-number mapping)
export interface ScheduleCastMember {
  number: number; // The cast number (1, 2, 3, etc.)
  name: string; // Actor name or character name as listed
  character?: string; // Character name if separate from actor name
}

// Full production schedule data
export interface ProductionSchedule {
  id: string;
  productionName?: string;
  scriptVersion?: string;
  scheduleVersion?: string;

  // Processing status (two-stage parsing)
  status: ScheduleStatus;
  processingProgress?: ScheduleProcessingProgress;
  processingError?: string;

  // Cast list extracted from first page (Stage 1)
  castList: ScheduleCastMember[];

  // All shooting days (populated in Stage 2)
  days: ScheduleDay[];

  // Total shooting days (extracted in Stage 1)
  totalDays: number;

  // Metadata
  uploadedAt: Date;
  pdfUri?: string;
  rawText?: string; // Full PDF text for Stage 2 processing
}

// A single shooting day in the schedule
export interface ScheduleDay {
  dayNumber: number;
  date?: string; // YYYY-MM-DD if available
  dayOfWeek?: string; // "Monday", "Tuesday", etc.
  location: string; // Main location for the day
  hours?: string; // "0600 - 1600" format
  dayType?: string; // "CWD", "SWD", etc.
  sunrise?: string; // "08:27" format
  sunset?: string; // "15:54" format
  notes?: string[]; // "Drone Day", "UNIT MOVE", etc.

  // Scenes scheduled for this day
  scenes: ScheduleSceneEntry[];

  // Total pages for the day
  totalPages?: string;
}

// A scene entry in the schedule
export interface ScheduleSceneEntry {
  sceneNumber: string; // "4A", "18B", "162 p1", etc.
  pages?: string; // "1/8", "3/8", "1 2/8", etc.
  intExt: 'INT' | 'EXT';
  dayNight: string; // "Day", "Night", "Morning", "D/N", etc.
  setLocation: string; // "FARMHOUSE - DRIVEWAY", "TAXI - ISLAND"
  description?: string; // "TAXI passes the road to the Farmhouse"
  castNumbers: number[]; // [1, 2, 4, 7] - references castList
  estimatedTime?: string; // ":30", "1:30", etc.
  shootOrder: number; // Order within the day
}

// Breakdown filter types
export type BreakdownViewMode = 'list' | 'grid';

export interface BreakdownFilters {
  characters: string[];
  location: string | null;
  completionStatus: 'all' | 'complete' | 'incomplete';
  filmingStatus: SceneFilmingStatus | 'all';
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
  hairType: 'Natural',
  wigNameId: '',
  wigType: '',
  wigCapMethod: '',
  wigAttachment: [],
  hairline: '',
  laceTint: '',
  edgesBabyHairs: '',
});

export const createEmptySFXDetails = (): SFXDetails => ({
  sfxRequired: false,
  sfxTypes: [],
  prostheticPieces: '',
  prostheticAdhesive: '',
  bloodTypes: [],
  bloodProducts: '',
  bloodPlacement: '',
  tattooCoverage: '',
  temporaryTattoos: '',
  contactLenses: '',
  teeth: '',
  agingCharacterNotes: '',
  sfxApplicationTime: null,
  sfxReferencePhotos: [],
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

// Helper function to count filled fields in makeup/hair/sfx details
export const countFilledFields = (obj: MakeupDetails | HairDetails | SFXDetails): number => {
  return Object.entries(obj).filter(([key, value]) => {
    // Skip hairType as it always has a value
    if (key === 'hairType') return false;
    // Skip sfxRequired toggle - it's not a "filled field"
    if (key === 'sfxRequired') return false;
    // Handle arrays (wigAttachment, sfxTypes, bloodTypes, sfxReferencePhotos)
    if (Array.isArray(value)) return value.length > 0;
    // Handle numbers (sfxApplicationTime)
    if (typeof value === 'number') return value > 0;
    if (value === null) return false;
    // Handle booleans
    if (typeof value === 'boolean') return false;
    // Handle strings
    if (typeof value === 'string') return value.trim() !== '';
    return false;
  }).length;
};

// Count hair fields including wig fields when applicable
export const countHairFields = (hair: HairDetails): number => {
  const standardFields = ['style', 'products', 'parting', 'piecesOut', 'pins', 'accessories'];
  const wigFields = ['wigNameId', 'wigType', 'wigCapMethod', 'wigAttachment', 'hairline', 'laceTint', 'edgesBabyHairs'];

  let count = 0;

  // Count standard fields
  standardFields.forEach(field => {
    const value = hair[field as keyof HairDetails];
    if (typeof value === 'string' && value.trim() !== '') count++;
  });

  // Count wig fields only if not Natural
  if (hair.hairType !== 'Natural') {
    wigFields.forEach(field => {
      const value = hair[field as keyof HairDetails];
      if (Array.isArray(value) && value.length > 0) count++;
      else if (typeof value === 'string' && value.trim() !== '') count++;
    });
  }

  return count;
};

// Count SFX fields (only when sfxRequired is true)
export const countSFXFields = (sfx: SFXDetails): number => {
  if (!sfx.sfxRequired) return 0;

  let count = 0;
  if (sfx.sfxTypes.length > 0) count++;
  if (sfx.prostheticPieces.trim() !== '') count++;
  if (sfx.prostheticAdhesive.trim() !== '') count++;
  if (sfx.bloodTypes.length > 0) count++;
  if (sfx.bloodProducts.trim() !== '') count++;
  if (sfx.bloodPlacement.trim() !== '') count++;
  if (sfx.tattooCoverage.trim() !== '') count++;
  if (sfx.temporaryTattoos.trim() !== '') count++;
  if (sfx.contactLenses.trim() !== '') count++;
  if (sfx.teeth.trim() !== '') count++;
  if (sfx.agingCharacterNotes.trim() !== '') count++;
  if (sfx.sfxApplicationTime !== null && sfx.sfxApplicationTime > 0) count++;
  if (sfx.sfxReferencePhotos.length > 0) count++;

  return count;
};

// ============================================
// TIMESHEET TYPES
// ============================================

export type BaseDayHours = 10 | 11 | 12;
export type BaseContract = '10+1' | '11+1';
export type DayType = 'SWD' | 'CWD' | 'SCWD';
export type EntryStatus = 'draft' | 'pending' | 'approved';
export type TimesheetView = 'week' | 'sheet';

export interface RateCard {
  dailyRate: number;
  baseDayHours: BaseDayHours;
  baseContract: BaseContract; // BECTU base contract (10+1 or 11+1)
  dayType: DayType; // Working day type - determines lunch duration
  otMultiplier: number; // 1.5x after base hours
  lateNightMultiplier: number; // 2x after 23:00
  preCallMultiplier: number; // 1.5x for pre-call hours
  sixthDayMultiplier: number; // 1.5x
  seventhDayMultiplier: number; // 2x for 7th consecutive day
  kitRental: number;
  lunchDuration: number; // in minutes - derived from dayType: SWD=60, CWD/SCWD=30
}

export interface TimesheetEntry {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  dayType: DayType;
  preCall: string; // "05:30" format - arrival before unit call
  unitCall: string; // "06:00" format - official start
  lunchStart?: string; // "13:00" format - lunch start time
  lunchEnd?: string; // "14:00" format - lunch end time
  outOfChair: string; // "17:00" format - talent leaves chair
  wrapOut: string; // "18:00" format - leave building
  lunchTaken: number; // actual lunch in minutes (auto-set from dayType)
  isSixthDay: boolean;
  isSeventhDay: boolean; // 7th consecutive day (2x multiplier)
  notes: string; // OT justification notes for production accounting
  status: EntryStatus;
  productionDay?: number;
  // BECTU turnaround tracking
  previousWrapOut?: string; // previous day's wrap out time for turnaround calculation
  // Call sheet auto-fill tracking
  autoFilledFrom?: string; // call sheet ID if auto-filled
  callSheetUnitCall?: string; // original call sheet value for comparison
  callSheetLunch?: string;
  callSheetWrap?: string;
}

export interface TimesheetCalculation {
  // Rates (BECTU)
  contractedHours: number; // Hours before OT kicks in (based on contract + day type)
  hourlyRate: number; // Day rate / contracted hours
  otRate: number; // Hourly rate * OT multiplier

  // Hours breakdown
  preCallHours: number;
  workingHours: number; // Alias for actualWorkHours
  actualWorkHours: number; // Total work hours including pre-call
  baseHours: number; // Hours at standard rate (up to contracted hours)
  otHours: number; // Hours beyond contracted
  brokenLunchHours: number; // Hours of broken lunch penalty
  brokenTurnaroundHours: number; // Hours of broken turnaround penalty
  lateNightHours: number;
  totalHours: number;

  // Earnings breakdown
  preCallEarnings: number;
  dailyEarnings: number; // Base pay (day rate guarantee)
  basePay: number; // Alias for dailyEarnings
  otEarnings: number;
  overtimePay: number; // Alias for otEarnings
  brokenLunchPay: number;
  brokenTurnaroundPay: number;
  lateNightEarnings: number;
  lateNightPay: number; // Alias for lateNightEarnings
  sixthDayBonus: number;
  seventhDayBonus: number;
  dayMultiplier: number; // 1, 1.5 (6th day), or 2 (7th day)
  subtotal: number; // Before day multiplier
  kitRental: number;
  totalEarnings: number;
  totalPay: number; // Alias for totalEarnings

  // Warning flags
  brokenLunch: boolean; // True if lunch was taken more than 6hrs from unit call
  hasBrokenLunch: boolean; // Alias
  brokenTurnaround: boolean; // True if turnaround was less than 11 hours
  hasBrokenTurnaround: boolean; // Alias
  hasLateNight: boolean;
  hasOvertime: boolean;
}

export interface WeekSummary {
  startDate: string;
  endDate: string;
  totalHours: number;
  preCallHours: number;
  baseHours: number;
  otHours: number;
  sixthDayHours: number;
  seventhDayHours: number;
  lateNightHours: number;
  brokenLunchHours: number;
  brokenTurnaroundHours: number;
  kitRentalTotal: number;
  totalEarnings: number;
  entries: TimesheetEntry[];
  // Breakdown totals
  basePay: number;
  overtimePay: number;
  preCallPay: number;
  brokenLunchPay: number;
  brokenTurnaroundPay: number;
  lateNightPay: number;
}

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  SWD: 'Standard Working Day',
  CWD: 'Continuous Working Day',
  SCWD: 'Semi-Continuous Working Day',
};

/**
 * Parse a call sheet day type string into a standardized DayType
 * Examples:
 *   "10 HRS CONTINUOUS WORKING DAY" → 'CWD'
 *   "10.5 + 0.5 SEMI-CONTINUOUS WORKING DAY" → 'SCWD'
 *   "STANDARD WORKING DAY" → 'SWD'
 *   "SHORT CONTINUOUS" → 'SCWD'
 */
export function parseDayTypeFromString(dayTypeStr?: string): DayType {
  if (!dayTypeStr) return 'SWD';
  const upper = dayTypeStr.toUpperCase();
  // Check for semi-continuous first (more specific match)
  if (upper.includes('SEMI-CONTINUOUS') || upper.includes('SEMI CONTINUOUS') || upper.includes('SCWD') || upper.includes('SHORT CONTINUOUS')) {
    return 'SCWD';
  }
  // Check for continuous working day
  if (upper.includes('CONTINUOUS') || upper.includes('CWD')) {
    return 'CWD';
  }
  // Default to standard working day
  return 'SWD';
}

export const BASE_DAY_OPTIONS: { value: BaseDayHours; label: string }[] = [
  { value: 10, label: '10+1 (10 hours + 1hr unpaid lunch)' },
  { value: 11, label: '11+1 (11 hours + 1hr unpaid lunch)' },
  { value: 12, label: '12+1 (12 hours + 1hr unpaid lunch)' },
];

// Day type options for rate card dropdown
export const DAY_TYPE_OPTIONS: { value: DayType; label: string; lunchMinutes: number }[] = [
  { value: 'SWD', label: 'SWD (Standard Working Day - 1hr lunch)', lunchMinutes: 60 },
  { value: 'SCWD', label: 'SCWD (Semi-Continuous - 30min lunch)', lunchMinutes: 30 },
  { value: 'CWD', label: 'CWD (Continuous - no lunch, working in hand)', lunchMinutes: 0 },
];

// Get lunch duration in minutes based on day type
// SWD = 1 hour, SCWD = 30 minutes, CWD = 0 (no lunch - working in hand)
export const getLunchDurationForDayType = (dayType: DayType): number => {
  switch (dayType) {
    case 'SWD':
      return 60; // 1 hour lunch
    case 'SCWD':
      return 30; // 30 minutes lunch
    case 'CWD':
      return 0; // No lunch - continuous working day
    default:
      return 60;
  }
};

export const createDefaultRateCard = (): RateCard => ({
  dailyRate: 0,
  baseDayHours: 11,
  baseContract: '11+1',
  dayType: 'SWD',
  otMultiplier: 1.5,
  lateNightMultiplier: 2.0,
  preCallMultiplier: 1.5,
  sixthDayMultiplier: 1.5,
  seventhDayMultiplier: 2.0,
  kitRental: 0,
  lunchDuration: 60,
});

export const createEmptyTimesheetEntry = (date: string): TimesheetEntry => ({
  id: `entry-${date}`,
  date,
  dayType: 'SWD',
  preCall: '',
  unitCall: '',
  lunchStart: '',
  lunchEnd: '',
  outOfChair: '',
  wrapOut: '',
  lunchTaken: 60,
  isSixthDay: false,
  isSeventhDay: false,
  notes: '',
  status: 'draft',
});

// ============================================
// CURRENCY TYPES
// ============================================

export type CurrencyCode = 'GBP' | 'USD' | 'EUR' | 'CAD' | 'AUD';

export interface Currency {
  code: CurrencyCode;
  symbol: string;
  name: string;
  locale: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
];

export const DEFAULT_CURRENCY: CurrencyCode = 'GBP';

export const getCurrencyByCode = (code: CurrencyCode): Currency => {
  return CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
};

export const formatCurrency = (amount: number, currencyCode: CurrencyCode = DEFAULT_CURRENCY): string => {
  const currency = getCurrencyByCode(currencyCode);
  return `${currency.symbol}${amount.toFixed(2)}`;
};

// ============================================
// BILLING DETAILS TYPES
// ============================================

// Bank details for payment
export interface BankDetails {
  accountName: string;
  sortCode: string;
  accountNumber: string;
}

// VAT/Tax settings
export interface VATSettings {
  isVATRegistered: boolean;
  vatNumber: string;
  vatRate: number; // Default 20% in UK
}

// Personal/Business billing details (tied to user, not project)
export interface BillingDetails {
  // Personal/Business Information
  fullName: string;
  businessName: string; // Optional - for freelancers trading under a name
  address: string; // Multi-line address
  phone: string;
  email: string;

  // Bank details for payment
  bankDetails: BankDetails;

  // Payment terms
  paymentTerms: string; // e.g., "Payment within 30 days"

  // VAT/Tax settings
  vatSettings: VATSettings;

  // Metadata
  lastUpdated?: Date;
}

// Default billing details for new users
export const createEmptyBillingDetails = (): BillingDetails => ({
  fullName: '',
  businessName: '',
  address: '',
  phone: '',
  email: '',
  bankDetails: {
    accountName: '',
    sortCode: '',
    accountNumber: '',
  },
  paymentTerms: 'Payment within 30 days',
  vatSettings: {
    isVATRegistered: false,
    vatNumber: '',
    vatRate: 20, // UK standard VAT rate
  },
});

// Invoice calculation with VAT
export interface InvoiceCalculation {
  subtotal: number; // Before VAT
  vatAmount: number; // VAT if applicable
  total: number; // Including VAT
  isVATApplicable: boolean;
  vatRate: number;
}

// Calculate invoice totals with VAT
export const calculateInvoiceWithVAT = (
  subtotal: number,
  vatSettings: VATSettings
): InvoiceCalculation => {
  const isVATApplicable = vatSettings.isVATRegistered;
  const vatRate = vatSettings.vatRate;
  const vatAmount = isVATApplicable ? subtotal * (vatRate / 100) : 0;
  const total = subtotal + vatAmount;

  return {
    subtotal,
    vatAmount,
    total,
    isVATApplicable,
    vatRate,
  };
};

// ============================================
// PROJECT LIFECYCLE & EXPORT TYPES
// ============================================

export type ProjectLifecycleState = 'active' | 'wrapped' | 'archived' | 'deleted';

export interface ProjectLifecycle {
  state: ProjectLifecycleState;
  wrappedAt?: Date;
  wrapReason?: 'all_scenes_complete' | 'manual' | 'inactivity';
  lastActivityAt: Date;
  deletionDate?: Date; // 90 days from wrap
  archiveDate?: Date; // When moved to archived (90 days after wrap)
  reminderDismissedAt?: Date; // When user dismissed wrap reminder
  nextReminderAt?: Date; // When to show reminder again (7 days after dismiss)
}

export interface ExportDocument {
  id: ExportDocumentType;
  name: string;
  description: string;
  format: ExportFormat;
  selected: boolean;
  estimatedSize?: number; // in bytes
}

export type ExportDocumentType =
  | 'continuity_bible'
  | 'scene_breakdown'
  | 'character_lookbooks'
  | 'photo_archive'
  | 'timesheets'
  | 'invoice_summary';

export type ExportFormat = 'pdf' | 'csv' | 'excel' | 'zip' | 'pdf_zip';

export type ExportDeliveryMethod = 'download' | 'share' | 'email' | 'cloud';

export interface ExportOptions {
  documents: ExportDocumentType[];
  deliveryMethod: ExportDeliveryMethod;
  email?: string;
  cloudProvider?: 'google_drive' | 'icloud';
}

export interface ExportProgress {
  status: 'idle' | 'preparing' | 'generating' | 'packaging' | 'complete' | 'error';
  currentDocument?: ExportDocumentType;
  progress: number; // 0-100
  error?: string;
  outputUrl?: string;
  outputFilename?: string;
}

// Extended Project interface with lifecycle
export interface ProjectWithLifecycle extends Project {
  lifecycle: ProjectLifecycle;
  firstShootDate?: Date;
  lastShootDate?: Date;
  preparedBy?: string;
}

// Archive/Wrapped project summary for listing
export interface ArchivedProjectSummary {
  id: string;
  name: string;
  state: ProjectLifecycleState;
  wrappedAt?: Date;
  daysUntilDeletion: number;
  scenesCount: number;
  charactersCount: number;
  photosCount: number;
}

// Export document configurations
export const EXPORT_DOCUMENTS: ExportDocument[] = [
  {
    id: 'continuity_bible',
    name: 'Continuity Bible',
    description: 'Complete reference document - all characters, all looks, all scenes with photos',
    format: 'pdf',
    selected: true,
  },
  {
    id: 'scene_breakdown',
    name: 'Scene Breakdown',
    description: 'Spreadsheet of all scenes with H&MU details per character',
    format: 'csv',
    selected: true,
  },
  {
    id: 'character_lookbooks',
    name: 'Character Lookbooks',
    description: 'Individual PDFs per character with all their looks',
    format: 'pdf_zip',
    selected: true,
  },
  {
    id: 'photo_archive',
    name: 'Photo Archive',
    description: 'All captured photos organized by character/scene',
    format: 'zip',
    selected: true,
  },
  {
    id: 'timesheets',
    name: 'Timesheets',
    description: 'All logged hours for the production',
    format: 'pdf',
    selected: true,
  },
  {
    id: 'invoice_summary',
    name: 'Invoice Summary',
    description: 'Total hours, rates, kit rental for invoicing',
    format: 'pdf',
    selected: false,
  },
];

// Project lifecycle constants
export const PROJECT_RETENTION_DAYS = 90; // Days until archival after wrap
export const PROJECT_ARCHIVE_DAYS = 180; // Total days until deletion (90 + 90)
export const REMINDER_INTERVAL_DAYS = 7; // Days between wrap reminders
export const INACTIVITY_TRIGGER_DAYS = 30; // Days of inactivity to trigger wrap

// Notification types for push notifications
export interface ProjectNotification {
  type: 'deletion_30_days' | 'deletion_7_days' | 'deletion_1_day' | 'wrap_reminder';
  projectId: string;
  projectName: string;
  scheduledAt: Date;
  sent: boolean;
}

// Helper to create default lifecycle
export const createDefaultLifecycle = (): ProjectLifecycle => ({
  state: 'active',
  lastActivityAt: new Date(),
});

// Helper to calculate days until deletion
export const calculateDaysUntilDeletion = (wrappedAt: Date): number => {
  const now = new Date();
  const deletionDate = new Date(wrappedAt);
  deletionDate.setDate(deletionDate.getDate() + PROJECT_RETENTION_DAYS);
  const diffTime = deletionDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};

// ============================================
// Authentication & User Types
// ============================================

// User subscription tiers - 'trainee' is the free tier (renamed from 'free')
export type UserTier = 'trainee' | 'artist' | 'supervisor' | 'designer';

// Re-export subscription types
export * from './subscription';

// User account
export interface User {
  id: string;
  email: string;
  name: string;
  tier: UserTier;
  createdAt: Date;
  avatarUrl?: string;
}

// Project membership role (matches Supabase database roles)
export type ProjectRole = 'owner' | 'designer' | 'hod' | 'supervisor' | 'key' | 'floor' | 'daily' | 'trainee' | 'artist' | 'viewer';

// Production types for new projects
export type ProductionType = 'film' | 'tv_series' | 'short_film' | 'commercial' | 'music_video' | 'other';

export const PRODUCTION_TYPES: { value: ProductionType; label: string }[] = [
  { value: 'film', label: 'Film' },
  { value: 'tv_series', label: 'TV Series' },
  { value: 'short_film', label: 'Short Film' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'music_video', label: 'Music Video' },
  { value: 'other', label: 'Other' },
];

// Project status (matches Supabase database status)
export type ProjectStatus = 'active' | 'archived' | 'wrapped' | 'prep' | 'shooting';

// Project membership entry (user's relationship to a project)
export interface ProjectMembership {
  projectId: string;
  projectName: string;
  productionType: ProductionType;
  role: ProjectRole;
  joinedAt: Date;
  lastAccessedAt: Date;
  teamMemberCount: number;
  sceneCount: number;
  projectCode: string;
  status: ProjectStatus;
}

// Auth screen types for navigation
export type AuthScreen = 'welcome' | 'signin' | 'signup' | 'join' | 'hub' | 'create-project' | 'select-plan' | 'profile' | 'project-settings';

// Auth state
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

// Project code format: ABC-1234 (no ambiguous characters)
// Excluded: 0, O, 1, l, I
export const PROJECT_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Generate a project code in ABC-1234 format
export const generateProjectCode = (): string => {
  let code = '';
  // First 3 letters
  for (let i = 0; i < 3; i++) {
    code += PROJECT_CODE_CHARS.charAt(Math.floor(Math.random() * 23)); // Letters only (first 23 chars)
  }
  code += '-';
  // Last 4 alphanumeric
  for (let i = 0; i < 4; i++) {
    code += PROJECT_CODE_CHARS.charAt(Math.floor(Math.random() * PROJECT_CODE_CHARS.length));
  }
  return code;
};

// Validate project code format
export const isValidProjectCode = (code: string): boolean => {
  const pattern = /^[ABCDEFGHJKMNPQRSTUVWXYZ]{3}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;
  return pattern.test(code.toUpperCase());
};

// Format project code as user types (add dash after 3 chars)
export const formatProjectCode = (input: string): string => {
  const cleaned = input.toUpperCase().replace(/[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g, '');
  if (cleaned.length <= 3) return cleaned;
  return cleaned.slice(0, 3) + '-' + cleaned.slice(3, 7);
};

// Tier feature limits (basic version - see subscription.ts for full feature details)
export const TIER_LIMITS: Record<UserTier, { maxProjects: number; maxArchivedProjects: number; canCreateProjects: boolean }> = {
  trainee: { maxProjects: 3, maxArchivedProjects: 1, canCreateProjects: false },
  artist: { maxProjects: 10, maxArchivedProjects: -1, canCreateProjects: false },
  supervisor: { maxProjects: 25, maxArchivedProjects: 15, canCreateProjects: true },
  designer: { maxProjects: -1, maxArchivedProjects: -1, canCreateProjects: true }, // -1 = unlimited
};

// Helper to check if project should trigger wrap
export const shouldTriggerWrap = (
  project: Project,
  lifecycle: ProjectLifecycle
): { trigger: boolean; reason?: ProjectLifecycle['wrapReason'] } => {
  // Already wrapped or archived
  if (lifecycle.state !== 'active') {
    return { trigger: false };
  }

  // Check if all scenes are complete
  const allScenesComplete = project.scenes.length > 0 &&
    project.scenes.every(scene => scene.isComplete);
  if (allScenesComplete) {
    return { trigger: true, reason: 'all_scenes_complete' };
  }

  // Check for inactivity (30 days)
  const now = new Date();
  const lastActivity = new Date(lifecycle.lastActivityAt);
  const daysSinceActivity = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceActivity >= INACTIVITY_TRIGGER_DAYS) {
    return { trigger: true, reason: 'inactivity' };
  }

  return { trigger: false };
};

// ============================================
// PROJECT SETTINGS & TEAM MANAGEMENT TYPES
// ============================================

// Team member roles (more granular than ProjectRole)
export type TeamMemberRole = 'designer' | 'supervisor' | 'key' | 'hair' | 'makeup' | 'sfx' | 'daily' | 'trainee';

// Role display names and hierarchy
export const TEAM_MEMBER_ROLES: { value: TeamMemberRole; label: string; level: number }[] = [
  { value: 'designer', label: 'Designer (HoD)', level: 8 },
  { value: 'supervisor', label: 'Supervisor', level: 7 },
  { value: 'key', label: 'Key Artist', level: 6 },
  { value: 'hair', label: 'Hair Artist', level: 5 },
  { value: 'makeup', label: 'Makeup Artist', level: 4 },
  { value: 'sfx', label: 'Special Effects Artist', level: 3 },
  { value: 'daily', label: 'Daily', level: 2 },
  { value: 'trainee', label: 'Trainee', level: 1 },
];

// Get display label for a role
export const getTeamMemberRoleLabel = (role: TeamMemberRole): string => {
  return TEAM_MEMBER_ROLES.find(r => r.value === role)?.label || role;
};

// Get role level for sorting
export const getTeamMemberRoleLevel = (role: TeamMemberRole): number => {
  return TEAM_MEMBER_ROLES.find(r => r.value === role)?.level || 0;
};

// Team member with full details
export interface TeamMember {
  userId: string;
  projectId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: TeamMemberRole;
  isOwner: boolean;
  joinedAt: Date;
  lastActiveAt: Date;
  editCount: number;
}

// Permission levels for project settings
export type PermissionLevel = 'all' | 'key_plus' | 'supervisor_plus';

// Permission level display names
export const PERMISSION_LEVELS: { value: PermissionLevel; label: string }[] = [
  { value: 'all', label: 'All team members' },
  { value: 'key_plus', label: 'Key artists and above' },
  { value: 'supervisor_plus', label: 'Supervisors only' },
];

// Project permissions settings
export interface ProjectPermissions {
  addPhotos: PermissionLevel;
  editNotes: PermissionLevel;
  markComplete: PermissionLevel;
}

// Extended project settings
export interface ProjectSettings {
  id: string;
  name: string;
  type: ProductionType;
  status: 'prep' | 'shooting' | 'wrapped' | 'archived';
  inviteCode: string;
  ownerId: string;
  permissions: ProjectPermissions;
  createdAt: Date;
  archivedAt: Date | null;
}

// Project status options
export const PROJECT_STATUS_OPTIONS: { value: ProjectSettings['status']; label: string }[] = [
  { value: 'prep', label: 'Prep' },
  { value: 'shooting', label: 'Shooting' },
  { value: 'wrapped', label: 'Wrapped' },
  { value: 'archived', label: 'Archived' },
];

// Shooting day entry for manual schedule
export interface ManualShootingDay {
  id: string;
  projectId: string;
  dayNumber: number;
  date: Date;
  sceneIds: string[];
  createdBy: string;
  createdAt: Date;
}

// Project stats summary
export interface ProjectStats {
  sceneCount: number;
  storyDays: number;
  characterCount: number;
  completedScenes: number;
  completionPercentage: number;
  photoCount: number;
  storageUsed: number; // in bytes
  teamMemberCount: number;
  lastActivity: Date | null;
  mostActiveUser: { name: string; editCount: number } | null;
}

// Role group for team list display
export interface TeamRoleGroup {
  role: TeamMemberRole;
  label: string;
  members: TeamMember[];
}

// Group team members by role
export const groupTeamMembersByRole = (members: TeamMember[]): TeamRoleGroup[] => {
  const groups: Map<TeamMemberRole, TeamMember[]> = new Map();

  // Initialize groups in order
  TEAM_MEMBER_ROLES.forEach(role => {
    groups.set(role.value, []);
  });

  // Add members to groups
  members.forEach(member => {
    const group = groups.get(member.role);
    if (group) {
      group.push(member);
    }
  });

  // Sort members within each group alphabetically
  groups.forEach(memberList => {
    memberList.sort((a, b) => a.name.localeCompare(b.name));
  });

  // Convert to array, filter out empty groups
  return TEAM_MEMBER_ROLES
    .filter(role => (groups.get(role.value)?.length || 0) > 0)
    .map(role => ({
      role: role.value,
      label: role.label + 's',
      members: groups.get(role.value) || [],
    }));
};

// Helper to check if user can manage project
export const canManageProject = (
  userTier: UserTier,
  membership: { isOwner: boolean; role: TeamMemberRole } | null
): boolean => {
  if (!membership) return false;
  if (membership.isOwner) return true;

  // Supervisors and above can manage if they're supervisor tier or higher
  const supervisorRoles: TeamMemberRole[] = ['designer', 'supervisor'];
  const canManageTiers: UserTier[] = ['supervisor', 'designer'];

  return canManageTiers.includes(userTier) && supervisorRoles.includes(membership.role);
};

// Helper to check if user can edit settings (owner only)
export const canEditProjectSettings = (
  membership: { isOwner: boolean } | null
): boolean => {
  return membership?.isOwner === true;
};

// Helper to check if user has permission for an action
export const hasPermission = (
  role: TeamMemberRole,
  requiredLevel: PermissionLevel
): boolean => {
  const roleLevel = getTeamMemberRoleLevel(role);

  switch (requiredLevel) {
    case 'all':
      return true;
    case 'key_plus':
      return roleLevel >= 4; // Key artist and above
    case 'supervisor_plus':
      return roleLevel >= 5; // Supervisor and above
    default:
      return false;
  }
};

// Create default project permissions
export const createDefaultProjectPermissions = (): ProjectPermissions => ({
  addPhotos: 'all',
  editNotes: 'all',
  markComplete: 'key_plus',
});

// Create default project settings
export const createDefaultProjectSettings = (
  id: string,
  name: string,
  type: ProductionType,
  ownerId: string,
  inviteCode: string
): ProjectSettings => ({
  id,
  name,
  type,
  status: 'prep',
  inviteCode,
  ownerId,
  permissions: createDefaultProjectPermissions(),
  createdAt: new Date(),
  archivedAt: null,
});

// Format storage size for display
export const formatStorageSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};
