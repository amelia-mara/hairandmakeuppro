/**
 * Sync Subscriptions
 *
 * Watches Zustand stores for changes and pushes updates to Supabase.
 * This file is imported once in App.tsx to set up the subscriptions.
 * It's separate from the stores to avoid circular imports.
 */

import { useProjectStore } from '@/stores/projectStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useAuthStore } from '@/stores/authStore';
import {
  pushScenes,
  pushCharacters,
  pushLooks,
  pushSceneCapture,
  pushScheduleData,
  getActiveProjectId,
} from './syncService';

// Track whether subscriptions have been set up (idempotent)
let initialized = false;

export function initSyncSubscriptions(): void {
  if (initialized) return;
  initialized = true;
  console.log('[SYNC-SUB] Initializing sync subscriptions');

  // Watch projectStore for changes → push to Supabase
  useProjectStore.subscribe((state, prevState) => {
    const projectId = getActiveProjectId();
    if (!projectId) {
      // activeProjectId not set yet — startSync hasn't completed.
      // pushInitialData() in startSync will catch this data.
      return;
    }
    if (!state.currentProject) return;

    const prev = prevState.currentProject;
    const curr = state.currentProject;
    if (!prev || !curr) {
      // First setProject() call (null → project). pushInitialData()
      // in startSync will handle pushing this initial data.
      return;
    }

    // Push scenes if changed
    if (prev.scenes !== curr.scenes) {
      console.log('[SYNC-SUB] Scenes changed:', prev.scenes.length, '→', curr.scenes.length);
      pushScenes(projectId, curr.scenes);
    }

    // Push characters if changed
    if (prev.characters !== curr.characters) {
      console.log('[SYNC-SUB] Characters changed:', prev.characters.length, '→', curr.characters.length);
      pushCharacters(projectId, curr.characters);
    }

    // Push looks if changed
    if (prev.looks !== curr.looks) {
      console.log('[SYNC-SUB] Looks changed:', prev.looks.length, '→', curr.looks.length);
      pushLooks(projectId, curr.looks);
    }

    // Push scene captures if changed
    if (prevState.sceneCaptures !== state.sceneCaptures) {
      const userId = useAuthStore.getState().user?.id || null;
      for (const [captureId, capture] of Object.entries(state.sceneCaptures)) {
        if (prevState.sceneCaptures[captureId] !== capture) {
          console.log('[SYNC-SUB] Scene capture changed:', captureId);
          pushSceneCapture(projectId, capture as any, userId);
        }
      }
    }
  });

  // Watch scheduleStore for changes → push to Supabase
  useScheduleStore.subscribe((state, prevState) => {
    const projectId = getActiveProjectId();
    if (!projectId) return;

    if (
      state.schedule !== prevState.schedule &&
      state.schedule
    ) {
      console.log('[SYNC-SUB] Schedule changed, pushing to Supabase, status:', state.schedule.status);
      pushScheduleData(projectId, state.schedule);
    }
  });
}
