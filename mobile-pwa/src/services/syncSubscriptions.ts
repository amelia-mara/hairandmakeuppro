/**
 * Sync Subscriptions
 *
 * Watches Zustand stores for changes and pushes updates to Supabase.
 * This file is imported once in App.tsx to set up the subscriptions.
 * It's separate from the stores to avoid circular imports.
 *
 * IMPORTANT: The `receivingFromServer` flag prevents infinite echo loops.
 * When a realtime event updates the local store, this flag is set so we
 * don't push the same data back to the server, which would cause:
 *   User A pushes → server broadcasts → User B updates store →
 *   syncSubscriptions pushes back → server broadcasts → User A updates → ...
 */

import { useProjectStore } from '@/stores/projectStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useCallSheetStore } from '@/stores/callSheetStore';
import { useAuthStore } from '@/stores/authStore';
import type { SceneCapture } from '@/types';
import {
  pushScenes,
  pushCharacters,
  pushLooks,
  pushSceneCapture,
  pushScheduleData,
  pushCallSheetData,
  pushScriptPdf,
  getActiveProjectId,
  receivingFromServer,
} from './syncService';

// Track whether subscriptions have been set up (idempotent)
let initialized = false;

export function initSyncSubscriptions(): void {
  if (initialized) return;
  initialized = true;

  // Watch projectStore for changes → push to Supabase
  useProjectStore.subscribe((state, prevState) => {
    const projectId = getActiveProjectId();
    if (!projectId) {
      // activeProjectId not set yet — startSync hasn't completed.
      // pushInitialData() in startSync will catch this data.
      return;
    }

    // Skip push if this change came from a server realtime event.
    // The receivingFromServer flag is set by realtime handlers in syncService.ts
    // right before they call mergeServerData(), and cleared right after.
    // Since Zustand subscriptions fire synchronously during set(), this
    // check reliably prevents echo loops.
    if (receivingFromServer) return;

    const prev = prevState.currentProject;
    const curr = state.currentProject;
    if (!curr) return;

    // Push scenes if changed (or if project was just set with scenes)
    if (curr.scenes.length > 0 && (!prev || prev.scenes !== curr.scenes)) {
      pushScenes(projectId, curr.scenes);
    }

    // Push characters if changed
    if (curr.characters.length > 0 && (!prev || prev.characters !== curr.characters)) {
      pushCharacters(projectId, curr.characters);
    }

    // Push looks if changed
    if (curr.looks.length > 0 && (!prev || prev.looks !== curr.looks)) {
      pushLooks(projectId, curr.looks);
    }

    // Push scene captures if changed
    if (prevState.sceneCaptures !== state.sceneCaptures) {
      const userId = useAuthStore.getState().user?.id || null;
      for (const [captureId, capture] of Object.entries(state.sceneCaptures)) {
        if (prevState.sceneCaptures[captureId] !== capture) {
          pushSceneCapture(projectId, capture as SceneCapture, userId);
        }
      }
    }

    // Push script PDF if changed
    if (curr.scriptPdfData && (!prev || prev.scriptPdfData !== curr.scriptPdfData)) {
      const userId = useAuthStore.getState().user?.id || null;
      pushScriptPdf(projectId, curr.scriptPdfData, userId);
    }
  });

  // Watch scheduleStore for changes → push to Supabase
  useScheduleStore.subscribe((state, prevState) => {
    const projectId = getActiveProjectId();
    if (!projectId) return;
    if (receivingFromServer) return;

    if (
      state.schedule !== prevState.schedule &&
      state.schedule
    ) {
      pushScheduleData(projectId, state.schedule);
    }
  });

  // Watch callSheetStore for changes → push to Supabase
  useCallSheetStore.subscribe((state, prevState) => {
    const projectId = getActiveProjectId();
    if (!projectId) return;
    if (receivingFromServer) return;

    if (state.callSheets !== prevState.callSheets && state.callSheets.length > 0) {
      const userId = useAuthStore.getState().user?.id || null;

      // Find new or changed call sheets
      for (const cs of state.callSheets) {
        const prev = prevState.callSheets.find((p) => p.id === cs.id);
        if (!prev || prev !== cs) {
          pushCallSheetData(projectId, cs, userId);
        }
      }
    }
  });
}
