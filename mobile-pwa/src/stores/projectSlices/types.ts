import type {
  Project,
  Scene,
  Character,
  Look,
  SceneCapture,
  Photo,
  ContinuityFlags,
  ContinuityEvent,
  NavTab,
  SceneFilter,
  ProjectLifecycle,
  ArchivedProjectSummary,
  SceneFilmingStatus,
  CharacterConfirmationStatus,
  CharacterDetectionStatus,
  CastProfile,
  ProductionSchedule,
  SFXDetails,
} from '@/types';
import type { CastSyncResult } from '@/services/castSyncService';
import type { AmendmentResult } from '@/services/scriptAmendmentService';
import type { FastParsedScene } from '@/utils/scriptParser';

// Saved project data (indexed by project ID)
export interface SavedProjectData {
  project: Project;
  sceneCaptures: Record<string, SceneCapture>;
  lifecycle: ProjectLifecycle;
  needsSetup: boolean;
}

export interface ProjectState {
  // Current state
  currentProject: Project | null;
  currentSceneId: string | null;
  currentCharacterId: string | null;
  currentLookId: string | null;
  activeTab: NavTab;
  sceneFilter: SceneFilter;
  searchQuery: string;

  // Flag to indicate project needs setup (show upload flow)
  needsSetup: boolean;

  // Scene captures (working data during shooting)
  sceneCaptures: Record<string, SceneCapture>;

  // Project lifecycle
  lifecycle: ProjectLifecycle;
  showWrapPopup: boolean;
  wrapTriggerReason: ProjectLifecycle['wrapReason'] | null;

  // Saved projects (persisted by project ID for multi-project support)
  savedProjects: Record<string, SavedProjectData>;

  // Archived projects
  archivedProjects: Array<{
    project: Project;
    lifecycle: ProjectLifecycle;
    sceneCaptures: Record<string, SceneCapture>;
  }>;

  // Actions - Project
  setProject: (project: Project) => void;
  setProjectNeedsSetup: (project: Project) => void;
  clearNeedsSetup: () => void;
  setScriptPdf: (pdfData: string) => void;
  clearProject: () => void;
  saveAndClearProject: () => void;
  restoreSavedProject: (projectId: string) => boolean;
  hasSavedProject: (projectId: string) => boolean;
  removeSavedProject: (projectId: string) => void;

  // Actions - Navigation
  setActiveTab: (tab: NavTab) => void;
  setCurrentScene: (sceneId: string | null) => void;
  setCurrentCharacter: (characterId: string | null) => void;
  setCurrentLook: (lookId: string | null) => void;
  setSceneFilter: (filter: SceneFilter) => void;
  setSearchQuery: (query: string) => void;

  // Actions - Scene Capture
  getOrCreateSceneCapture: (sceneId: string, characterId: string) => SceneCapture;
  updateSceneCapture: (captureId: string, updates: Partial<SceneCapture>) => void;
  addPhotoToCapture: (captureId: string, photo: Photo, slot: keyof SceneCapture['photos'] | 'additional') => void;
  removePhotoFromCapture: (captureId: string, slot: keyof SceneCapture['photos'] | 'additional', photoId?: string) => void;
  toggleContinuityFlag: (captureId: string, flag: keyof ContinuityFlags) => void;
  addContinuityEvent: (captureId: string, event: ContinuityEvent) => void;
  updateContinuityEvent: (captureId: string, eventId: string, updates: Partial<ContinuityEvent>) => void;
  removeContinuityEvent: (captureId: string, eventId: string) => void;

  // Actions - SFX
  updateSFXDetails: (captureId: string, sfx: SFXDetails) => void;
  addSFXPhoto: (captureId: string, photo: Photo) => void;
  removeSFXPhoto: (captureId: string, photoId: string) => void;

  // Actions - Scene Management
  addScene: (sceneData: Partial<Scene> & { sceneNumber: string }) => Scene;
  addCharacterToScene: (sceneId: string, characterId: string) => void;

