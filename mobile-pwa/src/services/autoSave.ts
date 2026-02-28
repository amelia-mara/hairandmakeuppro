/**
 * Auto-Save Service
 *
 * Debounced writes to Supabase whenever local stores change.
 * For solo users, this replaces the manual Upload button — data
 * is saved automatically on every change, like Google Docs.
 *
 * The syncChangeTracker calls these functions when it detects
 * store mutations (with receivingFromServer === false).
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { useCallSheetStore } from '@/stores/callSheetStore';
import {
  sceneToDb,
  characterToDb,
  lookToDb,
  sceneCaptureToDb,
} from '@/services/manualSync';
import * as supabaseStorage from '@/services/supabaseStorage';
import { getPhotoBlob } from '@/db';
import type { SceneCapture, Photo } from '@/types';
import type { Json } from '@/types/supabase';

// ============================================================================
// Debounce infrastructure
// ============================================================================

const DEBOUNCE_MS = 800;
const timers: Record<string, ReturnType<typeof setTimeout>> = {};
const pendingFns: Record<string, () => Promise<void>> = {};

/** Check if user is still authenticated before writing. */
async function hasActiveSession(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  } catch {
    return false;
  }
}

function debounced(key: string, fn: () => Promise<void>): void {
  if (timers[key]) clearTimeout(timers[key]);
  pendingFns[key] = fn;
  timers[key] = setTimeout(async () => {
    delete timers[key];
    delete pendingFns[key];
    try {
      if (!(await hasActiveSession())) {
        console.warn(`[AutoSave] ${key} skipped — no active session`);
        return;
      }
      await fn();
    } catch (err) {
      console.error(`[AutoSave] ${key} failed:`, err);
    }
  }, DEBOUNCE_MS);
}

/** Flush all pending auto-saves immediately (call on beforeunload). */
export async function flushAutoSave(): Promise<void> {
  const fns = Object.values({ ...pendingFns });
  for (const key of Object.keys(timers)) {
    clearTimeout(timers[key]);
    delete timers[key];
  }
  for (const key of Object.keys(pendingFns)) {
    delete pendingFns[key];
  }
  for (const fn of fns) {
    try {
      await fn();
    } catch (e) {
      console.error('[AutoSave] Flush failed:', e);
    }
  }
}

// ============================================================================
// Per-category auto-save functions
// ============================================================================

export function autoSaveScenes(): void {
  if (!isSupabaseConfigured) return;
  const project = useProjectStore.getState().currentProject;
  if (!project || project.scenes.length === 0) return;

  const projectId = project.id;
  const scenes = [...project.scenes];

  debounced('scenes', async () => {
    const dbScenes = scenes.map(s => sceneToDb(s, projectId));
    const { error } = await supabase
      .from('scenes')
      .upsert(dbScenes, { onConflict: 'id' });
    if (error) throw error;

    // Sync scene_characters junction
    const sceneIds = scenes.map(s => s.id);
    const entries: { scene_id: string; character_id: string }[] = [];
    for (const scene of scenes) {
      for (const charId of scene.characters) {
        entries.push({ scene_id: scene.id, character_id: charId });
      }
    }
    if (sceneIds.length > 0) {
      await supabase.rpc('sync_scene_characters', {
        p_scene_ids: sceneIds,
        p_entries: entries,
      });
    }
    console.log('[AutoSave] Scenes saved');
  });
}

export function autoSaveCharacters(): void {
  if (!isSupabaseConfigured) return;
  const project = useProjectStore.getState().currentProject;
  if (!project || project.characters.length === 0) return;

  const projectId = project.id;
  const characters = [...project.characters];

  debounced('characters', async () => {
    const dbChars = characters.map(c => characterToDb(c, projectId));
    const { error } = await supabase
      .from('characters')
      .upsert(dbChars, { onConflict: 'id' });
    if (error) throw error;
    console.log('[AutoSave] Characters saved');
  });
}

export function autoSaveLooks(): void {
  if (!isSupabaseConfigured) return;
  const project = useProjectStore.getState().currentProject;
  if (!project || project.looks.length === 0) return;

  const projectId = project.id;
  const looks = [...project.looks];

  debounced('looks', async () => {
    const dbLooks = looks.map(l => lookToDb(l, projectId));
    const { error } = await supabase
      .from('looks')
      .upsert(dbLooks, { onConflict: 'id' });
    if (error) throw error;

    // Sync look_scenes junction
    const lookIds = looks.map(l => l.id);
    const entries: { look_id: string; scene_number: string }[] = [];
    for (const look of looks) {
      for (const sceneNum of look.scenes) {
        entries.push({ look_id: look.id, scene_number: sceneNum });
      }
    }
    if (lookIds.length > 0) {
      await supabase.rpc('sync_look_scenes', {
        p_look_ids: lookIds,
        p_entries: entries,
      });
    }
    console.log('[AutoSave] Looks saved');
  });
}

