/**
 * Sync Change Tracker + Auto-Save
 *
 * Watches Zustand stores for changes and automatically saves to Supabase.
 * For solo users this provides seamless cloud persistence — no manual
 * upload button needed. Data saves on every change, like Google Docs.
 *
 * The receivingFromServer flag prevents server-sourced updates from
 * triggering a save loop.
 */

import { useProjectStore } from '@/stores/projectStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useCallSheetStore } from '@/stores/callSheetStore';
import { useSyncStore } from '@/stores/syncStore';
import {
  autoSaveScenes,
  autoSaveCharacters,
  autoSaveLooks,
  autoSaveCaptures,
  autoSaveSchedule,
  autoSaveCallSheets,
  autoSaveScript,
  flushAutoSave,
} from '@/services/autoSave';

let initialized = false;

/**
 * Flag set during downloads to prevent marking server-sourced
 * updates as pending local changes (and triggering auto-save).
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
      autoSaveScenes();
    }

    // Track character changes
    if (curr.characters.length > 0 && (!prev || prev.characters !== curr.characters)) {
      useSyncStore.getState().markChanged('characters');
      autoSaveCharacters();
    }

    // Track look changes
    if (curr.looks.length > 0 && (!prev || prev.looks !== curr.looks)) {
      useSyncStore.getState().markChanged('looks');
      autoSaveLooks();
    }

    // Track scene capture changes
    if (prevState.sceneCaptures !== state.sceneCaptures) {
      useSyncStore.getState().markChanged('captures');
      autoSaveCaptures();
    }

    // Track script changes
    if (curr.scriptPdfData && (!prev || prev.scriptPdfData !== curr.scriptPdfData)) {
      useSyncStore.getState().markChanged('script');
      autoSaveScript();
    }
  });

  // Watch scheduleStore for changes
  useScheduleStore.subscribe((state, prevState) => {
    if (receivingFromServer) return;

    if (state.schedule !== prevState.schedule && state.schedule) {
      useSyncStore.getState().markChanged('schedule');
      autoSaveSchedule();
    }
  });

  // Watch callSheetStore for changes
  useCallSheetStore.subscribe((state, prevState) => {
    if (receivingFromServer) return;

    if (state.callSheets !== prevState.callSheets && state.callSheets.length > 0) {
      useSyncStore.getState().markChanged('callSheets');
      autoSaveCallSheets();
    }
  });

  // Flush pending auto-saves when app goes to background or closes
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      flushAutoSave();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushAutoSave();
      }
    });
  }
}