  // Actions - Scene Completion
  markSceneComplete: (sceneId: string) => void;
  markSceneIncomplete: (sceneId: string) => void;
  copyToNextScene: (currentSceneId: string, characterId: string) => string | null;

  // Actions - Scene Filming Status (synced between Today and Breakdown)
  updateSceneFilmingStatus: (sceneNumber: string, filmingStatus: SceneFilmingStatus, filmingNotes?: string) => void;

  // Actions - Scene Synopsis
  updateSceneSynopsis: (sceneId: string, synopsis: string) => void;
  updateAllSceneSynopses: (scenes: Scene[]) => void;

  // Actions - Look Updates
  updateLook: (lookId: string, updates: Partial<Look>) => void;
  updateLookWithPropagation: (lookId: string, updates: Partial<Look>) => void;

  // Actions - Cast Profiles
  getCastProfile: (characterId: string) => CastProfile | undefined;
  updateCastProfile: (characterId: string, updates: Partial<CastProfile>) => void;

  // Actions - Character Confirmation (for progressive scene-by-scene workflow)
  startCharacterDetection: () => void;
  setCharacterDetectionStatus: (status: CharacterDetectionStatus) => void;
  updateSceneSuggestedCharacters: (sceneId: string, characters: string[]) => void;
  updateSceneConfirmationStatus: (sceneId: string, status: CharacterConfirmationStatus) => void;
  confirmSceneCharacters: (sceneId: string, confirmedCharacterIds: string[]) => void;
  addCharacterFromScene: (sceneId: string, characterName: string) => Character;
  getUnconfirmedScenesCount: () => number;
  getConfirmedScenesCount: () => number;

  // Actions - Cast Sync from Schedule
  syncCastDataFromSchedule: (
    schedule: ProductionSchedule,
    options?: { createMissingCharacters?: boolean; overwriteExisting?: boolean; autoConfirm?: boolean }
  ) => CastSyncResult | null;
  canSyncCastData: (schedule: ProductionSchedule | null) => { canSync: boolean; reason?: string };

  // Actions - Script Amendment (revised script uploads)
  compareScriptAmendment: (newParsedScenes: FastParsedScene[]) => AmendmentResult | null;
  applyScriptAmendment: (
    amendmentResult: AmendmentResult,
    options?: { includeNew?: boolean; includeModified?: boolean; includeDeleted?: boolean }
  ) => void;
  clearSceneAmendmentFlags: () => void;
  clearSingleSceneAmendment: (sceneId: string) => void;
  getAmendmentCounts: () => { total: number; new: number; modified: number; deleted: number };

  // Actions - Lifecycle
  updateActivity: () => void;
  checkWrapTrigger: () => void;
  wrapProject: (reason: ProjectLifecycle['wrapReason']) => void;
  dismissWrapPopup: (remindLater: boolean) => void;
  restoreProject: () => void;
  archiveProject: () => void;
  permanentlyDeleteProject: () => void;
  getArchivedProjects: () => ArchivedProjectSummary[];
  loadArchivedProject: (projectId: string) => void;
  getDaysUntilDeletion: () => number;
  getLifecycleBanner: () => { show: boolean; message: string; daysRemaining: number } | null;

  // Computed/Derived
  getScene: (sceneId: string) => Scene | undefined;
  getCharacter: (characterId: string) => Character | undefined;
  getLookForCharacterInScene: (characterId: string, sceneNumber: string) => Look | undefined;
  getSceneCapture: (sceneId: string, characterId: string) => SceneCapture | undefined;
  getFilteredScenes: () => Scene[];
  getScenesForLook: (lookId: string) => Scene[];
}

// Helper types for slice creators
export type ProjectSet = (
  partial: ProjectState | Partial<ProjectState> | ((state: ProjectState) => ProjectState | Partial<ProjectState>),
  replace?: boolean
) => void;

export type ProjectGet = () => ProjectState;