export function autoSaveCaptures(): void {
  if (!isSupabaseConfigured) return;
  const project = useProjectStore.getState().currentProject;
  if (!project) return;

  const projectId = project.id;
  const userId = useAuthStore.getState().user?.id || null;
  const captures = { ...useProjectStore.getState().sceneCaptures };

  debounced('captures', async () => {
    for (const capture of Object.values(captures)) {
      const sc = capture as SceneCapture;
      const dbCapture = sceneCaptureToDb(sc, userId);
      const { error } = await supabase
        .from('continuity_events')
        .upsert(dbCapture, { onConflict: 'id' });
      if (error) {
        console.warn('[AutoSave] Continuity event failed:', error);
        continue;
      }
      // Upload any new photos
      await autoUploadCapturePhotos(projectId, sc);
    }
    console.log('[AutoSave] Captures saved');
  });
}

export function autoSaveSchedule(): void {
  if (!isSupabaseConfigured) return;
  const project = useProjectStore.getState().currentProject;
  if (!project) return;

  const projectId = project.id;
  const schedule = useScheduleStore.getState().schedule;
  if (!schedule) return;

  // Snapshot the schedule data
  const scheduleSnapshot = { ...schedule };

  debounced('schedule', async () => {
    const { error } = await supabase
      .from('schedule_data')
      .upsert({
        id: scheduleSnapshot.id,
        project_id: projectId,
        raw_pdf_text: scheduleSnapshot.rawText || null,
        cast_list: scheduleSnapshot.castList as unknown as Json,
        days: scheduleSnapshot.days as unknown as Json,
        status: scheduleSnapshot.status === 'complete' ? 'complete' : 'pending',
      }, { onConflict: 'id' });
    if (error) throw error;

    // Upload schedule PDF if present
    if (scheduleSnapshot.pdfUri && scheduleSnapshot.pdfUri.startsWith('data:')) {
      const { path, error: uploadError } = await supabaseStorage.uploadBase64Document(
        projectId, 'schedules', scheduleSnapshot.pdfUri
      );
      if (!uploadError && path) {
        await supabase.from('schedule_data').update({ storage_path: path }).eq('id', scheduleSnapshot.id);
      }
    }
    console.log('[AutoSave] Schedule saved');
  });
}

export function autoSaveCallSheets(): void {
  if (!isSupabaseConfigured) return;
  const project = useProjectStore.getState().currentProject;
  if (!project) return;

  const projectId = project.id;
  const userId = useAuthStore.getState().user?.id || null;
  const callSheets = [...useCallSheetStore.getState().callSheets];
  if (callSheets.length === 0) return;

  debounced('callSheets', async () => {
    for (const cs of callSheets) {
      const { pdfUri, ...parsedData } = cs;
      const { error } = await supabase
        .from('call_sheet_data')
        .upsert({
          id: cs.id,
          project_id: projectId,
          shoot_date: cs.date,
          production_day: cs.productionDay,
          raw_text: cs.rawText || null,
          parsed_data: parsedData as unknown as Json,
          uploaded_by: userId,
        }, { onConflict: 'id' });
      if (error) console.warn('[AutoSave] Call sheet failed:', error);

      if (pdfUri && pdfUri.startsWith('data:')) {
        const { path, error: uploadError } = await supabaseStorage.uploadBase64Document(
          projectId, 'call-sheets', pdfUri
        );
        if (!uploadError && path) {
          await supabase.from('call_sheet_data').update({ storage_path: path }).eq('id', cs.id);
        }
      }
    }
    console.log('[AutoSave] Call sheets saved');
  });
}

export function autoSaveScript(): void {
  if (!isSupabaseConfigured) return;
  const project = useProjectStore.getState().currentProject;
  if (!project?.scriptPdfData) return;

  const projectId = project.id;
  const scriptData = project.scriptPdfData;
  const userId = useAuthStore.getState().user?.id || null;
  const sceneCount = project.scenes.length;

  debounced('script', async () => {
    if (!scriptData.startsWith('data:')) return;

    // Check if already uploaded by looking for active script
    const { data: existing } = await supabase
      .from('script_uploads')
      .select('id')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .limit(1);

    // Only upload if no active script exists (initial save handles the first upload)
    if (existing && existing.length > 0) return;

    const { path, error: uploadError } = await supabaseStorage.uploadBase64Document(
      projectId, 'scripts', scriptData
    );
    if (!uploadError && path) {
      const base64Length = scriptData.split(',')[1]?.length || 0;
      const fileSize = Math.round(base64Length * 0.75);
      await supabase.from('script_uploads').insert({
        project_id: projectId,
        storage_path: path,
        file_name: 'script.pdf',
        file_size: fileSize,
        is_active: true,
        status: 'uploaded',
        uploaded_by: userId,
        scene_count: sceneCount,
      });
    }
    console.log('[AutoSave] Script saved');
  });
}

