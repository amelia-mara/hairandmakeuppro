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

  // Watch projectStore for changes → push to Supabase
  useProjectStore.subscribe((state, prevState) => {
    const projectId = getActiveProjectId();
    if (!projectId) return;
    if (!state.currentProject) return;

    const prev = prevState.currentProject;
    const curr = state.currentProject;
    if (!prev || !curr) return;

    // Push scenes if changed
    if (prev.scenes !== curr.scenes) {
      pushScenes(projectId, curr.scenes);
    }

    // Push characters if changed
    if (prev.characters !== curr.characters) {
      pushCharacters(projectId, curr.characters);
    }

    // Push looks if changed
    if (prev.looks !== curr.looks) {
      pushLooks(projectId, curr.looks);
    }

    // Push scene captures if changed
    if (prevState.sceneCaptures !== state.sceneCaptures) {
      const userId = useAuthStore.getState().user?.id || null;
      for (const [captureId, capture] of Object.entries(state.sceneCaptures)) {
        if (prevState.sceneCaptures[captureId] !== capture) {
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
      state.schedule &&
      state.schedule.status === 'complete'
    ) {
      pushScheduleData(projectId, state.schedule);
    }
  });
}
