/**
 * Sync Change Tracker
 *
 * Watches Zustand stores for changes and marks categories as "pending"
 * in the sync store. This replaces the old syncSubscriptions.ts which
 * auto-pushed changes to Supabase.
 *
 * Now changes are only tracked — the user decides when to upload.
 */

import { useProjectStore } from '@/stores/projectStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useCallSheetStore } from '@/stores/callSheetStore';
import { useSyncStore } from '@/stores/syncStore';

let initialized = false;

/**
 * Flag set during downloads to prevent marking server-sourced
 * updates as pending local changes.
 */
export let receivingFromServer = false;

export function setReceivingFromServer(value: boolean): void {
  receivingFromServer = value;
}

export function initChangeTracking(): void {
  if (initialized) return;
  initialized = true;

  // Watch projectStore for changes
  useProjectStore.subscribe((state, prevState) => {
    if (receivingFromServer) return;

    const prev = prevState.currentProject;
    const curr = state.currentProject;
    if (!curr) return;

    // Track scene changes
    if (curr.scenes.length > 0 && (!prev || prev.scenes !== curr.scenes)) {
      useSyncStore.getState().markChanged('scenes');
    }

    // Track character changes
    if (curr.characters.length > 0 && (!prev || prev.characters !== curr.characters)) {
      useSyncStore.getState().markChanged('characters');
    }

    // Track look changes
    if (curr.looks.length > 0 && (!prev || prev.looks !== curr.looks)) {
      useSyncStore.getState().markChanged('looks');
    }

    // Track scene capture changes
    if (prevState.sceneCaptures !== state.sceneCaptures) {
      useSyncStore.getState().markChanged('captures');
    }

    // Track script changes
    if (curr.scriptPdfData && (!prev || prev.scriptPdfData !== curr.scriptPdfData)) {
      useSyncStore.getState().markChanged('script');
    }
  });

  // Watch scheduleStore for changes
  useScheduleStore.subscribe((state, prevState) => {
    if (receivingFromServer) return;

    if (state.schedule !== prevState.schedule && state.schedule) {
      useSyncStore.getState().markChanged('schedule');
    }
  });

  // Watch callSheetStore for changes
  useCallSheetStore.subscribe((state, prevState) => {
    if (receivingFromServer) return;

    if (state.callSheets !== prevState.callSheets && state.callSheets.length > 0) {
      useSyncStore.getState().markChanged('callSheets');
    }
  });
}