// ============================================================================
// Full save: push ALL current state to Supabase (used before logout)
// ============================================================================

/**
 * Save everything in the current project to Supabase immediately.
 * Unlike the debounced auto-save functions, this reads the CURRENT
 * state from all stores and pushes every category in parallel.
 * Call this before destroying the Supabase session (logout).
 */
export async function saveEverythingToSupabase(): Promise<void> {
  if (!isSupabaseConfigured) return;

  // Cancel any pending debounced saves — we're about to save everything
  for (const key of Object.keys(timers)) {
    clearTimeout(timers[key]);
    delete timers[key];
  }
  for (const key of Object.keys(pendingFns)) {
    delete pendingFns[key];
  }

  const project = useProjectStore.getState().currentProject;
  if (!project) return;

  const projectId = project.id;
  const userId = useAuthStore.getState().user?.id || null;

  console.log('[SaveAll] Saving all project data before logout…');

  const errors: string[] = [];

  // ── 1. Scenes + scene_characters ──────────────────────────────
  if (project.scenes.length > 0) {
    try {
      const dbScenes = project.scenes.map(s => sceneToDb(s, projectId));
      const { error } = await supabase
        .from('scenes')
        .upsert(dbScenes, { onConflict: 'id' });
      if (error) throw error;

      const sceneIds = project.scenes.map(s => s.id);
      const scEntries: { scene_id: string; character_id: string }[] = [];
      for (const scene of project.scenes) {
        for (const charId of scene.characters) {
          scEntries.push({ scene_id: scene.id, character_id: charId });
        }
      }
      if (sceneIds.length > 0) {
        await supabase.rpc('sync_scene_characters', {
          p_scene_ids: sceneIds,
          p_entries: scEntries,
        });
      }
      console.log('[SaveAll] Scenes saved');
    } catch (err) {
      console.error('[SaveAll] Scenes failed:', err);
      errors.push('scenes');
    }
  }

  // ── 2. Characters ─────────────────────────────────────────────
  if (project.characters.length > 0) {
    try {
      const dbChars = project.characters.map(c => characterToDb(c, projectId));
      const { error } = await supabase
        .from('characters')
        .upsert(dbChars, { onConflict: 'id' });
      if (error) throw error;
      console.log('[SaveAll] Characters saved');
    } catch (err) {
      console.error('[SaveAll] Characters failed:', err);
      errors.push('characters');
    }
  }

  // ── 3. Looks + look_scenes ────────────────────────────────────
  if (project.looks.length > 0) {
    try {
      const dbLooks = project.looks.map(l => lookToDb(l, projectId));
      const { error } = await supabase
        .from('looks')
        .upsert(dbLooks, { onConflict: 'id' });
      if (error) throw error;

      const lookIds = project.looks.map(l => l.id);
      const lsEntries: { look_id: string; scene_number: string }[] = [];
      for (const look of project.looks) {
        for (const sceneNum of look.scenes) {
          lsEntries.push({ look_id: look.id, scene_number: sceneNum });
        }
      }
      if (lookIds.length > 0) {
        await supabase.rpc('sync_look_scenes', {
          p_look_ids: lookIds,
          p_entries: lsEntries,
        });
      }
      console.log('[SaveAll] Looks saved');
    } catch (err) {
      console.error('[SaveAll] Looks failed:', err);
      errors.push('looks');
    }
  }

  // ── 4. Scene captures (continuity events + photos) ────────────
  const captures = useProjectStore.getState().sceneCaptures;
  const captureEntries = Object.values(captures);
  if (captureEntries.length > 0) {
    for (const capture of captureEntries) {
      const sc = capture as SceneCapture;
      try {
        const dbCapture = sceneCaptureToDb(sc, userId);
        const { error } = await supabase
          .from('continuity_events')
          .upsert(dbCapture, { onConflict: 'id' });
        if (error) throw error;
        await autoUploadCapturePhotos(projectId, sc);
      } catch (err) {
        console.error('[SaveAll] Capture failed:', err);
        errors.push(`capture-${sc.id}`);
      }
    }
    console.log('[SaveAll] Captures saved');
  }

  // ── 5. Schedule ───────────────────────────────────────────────
  const schedule = useScheduleStore.getState().schedule;
  if (schedule) {
    try {
      const { error } = await supabase
        .from('schedule_data')
        .upsert({
          id: schedule.id,
          project_id: projectId,
          raw_pdf_text: schedule.rawText || null,
          cast_list: schedule.castList as unknown as Json,
          days: schedule.days as unknown as Json,
          status: schedule.status === 'complete' ? 'complete' : 'pending',
        }, { onConflict: 'id' });
      if (error) throw error;

      if (schedule.pdfUri && schedule.pdfUri.startsWith('data:')) {
        const { path, error: uploadError } = await supabaseStorage.uploadBase64Document(
          projectId, 'schedules', schedule.pdfUri
        );
        if (!uploadError && path) {
          await supabase.from('schedule_data').update({ storage_path: path }).eq('id', schedule.id);
        }
      }
      console.log('[SaveAll] Schedule saved');
    } catch (err) {
      console.error('[SaveAll] Schedule failed:', err);
      errors.push('schedule');
    }
  }

  // ── 6. Call sheets ────────────────────────────────────────────
  const callSheets = useCallSheetStore.getState().callSheets;
  if (callSheets.length > 0) {
    try {
      for (const cs of callSheets) {
        const { pdfUri, ...parsedData } = cs;
        const { error } = await supabase
          .from('call_sheet_data')
          .upsert({
            id: cs.id,
            project_id: projectId,
            shoot_date: cs.date,
            production_day: cs.productionDay,
            raw_text: cs.rawText || null,
            parsed_data: parsedData as unknown as Json,
            uploaded_by: userId,
          }, { onConflict: 'id' });
        if (error) console.warn('[SaveAll] Call sheet row failed:', error);

        if (pdfUri && pdfUri.startsWith('data:')) {
          const { path, error: uploadError } = await supabaseStorage.uploadBase64Document(
            projectId, 'call-sheets', pdfUri
          );
          if (!uploadError && path) {
            await supabase.from('call_sheet_data').update({ storage_path: path }).eq('id', cs.id);
          }
        }
      }
      console.log('[SaveAll] Call sheets saved');
    } catch (err) {
      console.error('[SaveAll] Call sheets failed:', err);
      errors.push('callSheets');
    }
  }

  // ── 7. Script PDF ─────────────────────────────────────────────
  if (project.scriptPdfData && project.scriptPdfData.startsWith('data:')) {
    try {
      // Check if already uploaded
      const { data: existing } = await supabase
        .from('script_uploads')
        .select('id')
        .eq('project_id', projectId)
        .eq('is_active', true)
        .limit(1);

      if (!existing || existing.length === 0) {
        const { path, error: uploadError } = await supabaseStorage.uploadBase64Document(
          projectId, 'scripts', project.scriptPdfData
        );
        if (!uploadError && path) {
          const base64Length = project.scriptPdfData.split(',')[1]?.length || 0;
          const fileSize = Math.round(base64Length * 0.75);
          await supabase.from('script_uploads').insert({
            project_id: projectId,
            storage_path: path,
            file_name: 'script.pdf',
            file_size: fileSize,
            is_active: true,
            status: 'uploaded',
            uploaded_by: userId,
            scene_count: project.scenes.length,
          });
        }
      }
      console.log('[SaveAll] Script saved');
    } catch (err) {
      console.error('[SaveAll] Script failed:', err);
      errors.push('script');
    }
  }

  if (errors.length > 0) {
    console.warn(`[SaveAll] Completed with errors in: ${errors.join(', ')}`);
  } else {
    console.log('[SaveAll] All data saved successfully');
  }
}

