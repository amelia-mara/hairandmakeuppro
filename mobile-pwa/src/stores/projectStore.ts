import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createHybridStorage } from '@/db/zustandStorage';
import { useScheduleStore } from './scheduleStore';
import { useCallSheetStore } from './callSheetStore';
import { createDefaultLifecycle, type Project } from '@/types';
import {
  createSceneSlice,
  createCaptureSlice,
  createCharacterSlice,
  createLookSlice,
  createAmendmentSlice,
  createLifecycleSlice,
} from './projectSlices';
import { dedupeScenesByNumber } from './projectSlices/sceneDedupe';
import type { ProjectState } from './projectSlices';

/** Apply scene dedupe to a project. Returns the project unchanged if there
 *  are no duplicate sceneNumbers, otherwise returns a new project object
 *  with the duplicates merged. */
function withDedupedScenes(project: Project | null): Project | null {
  if (!project) return project;
  const deduped = dedupeScenesByNumber(project.scenes);
  if (deduped.length === project.scenes.length) return project;
  return { ...project, scenes: deduped };
}

// Re-export for consumers that import ProjectState from this module
export type { ProjectState } from './projectSlices';

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentProject: null,
      currentSceneId: null,
      currentCharacterId: null,
      currentLookId: null,
      activeTab: 'today',
      sceneFilter: 'all',
      searchQuery: '',
      needsSetup: false,
      sceneCaptures: {},

      // Lifecycle initial state
      lifecycle: createDefaultLifecycle(),
      showWrapPopup: false,
      wrapTriggerReason: null,
      savedProjects: {},
      archivedProjects: [],

      // ── Project CRUD ──────────────────────────────────────────

      setProject: (project) => set({
        currentProject: withDedupedScenes(project),
        needsSetup: false,
        lifecycle: createDefaultLifecycle(),
        showWrapPopup: false,
        wrapTriggerReason: null,
      }),

      setProjectNeedsSetup: (project) => set({
        currentProject: withDedupedScenes(project),
        needsSetup: true,
        lifecycle: createDefaultLifecycle(),
        showWrapPopup: false,
        wrapTriggerReason: null,
      }),

      clearNeedsSetup: () => set({ needsSetup: false }),

      setScriptPdf: (pdfData, filename) => set((state) => ({
        currentProject: state.currentProject
          ? { ...state.currentProject, scriptPdfData: pdfData, ...(filename ? { scriptFilename: filename } : {}) }
          : null,
      })),

      mergeServerData: (updates) => set((state) => ({
        currentProject: state.currentProject
          ? withDedupedScenes({ ...state.currentProject, ...updates })
          : null,
      })),

      clearProject: () => set({
        currentProject: null,
        currentSceneId: null,
        currentCharacterId: null,
        needsSetup: false,
        sceneCaptures: {},
        lifecycle: createDefaultLifecycle(),
        showWrapPopup: false,
        wrapTriggerReason: null,
      }),

      // Save current project data before clearing (preserves data for later restoration)
      saveAndClearProject: () => {
        const state = get();
        if (state.currentProject) {
          // Capture references before set() to avoid stale closure issues
          const projectId = state.currentProject.id;
          const projectToSave = state.currentProject;
          const capturesToSave = state.sceneCaptures;
          const lifecycleToSave = state.lifecycle;
          const needsSetupToSave = state.needsSetup;

          // Also save the schedule and call sheet data for this project
          useScheduleStore.getState().saveScheduleForProject(projectId);
          useCallSheetStore.getState().saveCallSheetsForProject(projectId);

          set((s) => ({
            savedProjects: {
              ...s.savedProjects,
              [projectId]: {
                project: projectToSave,
                sceneCaptures: capturesToSave,
                lifecycle: lifecycleToSave,
                needsSetup: needsSetupToSave,
              },
            },
            currentProject: null,
            currentSceneId: null,
            currentCharacterId: null,
            needsSetup: false,
            sceneCaptures: {},
            lifecycle: createDefaultLifecycle(),
            showWrapPopup: false,
            wrapTriggerReason: null,
          }));
        } else {
          // Clear schedule and call sheet data when clearing project without saving
          useScheduleStore.getState().clearScheduleForProject();
          useCallSheetStore.getState().clearCallSheetsForProject();

          set({
            currentProject: null,
            currentSceneId: null,
            currentCharacterId: null,
            needsSetup: false,
            sceneCaptures: {},
            lifecycle: createDefaultLifecycle(),
            showWrapPopup: false,
            wrapTriggerReason: null,
          });
        }
      },

      // Restore a previously saved project
      restoreSavedProject: (projectId: string) => {
        const state = get();
        const savedData = state.savedProjects[projectId];
        if (!savedData) return false;

        // Remove from saved and set as current
        const newSavedProjects = { ...state.savedProjects };
        delete newSavedProjects[projectId];

        // Also restore the schedule and call sheet data for this project
        useScheduleStore.getState().restoreScheduleForProject(projectId);
        useCallSheetStore.getState().restoreCallSheetsForProject(projectId);

        set({
          currentProject: withDedupedScenes(savedData.project),
          sceneCaptures: savedData.sceneCaptures,
          lifecycle: savedData.lifecycle,
          needsSetup: savedData.needsSetup,
          savedProjects: newSavedProjects,
          currentSceneId: null,
          currentCharacterId: null,
          showWrapPopup: false,
          wrapTriggerReason: null,
        });
        return true;
      },

      // Check if a project has saved data
      hasSavedProject: (projectId: string) => {
        return !!get().savedProjects[projectId];
      },

      // Remove a saved project from storage
      removeSavedProject: (projectId: string) => {
        const newSavedProjects = { ...get().savedProjects };
        delete newSavedProjects[projectId];
        set({ savedProjects: newSavedProjects });
      },

      // ── Navigation ────────────────────────────────────────────

      setActiveTab: (tab) => set({ activeTab: tab }),
      setCurrentScene: (sceneId) => set({ currentSceneId: sceneId }),
      setCurrentCharacter: (characterId) => set({ currentCharacterId: characterId }),
      setCurrentLook: (lookId) => set({ currentLookId: lookId }),
      setSceneFilter: (filter) => set({ sceneFilter: filter }),
      setSearchQuery: (query) => set({ searchQuery: query }),

      // ── Domain slices ─────────────────────────────────────────

      ...createSceneSlice(set, get),
      ...createCaptureSlice(set, get),
      ...createCharacterSlice(set, get),
      ...createLookSlice(set, get),
      ...createAmendmentSlice(set, get),
      ...createLifecycleSlice(set, get),
    }),
    {
      name: 'hair-makeup-pro-storage',
      // Use IndexedDB with debounced writes for large project data
      storage: createHybridStorage('hair-makeup-pro-storage'),
      partialize: (state) => ({
        currentProject: state.currentProject,
        activeTab: state.activeTab,
        sceneCaptures: state.sceneCaptures,
        lifecycle: state.lifecycle,
        savedProjects: state.savedProjects,
        archivedProjects: state.archivedProjects,
        needsSetup: state.needsSetup,
      }),
      // Clean up any duplicate scenes already present in persisted state
      // (legacy data from a realtime-sync regression that re-added scenes
      // with empty characters). Runs once after rehydration.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.currentProject) {
          state.currentProject = withDedupedScenes(state.currentProject);
        }
        if (state.savedProjects) {
          for (const key of Object.keys(state.savedProjects)) {
            const saved = state.savedProjects[key];
            const cleaned = withDedupedScenes(saved.project);
            if (cleaned && cleaned !== saved.project) {
              state.savedProjects[key] = { ...saved, project: cleaned };
            }
          }
        }
      },
    }
  )
);
