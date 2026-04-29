// Slim CallSheet types for prep — mirrors mobile-pwa/src/types where the
// mobile app stores parsed call sheet structure. These exact field names
// are what the mobile-pwa store reads, so they must stay in sync.

export interface CallSheetLocation {
  name: string;
  address?: string;
  what3words?: string;
  notes?: string;
}

export interface CallSheetScene {
  sceneNumber: string;
  location?: string;
  setDescription: string;
  action?: string;
  dayNight: string;
  pages?: string;
  cast?: string[];
  notes?: string;
  estimatedTime?: string;
  startTime?: string;
  endTime?: string;
  shootOrder: number;
  status: 'upcoming' | 'in-progress' | 'wrapped';
}

export interface CastCall {
  id: string;
  name: string;
  character: string;
  status: string;
  pickup?: string;
  driver?: string;
  callTime: string;
  makeupCall?: string;
  costumeCall?: string;
  hmuCall?: string;
  travelTime?: string;
  onSetTime?: string;
  notes?: string;
}

export interface SupportingArtistCall {
  id: string;
  name: string;
  designation: string;
  status: string;
  callTime: string;
  makeupCall?: string;
  costumeCall?: string;
  hmuCall?: string;
  travelTime?: string;
  onSetTime?: string;
  notes?: string;
}

export interface CallSheet {
  id: string;
  date: string;
  productionDay: number;
  totalProductionDays?: number;
  dayType?: string;
  unitCallTime: string;
  rehearsalsTime?: string;
  firstShotTime?: string;
  preCalls?: {
    ads?: string;
    hmu?: string;
    costume?: string;
    production?: string;
    lighting?: string;
    camera?: string;
    location?: string;
  };
  breakfastTime?: string;
  lunchTime?: string;
  lunchLocation?: string;
  cameraWrapEstimate?: string;
  wrapEstimate?: string;
  weather?: {
    conditions?: string;
    tempHigh?: number;
    tempLow?: number;
    sunrise?: string;
    sunset?: string;
  };
  unitBase?: CallSheetLocation;
  shootLocation?: CallSheetLocation;
  crewParking?: CallSheetLocation;
  unitNotes?: string[];
  scenes: CallSheetScene[];
  castCalls?: CastCall[];
  supportingArtists?: SupportingArtistCall[];
  uploadedAt: Date;
  pdfUri?: string;
  rawText?: string;
}