// ============================================================================
// Helpers
// ============================================================================

async function autoUploadCapturePhotos(projectId: string, capture: SceneCapture): Promise<void> {
  const allPhotos: { photo: Photo; angle: string }[] = [];

  for (const [angle, photo] of Object.entries(capture.photos)) {
    if (photo) allPhotos.push({ photo, angle });
  }
  for (const photo of capture.additionalPhotos) {
    allPhotos.push({ photo, angle: 'additional' });
  }

  for (const { photo, angle } of allPhotos) {
    // Skip if already uploaded
    const { data: existing } = await supabase
      .from('photos')
      .select('id')
      .eq('id', photo.id)
      .single();
    if (existing) continue;

    let storagePath: string | null = null;

    const localBlob = await getPhotoBlob(photo.id);
    if (localBlob) {
      const { result, error } = await supabaseStorage.uploadPhoto(
        projectId, capture.characterId, localBlob.blob
      );
      if (!error && result) storagePath = result.path;
    } else if (photo.uri && photo.uri.startsWith('data:')) {
      const { result, error } = await supabaseStorage.uploadBase64Photo(
        projectId, capture.characterId, photo.uri
      );
      if (!error && result) storagePath = result.path;
    }

    if (storagePath) {
      await supabase.from('photos').insert({
        id: photo.id,
        continuity_event_id: capture.id,
        storage_path: storagePath,
        photo_type: 'on_set',
        angle: angle as 'front' | 'left' | 'right' | 'back' | 'detail' | 'additional',
        taken_at: photo.capturedAt ? new Date(photo.capturedAt).toISOString() : new Date().toISOString(),
      });
    }
  }
}
